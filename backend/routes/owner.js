import express from 'express';
import { requireAuth, requireOwner } from '../middleware/auth.js';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// All owner routes require authentication and owner role
router.use(requireAuth);
router.use(requireOwner);

// Get current player and bid info
// Get current player and bid info
router.get('/current-info', async (req, res) => {
    try {
        const teamId = req.session.teamId;

        // 1. Initial independent fetches: Auction State & Current Team
        const [stateResult, teamResult] = await Promise.all([
            supabase.from('auction_state').select('*').eq('id', 1).maybeSingle(),
            supabase.from('teams').select('budget, bidding_locked').eq('id', teamId).single()
        ]);

        const { data: state, error: stateError } = stateResult;
        const { data: team, error: teamError } = teamResult;

        if (stateError) throw stateError;
        if (teamError || !team) return res.status(404).json({ error: 'Team not found' });

        // 2. Prepare second batch of promises
        const promises = [
            // Stats (Sold/Unsold/Available)
            supabase.from('players').select('id', { count: 'exact', head: true }).eq('sold_to_team', teamId).eq('status', 'SOLD'),
            supabase.from('players').select('id', { count: 'exact', head: true }).eq('status', 'UNSOLD'),
            supabase.from('players').select('id', { count: 'exact', head: true }).eq('status', 'AVAILABLE')
        ];

        // If a player is current, fetch player and highest bid
        if (state && state.current_player_id) {
            promises.push(supabase.from('players').select('*').eq('id', state.current_player_id).single());
            promises.push(
                supabase.from('bids')
                    .select('*')
                    .eq('player_id', state.current_player_id)
                    .order('amount', { ascending: false })
                    .limit(1)
                    .maybeSingle()
            );
        }

        // Execute second batch
        const results = await Promise.all(promises);

        const soldResult = results[0];
        const unsoldResult = results[1];
        const availableResult = results[2];
        const playerResult = state.current_player_id ? results[3] : null;
        const bidResult = state.current_player_id ? results[4] : null;

        const stats = {
            sold: soldResult.count || 0,
            unsold: unsoldResult.count || 0,
            available: availableResult.count || 0
        };

        // 3. Process Player & Bid Data
        let player = null;
        let highestBid = null;
        let currentBid = 0;
        let committedAmount = 0;

        if (playerResult && playerResult.data) {
            player = playerResult.data;
            if (bidResult && bidResult.data) {
                const b = bidResult.data;
                // We need the team name for the highest bid. 
                // Minimal impact to await here as it's a single likely-cached lookup, 
                // but strictly we could have fetched all teams map earlier if we wanted 100% parallel.
                const { data: bidTeam } = await supabase.from('teams').select('name').eq('id', b.team_id).maybeSingle();

                highestBid = {
                    ...b,
                    team_name: bidTeam ? bidTeam.name : null,
                    team_id: b.team_id
                };
                currentBid = b.amount;
                if (b.team_id === teamId) {
                    committedAmount = b.amount;
                }
            } else {
                currentBid = player.base_price;
            }
        }

        // 4. Calculations
        const maxPlayersPerTeam = state?.max_players_per_team || 10;
        const playersBought = stats.sold;
        const remainingPlayers = maxPlayersPerTeam - playersBought;
        const enforceMaxBid = state?.enforce_max_bid === 1;
        const minimumAmountToKeep = enforceMaxBid ? (remainingPlayers * 1000) : 0;
        const totalBudget = team.budget;
        const availableBalance = totalBudget - committedAmount;
        const maxBidAllowed = enforceMaxBid ? Math.max(0, totalBudget - minimumAmountToKeep) : totalBudget;

        res.json({
            player,
            highestBid,
            currentBid,
            biddingLocked: state?.bidding_locked === 1,
            status: state?.status || 'STOPPED',
            bidIncrements: {
                increment1: state?.bid_increment_1 || 500,
                increment2: state?.bid_increment_2 || 1000
            },
            stats,
            walletBalance: availableBalance,
            totalBudget: totalBudget,
            committedAmount: committedAmount,
            teamBiddingLocked: team.bidding_locked === 1,
            totalAllowedPlayers: maxPlayersPerTeam,
            playersBought: playersBought,
            remainingPlayers: remainingPlayers,
            minimumAmountToKeep: minimumAmountToKeep,
            maxBidAllowed: maxBidAllowed,
            enforceMaxBid: enforceMaxBid
        });

    } catch (err) {
        console.error('Error in owner info:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Place bid
router.post('/bid', async (req, res) => {
    const { amount } = req.body;
    const teamId = req.session.teamId;
    const io = req.app.locals.io;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid bid amount' });
    }

    try {
        // 1. Get Auction State (Required first for current_player_id)
        const { data: state, error: stateError } = await supabase.from('auction_state').select('*').eq('id', 1).single();
        if (stateError || !state) return res.status(500).json({ error: 'Auction state error' });

        if (state.status !== 'LIVE') return res.status(400).json({ error: 'Auction is not live' });
        if (state.bidding_locked === 1) return res.status(400).json({ error: 'Bidding is locked' });
        if (!state.current_player_id) return res.status(400).json({ error: 'No player is currently being auctioned' });

        // 2. Parallel Fetching: Team, Player, Current Bid, Sold Count
        // We need these to validate. Fetching them in parallel saves round trips.
        const [
            teamResult,
            playerResult,
            currentBidResult,
            soldCountResult
        ] = await Promise.all([
            // Team
            supabase.from('teams').select('budget, bidding_locked, name').eq('id', teamId).single(),
            // Player
            supabase.from('players').select('*').eq('id', state.current_player_id).single(),
            // Highest Bid
            supabase.from('bids').select('*').eq('player_id', state.current_player_id).order('amount', { ascending: false }).limit(1).maybeSingle(),
            // Sold Count
            supabase.from('players').select('id', { count: 'exact', head: true }).eq('sold_to_team', teamId).eq('status', 'SOLD')
        ]);

        const { data: team, error: teamError } = teamResult;
        const { data: player, error: playerError } = playerResult;
        const { data: currentHighest, error: bidError } = currentBidResult; // bidError usually null with maybeSingle
        const { count: playersBought, error: countError } = soldCountResult;

        if (teamError || !team) return res.status(404).json({ error: 'Team not found' });
        if (team.bidding_locked === 1) return res.status(400).json({ error: 'Your team is locked from bidding by admin' });
        if (playerError || !player) return res.status(404).json({ error: 'Player not found' });

        // 3. Validation: Min Bid
        const minimumBid = currentHighest
            ? currentHighest.amount + Math.min(state.bid_increment_1, state.bid_increment_2)
            : player.base_price;

        if (amount < minimumBid) {
            return res.status(400).json({
                error: `Bid must be at least ${minimumBid}`,
                minimumBid
            });
        }

        // 4. Validation: Self-outbid
        // We need to check if currentHighest exists before accessing team_id
        if (currentHighest && currentHighest.team_id === teamId) {
            return res.status(400).json({ error: 'You are already the highest bidder' });
        }

        // 5. Validation: Financial / Logic
        const maxPlayersPerTeam = state.max_players_per_team || 10;
        const remainingPlayers = maxPlayersPerTeam - (playersBought || 0);

        if (remainingPlayers <= 0) {
            return res.status(400).json({
                error: `Your team has already reached the maximum of ${maxPlayersPerTeam} players`
            });
        }

        const enforceMaxBid = state.enforce_max_bid === 1;
        const minimumAmountToKeep = enforceMaxBid ? (remainingPlayers * 1000) : 0;
        const maxBidAllowed = enforceMaxBid ? Math.max(0, team.budget - minimumAmountToKeep) : team.budget;

        if (amount > maxBidAllowed) {
            if (enforceMaxBid) {
                return res.status(400).json({
                    error: `Bid exceeds maximum allowed. You need to keep ${minimumAmountToKeep.toLocaleString()} for ${remainingPlayers} remaining player(s).`,
                    maxBidAllowed,
                    minimumAmountToKeep,
                    remainingPlayers
                });
            } else {
                return res.status(400).json({
                    error: `Bid exceeds maximum allowed purse: ${maxBidAllowed.toLocaleString()}`,
                    maxBidAllowed
                });
            }
        }

        // 6. Place Bid
        const { data: newBid, error: insertError } = await supabase
            .from('bids')
            .insert([{
                player_id: state.current_player_id,
                team_id: teamId,
                amount: amount,
                timestamp: new Date()
            }])
            .select('*')
            .single();

        if (insertError) throw insertError;

        // Flatten
        const bidToSend = {
            ...newBid,
            team_name: team.name // Use the validated team object
        };

        // 7. Calculate new wallet balance info to return
        const committedAmount = amount; // Since we just become highest
        const availableBalance = team.budget - committedAmount;
        const previousBidAmount = currentHighest ? currentHighest.amount : player.base_price;

        // Emit
        const increment = amount - previousBidAmount;

        io.emit('bid-placed', {
            bid: bidToSend,
            playerId: state.current_player_id,
            previousBid: previousBidAmount,
            increment: increment
        });

        io.emit('bid-updated', { highestBid: bidToSend, playerId: state.current_player_id });

        res.json({
            success: true,
            highestBid: bidToSend,
            message: 'Bid placed successfully',
            walletBalance: availableBalance,
            totalBudget: team.budget,
            committedAmount: committedAmount
        });

    } catch (err) {
        console.error('Error in owner bid:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get players by status
router.get('/players-by-status/:status', async (req, res) => {
    const { status } = req.params;
    const teamId = req.session.teamId;

    if (!['SOLD', 'AVAILABLE', 'UNSOLD'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        let query = supabase
            .from('players')
            .select('*')
            .eq('status', status);

        if (status === 'SOLD') {
            query = query.eq('sold_to_team', teamId);
        }

        const { data: players, error } = await query.order('serial_number', { ascending: true }).order('id', { ascending: true });

        if (error) throw error;

        // Fetch teams manually
        const teamIds = [...new Set(players.map(p => p.sold_to_team).filter(id => id))];
        const teamMap = {};
        if (teamIds.length > 0) {
            const { data: teams } = await supabase.from('teams').select('id, name').in('id', teamIds);
            if (teams) teams.forEach(t => teamMap[t.id] = t.name);
        }

        const processedPlayers = players.map(p => ({
            ...p,
            team_name: p.sold_to_team ? teamMap[p.sold_to_team] : null
        }));

        res.json(processedPlayers);

    } catch (err) {
        console.error('Error players by status:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Get all teams
router.get('/teams', async (req, res) => {
    try {
        const { data: teams, error } = await supabase
            .from('teams')
            .select('id, name')
            .order('name');

        if (error) throw error;
        res.json(teams);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Get players purchased by a specific team
router.get('/teams/:teamId/players', async (req, res) => {
    const { teamId } = req.params;
    try {
        const { data: players, error } = await supabase
            .from('players')
            .select('name, sold_price, serial_number')
            .eq('sold_to_team', teamId)
            .eq('status', 'SOLD')
            .order('serial_number')
            .order('name');

        if (error) throw error;
        res.json(players);
    } catch (err) {
        res.status(500).json({ error: 'Database error' });
    }
});

export default router;

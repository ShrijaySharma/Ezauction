import express from 'express';
import { requireAuth, requireOwner } from '../middleware/auth.js';

const router = express.Router();

// All owner routes require authentication and owner role
router.use(requireAuth);
router.use(requireOwner);

// Get current player and bid info
router.get('/current-info', (req, res) => {
    const db = req.app.locals.db;

    db.get('SELECT * FROM auction_state WHERE id = 1', (err, state) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!state || !state.current_player_id) {
            // Get stats
            db.all('SELECT status FROM players', (err, players) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }
                const stats = {
                    sold: players.filter(p => p.status === 'SOLD').length,
                    unsold: players.filter(p => p.status === 'UNSOLD').length,
                    available: players.filter(p => p.status === 'AVAILABLE').length
                };
                // Get team wallet balance
                const teamId = req.session.teamId;
                db.get('SELECT budget FROM teams WHERE id = ?', [teamId], (err, team) => {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }

                    const totalBudget = team ? team.budget : 0;

                    // Get max players per team from auction state
                    const maxPlayersPerTeam = state?.max_players_per_team || 10;

                    // Count players bought by this team
                    db.get('SELECT COUNT(*) as count FROM players WHERE sold_to_team = ? AND STATUS = ?',
                        [teamId, 'SOLD'], (err, result) => {
                            if (err) {
                                return res.status(500).json({ error: 'Database error' });
                            }

                            const playersBought = result ? result.count : 0;
                            const remainingPlayers = maxPlayersPerTeam - playersBought;
                            const enforceMaxBid = state?.enforce_max_bid === 1;
                            const minimumAmountToKeep = enforceMaxBid ? (remainingPlayers * 1000) : 0;
                            const maxBidAllowed = enforceMaxBid ? Math.max(0, totalBudget - minimumAmountToKeep) : totalBudget;

                            return res.json({
                                player: null,
                                highestBid: null,
                                currentBid: 0,
                                biddingLocked: state?.bidding_locked === 1,
                                status: state?.status || 'STOPPED',
                                bidIncrements: {
                                    increment1: state?.bid_increment_1 || 500,
                                    increment2: state?.bid_increment_2 || 1000,
                                    increment3: state?.bid_increment_3 || 5000
                                },
                                stats,
                                walletBalance: totalBudget,
                                totalBudget: totalBudget,
                                committedAmount: 0,
                                // Financial constraint info
                                totalAllowedPlayers: maxPlayersPerTeam,
                                playersBought: playersBought,
                                remainingPlayers: remainingPlayers,
                                minimumAmountToKeep: minimumAmountToKeep,
                                maxBidAllowed: maxBidAllowed,
                                enforceMaxBid: enforceMaxBid
                            });
                        });
                });
            });
            return;
        }

        // Get player
        db.get('SELECT * FROM players WHERE id = ?', [state.current_player_id], (err, player) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }

            // Get highest bid
            db.get(
                `SELECT b.*, t.name as team_name, t.id as team_id
         FROM bids b
         JOIN teams t ON b.team_id = t.id
         WHERE b.player_id = ?
         ORDER BY b.amount DESC
         LIMIT 1`,
                [state.current_player_id],
                (err, highestBid) => {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }

                    const currentBid = highestBid ? highestBid.amount : (player ? player.base_price : 0);

                    // Get stats
                    db.all('SELECT status FROM players', (err, allPlayers) => {
                        if (err) {
                            return res.status(500).json({ error: 'Database error' });
                        }
                        const stats = {
                            sold: allPlayers.filter(p => p.status === 'SOLD').length,
                            unsold: allPlayers.filter(p => p.status === 'UNSOLD').length,
                            available: allPlayers.filter(p => p.status === 'AVAILABLE').length
                        };

                        // Get team wallet balance and committed amount
                        const teamId = req.session.teamId;
                        db.get('SELECT budget, bidding_locked FROM teams WHERE id = ?', [teamId], (err, team) => {
                            if (err) {
                                return res.status(500).json({ error: 'Database error' });
                            }

                            // Calculate committed amount (if this team is the highest bidder)
                            let committedAmount = 0;
                            if (highestBid && highestBid.team_id === teamId) {
                                committedAmount = highestBid.amount;
                            }

                            // Available balance = total budget - committed amount
                            const totalBudget = team ? team.budget : 0;
                            const availableBalance = totalBudget - committedAmount;
                            const teamBiddingLocked = team ? (team.bidding_locked === 1) : false;

                            // Get max players per team from auction state
                            const maxPlayersPerTeam = state.max_players_per_team || 10;

                            // Count players bought by this team
                            db.get('SELECT COUNT(*) as count FROM players WHERE sold_to_team = ? AND status = ?',
                                [teamId, 'SOLD'], (err, result) => {
                                    if (err) {
                                        return res.status(500).json({ error: 'Database error' });
                                    }

                                    const playersBought = result ? result.count : 0;
                                    const remainingPlayers = maxPlayersPerTeam - playersBought;
                                    const enforceMaxBid = state.enforce_max_bid === 1;
                                    const minimumAmountToKeep = enforceMaxBid ? (remainingPlayers * 1000) : 0;
                                    const maxBidAllowed = enforceMaxBid ? Math.max(0, totalBudget - minimumAmountToKeep) : totalBudget;

                                    res.json({
                                        player,
                                        highestBid,
                                        currentBid,
                                        biddingLocked: state.bidding_locked === 1,
                                        status: state.status,
                                        bidIncrements: {
                                            increment1: state.bid_increment_1,
                                            increment2: state.bid_increment_2,
                                            increment3: state.bid_increment_3
                                        },
                                        stats,
                                        walletBalance: availableBalance,
                                        totalBudget: totalBudget,
                                        committedAmount: committedAmount,
                                        teamBiddingLocked: teamBiddingLocked,
                                        // Financial constraint info
                                        totalAllowedPlayers: maxPlayersPerTeam,
                                        playersBought: playersBought,
                                        remainingPlayers: remainingPlayers,
                                        minimumAmountToKeep: minimumAmountToKeep,
                                        maxBidAllowed: maxBidAllowed,
                                        enforceMaxBid: enforceMaxBid
                                    });
                                });
                        });
                    });
                }
            );
        });
    });
});

// Place bid
router.post('/bid', (req, res) => {
    const { amount } = req.body;
    const teamId = req.session.teamId;
    const db = req.app.locals.db;
    const io = req.app.locals.io;

    if (!amount || amount <= 0) {
        return res.status(400).json({ error: 'Invalid bid amount' });
    }

    // Check auction state
    db.get('SELECT * FROM auction_state WHERE id = 1', (err, state) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (!state || state.status !== 'LIVE') {
            return res.status(400).json({ error: 'Auction is not live' });
        }

        if (state.bidding_locked === 1) {
            return res.status(400).json({ error: 'Bidding is locked' });
        }

        if (!state.current_player_id) {
            return res.status(400).json({ error: 'No player is currently being auctioned' });
        }

        // Get current highest bid
        db.get(
            `SELECT * FROM bids WHERE player_id = ? ORDER BY amount DESC LIMIT 1`,
            [state.current_player_id],
            (err, currentHighest) => {
                if (err) {
                    return res.status(500).json({ error: 'Database error' });
                }

                const basePrice = 0; // Will get from player
                db.get('SELECT base_price FROM players WHERE id = ?', [state.current_player_id], (err, player) => {
                    if (err) {
                        return res.status(500).json({ error: 'Database error' });
                    }

                    const minimumBid = currentHighest
                        ? currentHighest.amount + Math.min(state.bid_increment_1, state.bid_increment_2, state.bid_increment_3)
                        : player.base_price;

                    if (amount < minimumBid) {
                        return res.status(400).json({
                            error: `Bid must be at least ${minimumBid}`,
                            minimumBid
                        });
                    }

                    // Check if this team is already the highest bidder
                    if (currentHighest && currentHighest.team_id === teamId) {
                        return res.status(400).json({ error: 'You are already the highest bidder' });
                    }

                    // Check wallet balance before placing bid
                    db.get('SELECT budget, bidding_locked FROM teams WHERE id = ?', [teamId], (err, team) => {
                        if (err) {
                            return res.status(500).json({ error: 'Database error' });
                        }

                        if (!team) {
                            return res.status(400).json({ error: 'Team not found' });
                        }

                        // Check if team is locked from bidding
                        if (team.bidding_locked === 1) {
                            return res.status(400).json({ error: 'Your team is locked from bidding by admin' });
                        }

                        // Get max players per team and calculate financial constraints
                        const maxPlayersPerTeam = state.max_players_per_team || 10;

                        // Count players bought by this team
                        db.get('SELECT COUNT(*) as count FROM players WHERE sold_to_team = ? AND status = ?',
                            [teamId, 'SOLD'], (err, result) => {
                                if (err) {
                                    return res.status(500).json({ error: 'Database error' });
                                }

                                const playersBought = result ? result.count : 0;
                                const remainingPlayers = maxPlayersPerTeam - playersBought;

                                // Check if team has reached max players
                                if (remainingPlayers <= 0) {
                                    return res.status(400).json({
                                        error: `Your team has already reached the maximum of ${maxPlayersPerTeam} players`
                                    });
                                }

                                const enforceMaxBid = state.enforce_max_bid === 1;
                                const minimumAmountToKeep = enforceMaxBid ? (remainingPlayers * 1000) : 0;
                                const maxBidAllowed = enforceMaxBid ? Math.max(0, team.budget - minimumAmountToKeep) : team.budget;

                                // Check if bid exceeds maximum allowed
                                if (amount > maxBidAllowed) {
                                    if (enforceMaxBid) {
                                        return res.status(400).json({
                                            error: `Bid exceeds maximum allowed. You need to keep ₹${minimumAmountToKeep.toLocaleString()} for ${remainingPlayers} remaining player(s). Maximum bid allowed: ₹${maxBidAllowed.toLocaleString()}`,
                                            maxBidAllowed: maxBidAllowed,
                                            minimumAmountToKeep: minimumAmountToKeep,
                                            remainingPlayers: remainingPlayers
                                        });
                                    } else {
                                        return res.status(400).json({
                                            error: `Bid exceeds maximum allowed purse: ₹${maxBidAllowed.toLocaleString()}`,
                                            maxBidAllowed: maxBidAllowed
                                        });
                                    }
                                }

                                // Place bid
                                db.run(
                                    `INSERT INTO bids (player_id, team_id, amount) VALUES (?, ?, ?)`,
                                    [state.current_player_id, teamId, amount],
                                    function (err) {
                                        if (err) {
                                            console.error('Error inserting bid:', err);
                                            return res.status(500).json({ error: 'Database error: ' + err.message });
                                        }

                                        // Get updated highest bid with team info
                                        db.get(
                                            `SELECT b.*, t.name as team_name, t.id as team_id
                     FROM bids b
                     JOIN teams t ON b.team_id = t.id
                     WHERE b.player_id = ?
                     ORDER BY b.amount DESC
                     LIMIT 1`,
                                            [state.current_player_id],
                                            (err, newHighest) => {
                                                if (err) {
                                                    console.error('Error fetching highest bid:', err);
                                                    return res.status(500).json({ error: 'Database error' });
                                                }

                                                // Get updated wallet balance for the bidding team
                                                db.get('SELECT budget FROM teams WHERE id = ?', [teamId], (err, team) => {
                                                    if (err) {
                                                        console.error('Error fetching team budget:', err);
                                                    }

                                                    const totalBudget = team ? team.budget : 0;
                                                    // Calculate committed amount (if this team is now the highest bidder)
                                                    let committedAmount = 0;
                                                    if (newHighest && newHighest.team_id === teamId) {
                                                        committedAmount = newHighest.amount;
                                                    }
                                                    const availableBalance = totalBudget - committedAmount;

                                                    // Calculate previous bid amount for increment calculation
                                                    const previousBidAmount = currentHighest ? currentHighest.amount : (player ? player.base_price : 0);

                                                    // Emit to all clients with previous bid info
                                                    console.log('Emitting bid-placed event:', { bid: newHighest, playerId: state.current_player_id, previousBid: previousBidAmount });
                                                    io.emit('bid-placed', {
                                                        bid: newHighest,
                                                        playerId: state.current_player_id,
                                                        previousBid: previousBidAmount
                                                    });

                                                    res.json({
                                                        success: true,
                                                        highestBid: newHighest,
                                                        message: 'Bid placed successfully',
                                                        walletBalance: availableBalance,
                                                        totalBudget: totalBudget,
                                                        committedAmount: committedAmount
                                                    });
                                                });
                                            }
                                        );
                                    }
                                );
                            });
                    });
                });
            }
        );
    });
});

// Get players by status
router.get('/players-by-status/:status', (req, res) => {
    const { status } = req.params;
    const db = req.app.locals.db;
    const teamId = req.session.teamId; // Get teamId from session

    if (!['SOLD', 'AVAILABLE'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }

    let query = `
        SELECT p.*, t.name as team_name 
        FROM players p 
        LEFT JOIN teams t ON p.sold_to_team = t.id 
        WHERE p.status = ?
    `;
    const params = [status];

    // If fetching SOLD players, only show players sold to THIS team
    if (status === 'SOLD') {
        query += ` AND p.sold_to_team = ?`;
        params.push(teamId);
    }

    query += ` ORDER BY p.serial_number ASC, p.id ASC`;

    db.all(query, params, (err, players) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(players);
    });
});

export default router;

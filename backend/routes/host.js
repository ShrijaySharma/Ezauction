import express from 'express';
import { supabase } from '../supabaseClient.js';
import { getAuctionState, getAdminAnonymousBid } from '../auctionState.js';

const router = express.Router();

// Host routes are now public — no auth required
// All routes are read-only so this is safe

// Get current public state (player, bid, stats)
// Get current public state (player, bid, stats)
router.get('/current-info', async (req, res) => {
  try {
    const state = getAuctionState();

    // Default if not exists
    const status = state ? state.status : 'STOPPED';
    const currentPlayerId = state ? state.current_player_id : null;
    const biddingLocked = state ? state.bidding_locked === 1 : false;

    // Prepare promises for parallel execution
    // Always fetch stats
    const promises = [
      supabase.from('players').select('id', { count: 'exact', head: true }).eq('status', 'SOLD'),
      supabase.from('players').select('id', { count: 'exact', head: true }).eq('status', 'UNSOLD'),
      supabase.from('players').select('id', { count: 'exact', head: true }).eq('status', 'AVAILABLE')
    ];

    // If player active, fetch player and bid
    if (currentPlayerId) {
      promises.push(supabase.from('players').select('*').eq('id', currentPlayerId).single());
      promises.push(
        supabase.from('bids')
          .select('*')
          .eq('player_id', currentPlayerId)
          .order('amount', { ascending: false })
          .limit(1)
          .maybeSingle()
      );
    }

    // Execute all
    const results = await Promise.all(promises);

    // Stats results are always first 3
    const soldResult = results[0];
    const unsoldResult = results[1];
    const availableResult = results[2];

    const stats = {
      sold: soldResult.count || 0,
      unsold: unsoldResult.count || 0,
      available: availableResult.count || 0
    };

    let player = null;
    let highestBid = null;
    let currentBid = 0;

    // If we had player/bid promises
    if (currentPlayerId) {
      const playerResult = results[3];
      const bidResult = results[4];

      if (playerResult.error) {
        console.error('Error fetching current player for host:', playerResult.error);
      } else if (playerResult.data) {
        player = playerResult.data;
        currentBid = player.base_price;
      }

      if (bidResult && bidResult.data) {
        const b = bidResult.data;
        // Fetch team name separately (lightweight single lookup)
        const { data: bidTeam } = await supabase.from('teams').select('name').eq('id', b.team_id).maybeSingle();

        highestBid = {
          ...b,
          team_name: bidTeam ? bidTeam.name : null,
          team_id: b.team_id
        };
        currentBid = b.amount;
      }

      // ─── Admin Bidding 2.0: check in-memory anonymous bid ───
      // Show the running anonymous bid amount on the host dashboard too
      const anonBid = getAdminAnonymousBid();
      if (anonBid.amount > 0 && anonBid.playerId === currentPlayerId) {
        if (anonBid.amount > currentBid) {
          highestBid = {
            id: -1,
            player_id: currentPlayerId,
            team_id: null,
            amount: anonBid.amount,
            team_name: '',
            timestamp: new Date()
          };
          currentBid = anonBid.amount;
        }
      }
    }

    res.json({
      status,
      player,
      highestBid,
      currentBid,
      biddingLocked,
      stats,
      bidIncrements: {
        increment1: state?.bid_increment_1 || 500,
        increment2: state?.bid_increment_2 || 1000
      }
    });

  } catch (err) {
    console.error('Error in host public-state:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all bids for current player
router.get('/current-bids', async (req, res) => {
  try {
    const state = getAuctionState();

    if (!state || !state.current_player_id) {
      return res.json([]);
    }

    const { data: bids, error } = await supabase
      .from('bids')
      .select('*')
      .eq('player_id', state.current_player_id)
      .order('amount', { ascending: false });

    if (error) throw error;

    // Fetch team names manually
    const teamIds = [...new Set(bids.map(b => b.team_id))];
    const teamMap = {};
    if (teamIds.length > 0) {
      const { data: teams } = await supabase.from('teams').select('id, name').in('id', teamIds);
      if (teams) teams.forEach(t => teamMap[t.id] = t.name);
    }

    const flattenedBids = bids.map(b => ({
      ...b,
      team_name: teamMap[b.team_id]
    }));

    res.json(flattenedBids);

  } catch (err) {
    console.error('Error getting bids:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all teams (id, name, logo — used for logo lookups on host dashboard)
router.get('/teams', async (req, res) => {
  try {
    const { data: teams, error } = await supabase
      .from('teams')
      .select('id, name, logo')
      .order('name');

    if (error) throw error;
    res.json(teams || []);
  } catch (err) {
    console.error('Error fetching teams for host:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get team budgets (for host view)
router.get('/team-budgets', async (req, res) => {
  try {
    const { data: teams, error } = await supabase
      .from('teams')
      .select('id, name, budget, logo')
      .order('name');

    if (error) throw error;
    res.json(teams);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all unsold/available players for caching images
router.get('/unsold-players', async (req, res) => {
  try {
    const { data: players, error } = await supabase
      .from('players')
      .select('id, name, image')
      .in('status', ['AVAILABLE', 'UNSOLD'])
      .order('id', { ascending: true }); // Simple stable order

    if (error) throw error;
    res.json(players || []);
  } catch (err) {
    console.error('Error fetching unsold players:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get team purses with players bought count (for host purse view)
router.get('/team-purses', async (req, res) => {
  try {
    // Fetch teams
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name, budget, logo')
      .order('name');

    if (teamsError) throw teamsError;

    // Fetch sold players grouped by team
    const { data: soldPlayers, error: playersError } = await supabase
      .from('players')
      .select('sold_to_team, sold_price')
      .eq('status', 'SOLD');

    if (playersError) throw playersError;

    // Build team data with player counts and spend
    const teamData = (teams || []).map(team => {
      const teamPlayers = (soldPlayers || []).filter(p => p.sold_to_team === team.id);
      const totalSpent = teamPlayers.reduce((sum, p) => sum + (parseFloat(p.sold_price) || 0), 0);
      return {
        ...team,
        playersBought: teamPlayers.length,
        totalSpent: totalSpent
      };
    });

    res.json(teamData);
  } catch (err) {
    console.error('Error fetching team purses:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

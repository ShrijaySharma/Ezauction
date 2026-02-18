import express from 'express';
import { requireAuth, requireHost } from '../middleware/auth.js';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// All host routes require authentication and host role
router.use(requireAuth);
router.use(requireHost);

// Get current public state (player, bid, stats)
// Get current public state (player, bid, stats)
router.get('/current-info', async (req, res) => {
  try {
    const { data: state, error: stateError } = await supabase
      .from('auction_state')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (stateError) throw stateError;

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
    const { data: state } = await supabase.from('auction_state').select('current_player_id').eq('id', 1).maybeSingle();

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

export default router;

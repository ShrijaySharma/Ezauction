import express from 'express';
import { supabase } from '../supabaseClient.js';
import { getAuctionState, getTradingWindowState } from '../auctionState.js';

const router = express.Router({ mergeParams: true });

function getAuctionId(req) {
  return req.params.auctionId || req.headers['x-auction-id'] || null;
}

// Get all players (public)
router.get('/players', async (req, res) => {
  try {
    const auctionId = getAuctionId(req);
    let query = supabase
      .from('players')
      .select('*')
      .order('serial_number', { ascending: true })
      .order('id', { ascending: true });

    if (auctionId) query = query.eq('auction_id', auctionId);

    const { data: players, error } = await query;
    if (error) throw error;
    res.json(players);
  } catch (err) {
    console.error('Error getting players (public):', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all teams (public)
router.get('/teams', async (req, res) => {
  try {
    const auctionId = getAuctionId(req);
    let query = supabase
      .from('teams')
      .select('id, name, logo, budget, owner_name');

    if (auctionId) query = query.eq('auction_id', auctionId);

    const { data: teams, error } = await query;
    if (error) throw error;
    res.json(teams);
  } catch (err) {
    console.error('Error getting teams (public):', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get current auction state (public)
router.get('/auction-state', async (req, res) => {
  try {
    const auctionId = getAuctionId(req);
    const state = getAuctionState(auctionId);
    res.json(state || { status: 'STOPPED', current_player_id: null });
  } catch (err) {
    console.error('Error getting auction state (public):', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get current highest bid for the active player (public)
router.get('/current-bid', async (req, res) => {
  try {
    const auctionId = getAuctionId(req);
    const state = getAuctionState(auctionId);

    if (!state || !state.current_player_id) {
      return res.json({ highestBid: null });
    }

    let query = supabase
      .from('bids')
      .select('*')
      .eq('player_id', state.current_player_id)
      .order('amount', { ascending: false })
      .limit(1);

    if (auctionId) query = query.eq('auction_id', auctionId);

    const { data: bid, error: bidError } = await query.maybeSingle();
    if (bidError) throw bidError;

    let processedBid = null;
    if (bid) {
      const { data: team } = await supabase
        .from('teams')
        .select('name')
        .eq('id', bid.team_id)
        .maybeSingle();

      processedBid = {
        ...bid,
        team_name: team ? team.name : null
      };
    }

    res.json({ highestBid: processedBid });
  } catch (err) {
    console.error('Error getting current bid (public):', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get trading window status (public, no auth)
router.get('/trading-window', (req, res) => {
  try {
    const auctionId = getAuctionId(req);
    const state = getTradingWindowState(auctionId);
    res.json(state);
  } catch (err) {
    console.error('Error getting trading window status (public):', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;

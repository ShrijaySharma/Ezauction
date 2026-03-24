import express from 'express';
import { supabase } from '../supabaseClient.js';
import { getAuctionState } from '../auctionState.js';

const router = express.Router();

// Get all players (public)
router.get('/players', async (req, res) => {
  try {
    const { data: players, error } = await supabase
      .from('players')
      .select('*')
      .order('serial_number', { ascending: true })
      .order('id', { ascending: true });

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
    const { data: teams, error } = await supabase
      .from('teams')
      .select('id, name, logo, budget, owner_name'); // Omitting credentials and owner_id just in case

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
    const state = getAuctionState();
    res.json(state || { status: 'STOPPED', current_player_id: null });
  } catch (err) {
    console.error('Error getting auction state (public):', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get current highest bid for the active player (public)
router.get('/current-bid', async (req, res) => {
  try {
    const state = getAuctionState();

    if (!state || !state.current_player_id) {
      return res.json({ highestBid: null });
    }

    const { data: bid, error: bidError } = await supabase
      .from('bids')
      .select('*')
      .eq('player_id', state.current_player_id)
      .order('amount', { ascending: false })
      .limit(1)
      .maybeSingle();

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

export default router;

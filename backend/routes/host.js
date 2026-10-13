import express from 'express';
import { supabase } from '../supabaseClient.js';
import { getAuctionState, getAdminAnonymousBid } from '../auctionState.js';

const router = express.Router({ mergeParams: true });

function getAuctionId(req) {
  return req.params.auctionId || req.headers['x-auction-id'] || null;
}

// Host routes are public — no auth required

// Get current public state (player, bid, stats)
router.get('/current-info', async (req, res) => {
  try {
    const auctionId = getAuctionId(req);
    const state = getAuctionState(auctionId);

    const status = state ? state.status : 'STOPPED';
    const currentPlayerId = state ? state.current_player_id : null;
    const biddingLocked = state ? state.bidding_locked === 1 : false;

    // Build scoped stats queries
    let qSold = supabase.from('players').select('id', { count: 'exact', head: true }).eq('status', 'SOLD');
    let qUnsold = supabase.from('players').select('id', { count: 'exact', head: true }).eq('status', 'UNSOLD');
    let qAvail = supabase.from('players').select('id', { count: 'exact', head: true }).eq('status', 'AVAILABLE');

    if (auctionId) {
      qSold = qSold.eq('auction_id', auctionId);
      qUnsold = qUnsold.eq('auction_id', auctionId);
      qAvail = qAvail.eq('auction_id', auctionId);
    }

    const promises = [qSold, qUnsold, qAvail];

    if (currentPlayerId) {
      let qPlayer = supabase.from('players').select('*').eq('id', currentPlayerId);
      let qBid = supabase.from('bids').select('*').eq('player_id', currentPlayerId).order('amount', { ascending: false }).limit(1).maybeSingle();

      if (auctionId) {
        qPlayer = qPlayer.eq('auction_id', auctionId);
        qBid = qBid.eq('auction_id', auctionId);
      }

      promises.push(qPlayer.single());
      promises.push(qBid);
    }

    const results = await Promise.all(promises);

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
        const { data: bidTeam } = await supabase.from('teams').select('name').eq('id', b.team_id).maybeSingle();

        highestBid = {
          ...b,
          team_name: bidTeam ? bidTeam.name : null,
          team_id: b.team_id
        };
        currentBid = b.amount;
      }

      // Check running anonymous bid
      const anonBid = getAdminAnonymousBid(auctionId);
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
    const auctionId = getAuctionId(req);
    const state = getAuctionState(auctionId);

    if (!state || !state.current_player_id) {
      return res.json([]);
    }

    let query = supabase
      .from('bids')
      .select('*')
      .eq('player_id', state.current_player_id)
      .order('amount', { ascending: false });

    if (auctionId) query = query.eq('auction_id', auctionId);

    const { data: bids, error } = await query;
    if (error) throw error;

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

// Get all teams
router.get('/teams', async (req, res) => {
  try {
    const auctionId = getAuctionId(req);
    let query = supabase.from('teams').select('id, name, logo').order('name');
    if (auctionId) query = query.eq('auction_id', auctionId);

    const { data: teams, error } = await query;
    if (error) throw error;
    res.json(teams || []);
  } catch (err) {
    console.error('Error fetching teams for host:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get team budgets
router.get('/team-budgets', async (req, res) => {
  try {
    const auctionId = getAuctionId(req);
    let query = supabase.from('teams').select('id, name, budget, logo').order('name');
    if (auctionId) query = query.eq('auction_id', auctionId);

    const { data: teams, error } = await query;
    if (error) throw error;
    res.json(teams || []);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all unsold/available players
router.get('/unsold-players', async (req, res) => {
  try {
    const auctionId = getAuctionId(req);
    let query = supabase
      .from('players')
      .select('id, name, image')
      .in('status', ['AVAILABLE', 'UNSOLD'])
      .order('id', { ascending: true });

    if (auctionId) query = query.eq('auction_id', auctionId);

    const { data: players, error } = await query;
    if (error) throw error;
    res.json(players || []);
  } catch (err) {
    console.error('Error fetching unsold players:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get team purses with players bought count
router.get('/team-purses', async (req, res) => {
  try {
    const auctionId = getAuctionId(req);

    let tQuery = supabase.from('teams').select('id, name, budget, logo').order('name');
    let pQuery = supabase.from('players').select('sold_to_team, sold_price').eq('status', 'SOLD');

    if (auctionId) {
      tQuery = tQuery.eq('auction_id', auctionId);
      pQuery = pQuery.eq('auction_id', auctionId);
    }

    const [{ data: teams, error: teamsError }, { data: soldPlayers, error: playersError }] = await Promise.all([
      tQuery,
      pQuery
    ]);

    if (teamsError) throw teamsError;
    if (playersError) throw playersError;

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

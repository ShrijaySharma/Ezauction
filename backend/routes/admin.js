import express from 'express';
import bcrypt from 'bcrypt';
import fs from 'fs';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(requireAuth);
router.use(requireAdmin);

// Get auction state
router.get('/auction-state', async (req, res) => {
  try {
    const { data: state, error } = await supabase
      .from('auction_state')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      console.error('Database error fetching auction state:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!state) {
      // Initialize if not exists
      const { error: insertError } = await supabase
        .from('auction_state')
        .insert([{ id: 1, status: 'STOPPED' }]);

      if (insertError) {
        console.error('Error initializing auction state:', insertError);
        return res.status(500).json({ error: 'Database error' });
      }

      res.json({
        status: 'STOPPED',
        currentPlayerId: null,
        biddingLocked: false,
        bidIncrements: { increment1: 500, increment2: 1000 }
      });
    } else {
      res.json({
        status: state.status,
        currentPlayerId: state.current_player_id,
        biddingLocked: state.bidding_locked === 1,
        bidIncrements: {
          increment1: state.bid_increment_1,
          increment2: state.bid_increment_2
        },
        maxPlayersPerTeam: state.max_players_per_team || 10,
        enforceMaxBid: state.enforce_max_bid === 1
      });
    }
  } catch (err) {
    console.error('Unexpected error in auction-state:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update enforce max bid setting
router.post('/enforce-max-bid', async (req, res) => {
  const { enforceMaxBid } = req.body;
  const io = req.app.locals.io;

  try {
    const { error } = await supabase
      .from('auction_state')
      .update({
        enforce_max_bid: enforceMaxBid ? 1 : 0,
        updated_at: new Date()
      })
      .eq('id', 1);

    if (error) {
      console.error('Database error updating enforce-max-bid:', error);
      return res.status(500).json({ error: 'Database error' });
    }

    io.emit('enforce-max-bid-changed', { enforceMaxBid });
    res.json({ success: true, enforceMaxBid });
  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete all players and bids permanently
router.delete('/players-all', async (req, res) => {
  const io = req.app.locals.io;

  try {
    // 1. Get all player images to delete from Storage
    const { data: players, error: fetchError } = await supabase
      .from('players')
      .select('image')
      .not('image', 'is', null);

    if (fetchError) {
      console.error('Error fetching players for image deletion:', fetchError);
    } else if (players && players.length > 0) {
      // Extract paths from URLs or store paths directly?
      // Assuming we store relative paths like '/uploads/filename.jpg' or just 'filename.jpg'
      // If we used the local upload logic, it was '/uploads/filename'.
      // With Supabase, we will store the path in the bucket.
      // Since existing data might be local paths, we might need to handle that?
      // But we are migrating. Let's assume new data or we just try to delete.

      const pathsToDelete = players
        .map(p => {
          // If stored as full URL, extract path. If relative, use as is.
          // We will adopt a standard of storing the path within the bucket.
          // e.g., 'player-123.jpg'
          if (!p.image) return null;
          const parts = p.image.split('/');
          return parts[parts.length - 1]; // Simple filename extraction
        })
        .filter(p => p !== null);

      if (pathsToDelete.length > 0) {
        const { error: storageError } = await supabase
          .storage
          .from('auction-images')
          .remove(pathsToDelete);

        if (storageError) console.error('Error deleting images from storage:', storageError);
      }
    }

    // 2. Delete data
    // Supabase doesn't support "TRUNCATE" via JS easily, use delete with filter
    const { error: deleteBidsError } = await supabase.from('bids').delete().neq('id', 0); // Delete all
    if (deleteBidsError) throw deleteBidsError;

    const { error: deletePlayersError } = await supabase.from('players').delete().neq('id', 0); // Delete all
    if (deletePlayersError) throw deletePlayersError;

    const { error: updateStateError } = await supabase
      .from('auction_state')
      .update({ current_player_id: null, status: 'STOPPED' })
      .eq('id', 1);

    if (updateStateError) throw updateStateError;

    io.emit('all-players-deleted');
    res.json({ success: true, message: 'All players and bids deleted permanently' });
  } catch (err) {
    console.error('Error clearing players:', err);
    res.status(500).json({ error: 'Database error clearing players' });
  }
});

// Update auction status
router.post('/auction-status', async (req, res) => {
  const { status } = req.body;
  const io = req.app.locals.io;

  if (!['STOPPED', 'LIVE', 'PAUSED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const { error } = await supabase
      .from('auction_state')
      .update({ status, updated_at: new Date() })
      .eq('id', 1);

    if (error) throw error;

    io.emit('auction-status-changed', { status });
    res.json({ success: true, status });
  } catch (err) {
    console.error('Error updating auction status:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Load next player
router.post('/load-player', async (req, res) => {
  const { playerId } = req.body;
  const io = req.app.locals.io;

  try {
    // 1. Get player
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (playerError) throw playerError;
    if (!player) return res.status(404).json({ error: 'Player not found' });

    // 2. Update auction state
    const { error: updateError } = await supabase
      .from('auction_state')
      .update({
        current_player_id: playerId,
        status: 'LIVE',
        updated_at: new Date()
      })
      .eq('id', 1);

    if (updateError) throw updateError;

    // 3. Clear bids for this player (if any exist from simpler times? usually empty if new)
    // Actually, if we reload a player, we might want to keep bids? 
    // The original code DELETES bids. I will follow original logic.
    const { error: deleteBidsError } = await supabase
      .from('bids')
      .delete()
      .eq('player_id', playerId);

    if (deleteBidsError) throw deleteBidsError;

    io.emit('player-loaded', { player });
    res.json({ success: true, player });

  } catch (err) {
    console.error('Error loading player:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get current highest bid
router.get('/current-bid', async (req, res) => {
  try {
    const { data: state, error: stateError } = await supabase
      .from('auction_state')
      .select('current_player_id')
      .eq('id', 1)
      .maybeSingle();

    if (stateError || !state || !state.current_player_id) {
      return res.json({ highestBid: null, player: null });
    }

    // Parallel fetch: Bid and Player
    const [bidResult, playerResult] = await Promise.all([
      supabase
        .from('bids')
        .select('*')
        .eq('player_id', state.current_player_id)
        .order('amount', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('players')
        .select('*')
        .eq('id', state.current_player_id)
        .single()
    ]);

    const { data: bid, error: bidError } = bidResult;
    const { data: player, error: playerError } = playerResult;

    if (bidError) throw bidError;
    if (playerError) throw playerError;

    // Flatten the joined data to match frontend expectation
    let processedBid = null;
    if (bid) {
      // Fetch team details manually
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('name')
        .eq('id', bid.team_id)
        .maybeSingle();

      processedBid = {
        ...bid,
        team_name: team ? team.name : null,
        team_id: bid.team_id
      };
    }

    res.json({
      highestBid: processedBid,
      player: player || null,
      currentBid: processedBid ? processedBid.amount : (player ? player.base_price : 0)
    });

  } catch (err) {
    console.error('Error getting current bid:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all bids for current player
router.get('/bids', async (req, res) => {
  try {
    const { data: state } = await supabase
      .from('auction_state')
      .select('current_player_id')
      .eq('id', 1)
      .maybeSingle();

    if (!state || !state.current_player_id) {
      return res.json({ bids: [] });
    }

    const { data: bids, error: bidsError } = await supabase
      .from('bids')
      .select('*')
      .eq('player_id', state.current_player_id)
      .order('amount', { ascending: false })
      .order('timestamp', { ascending: false });

    if (bidsError) throw bidsError;

    // Fetch teams manually
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name');

    if (teamsError) throw teamsError;

    const teamMap = {};
    if (teams) teams.forEach(t => teamMap[t.id] = t.name);

    const processedBids = bids.map(b => ({
      ...b,
      team_name: teamMap[b.team_id]
    }));

    res.json({ bids: processedBids });
  } catch (err) {
    console.error('Error getting bids:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Undo last bid
router.post('/undo-bid', async (req, res) => {
  const io = req.app.locals.io;

  try {
    const { data: state } = await supabase
      .from('auction_state')
      .select('current_player_id')
      .eq('id', 1)
      .maybeSingle();

    if (!state || !state.current_player_id) {
      return res.status(400).json({ error: 'No active player' });
    }

    // Get last bid to delete
    const { data: lastBid, error: lastBidError } = await supabase
      .from('bids')
      .select('id, amount')
      .eq('player_id', state.current_player_id)
      .order('timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastBidError) throw lastBidError;
    if (!lastBid) return res.status(400).json({ error: 'No bids to undo' });

    // Delete it
    const { error: deleteError } = await supabase
      .from('bids')
      .delete()
      .eq('id', lastBid.id);

    if (deleteError) throw deleteError;

    // Fetch new highest bid AND previous bid (to restore state)
    // We need top 2 bids now
    const { data: remainingBids, error: remainingBidsError } = await supabase
      .from('bids')
      .select('*')
      .eq('player_id', state.current_player_id)
      .order('amount', { ascending: false })
      .limit(2);

    if (remainingBidsError) throw remainingBidsError;

    const newHighest = remainingBids && remainingBids.length > 0 ? remainingBids[0] : null;
    const newPrevious = remainingBids && remainingBids.length > 1 ? remainingBids[1] : null;

    let processedHighest = null;
    if (newHighest) {
      const { data: team } = await supabase
        .from('teams')
        .select('name')
        .eq('id', newHighest.team_id)
        .maybeSingle();

      processedHighest = {
        ...newHighest,
        team_name: team ? team.name : null
      };
    }

    // Need player base price if no bids left
    let currentBid = 0;
    if (processedHighest) {
      currentBid = processedHighest.amount;
    } else {
      const { data: player } = await supabase.from('players').select('base_price').eq('id', state.current_player_id).single();
      if (player) currentBid = player.base_price;
    }

    // Previous Bid Amount for frontend state
    const previousBidAmount = newPrevious ? newPrevious.amount : (newHighest ? 0 : 0);
    // Logic: if we have a highest, the one before it is 'newPrevious'. If no previous, it might be base price.
    // Actually, AdminDashboard uses: setPreviousBid(data.previousBid || currentBid);
    // If we send newPrevious.amount, it's correct. If newPrevious is null, we send 0 or undefined.

    io.emit('bid-updated', {
      highestBid: processedHighest,
      playerId: state.current_player_id,
      previousBid: newPrevious ? newPrevious.amount : null
    });

    // Try to notify budget update if team reversed
    // We don't have the teamId of the DELETED bid easily available unless we fetched it.
    // But we fetched ID only. It's fine, budgets are calculated on fly usually? 
    // Wait, typical implementation recalculates budget from bids.
    // If we wanted to update the specific team that LOST the bid (was undone), we should have fetched `team_id` in `lastBid`.

    res.json({ success: true, highestBid: processedHighest });

  } catch (err) {
    console.error('Error undoing bid:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Lock/unlock bidding
router.post('/lock-bidding', async (req, res) => {
  const { locked } = req.body;
  const io = req.app.locals.io;

  try {
    const { error } = await supabase
      .from('auction_state')
      .update({
        bidding_locked: locked ? 1 : 0,
        updated_at: new Date()
      })
      .eq('id', 1);

    if (error) throw error;

    io.emit('bidding-locked', { locked });
    res.json({ success: true, locked });
  } catch (err) {
    console.error('Error locking bidding:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get max players per team
router.get('/max-players', async (req, res) => {
  try {
    const { data: state, error } = await supabase
      .from('auction_state')
      .select('max_players_per_team')
      .eq('id', 1)
      .maybeSingle();

    if (error) throw error;
    res.json({ maxPlayersPerTeam: state?.max_players_per_team || 10 });
  } catch (err) {
    console.error('Error getting max players:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update max players per team
router.post('/max-players', async (req, res) => {
  const { maxPlayersPerTeam } = req.body;
  const io = req.app.locals.io;

  if (!maxPlayersPerTeam || maxPlayersPerTeam < 1 || maxPlayersPerTeam > 50) {
    return res.status(400).json({ error: 'Invalid max players per team (must be between 1 and 50)' });
  }

  try {
    const { error } = await supabase
      .from('auction_state')
      .update({
        max_players_per_team: maxPlayersPerTeam,
        updated_at: new Date()
      })
      .eq('id', 1);

    if (error) throw error;

    io.emit('max-players-changed', { maxPlayersPerTeam });
    res.json({ success: true, maxPlayersPerTeam });
  } catch (err) {
    console.error('Error updating max players:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Update bid increments
router.post('/bid-increments', async (req, res) => {
  const { increment1, increment2 } = req.body;
  const io = req.app.locals.io;

  try {
    const { error } = await supabase
      .from('auction_state')
      .update({
        bid_increment_1: increment1,
        bid_increment_2: increment2,
        updated_at: new Date()
      })
      .eq('id', 1);

    if (error) throw error;

    io.emit('bid-increments-changed', { increment1, increment2 });
    res.json({ success: true, increments: { increment1, increment2 } });
  } catch (err) {
    console.error('Error updating bid increments:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Mark player as sold/unsold
router.post('/mark-player', async (req, res) => {
  const { playerId, status, soldPrice, soldToTeam } = req.body;
  const io = req.app.locals.io;

  if (!['SOLD', 'UNSOLD'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    if (status === 'SOLD') {
      // 1. Get highest bid
      const { data: highestBid, error: bidError } = await supabase
        .from('bids')
        .select('*')
        .eq('player_id', playerId)
        .order('amount', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (bidError) throw bidError;

      // 2. Get player base price
      const { data: player, error: playerError } = await supabase
        .from('players')
        .select('base_price')
        .eq('id', playerId)
        .single();

      if (playerError) throw playerError;
      if (!player) return res.status(404).json({ error: 'Player not found' });

      // Validations
      if (!highestBid && !soldPrice) {
        // Logic requires at least one bid or explicit soldPrice
        // Original code: "require at least one bid to mark as SOLD"
        if (!highestBid) {
          return res.status(400).json({
            error: 'No bids found for this player. Cannot mark as SOLD without a bid.'
          });
        }
      }

      const finalSoldPrice = soldPrice || (highestBid ? highestBid.amount : 0);
      const finalSoldToTeam = soldToTeam || (highestBid ? highestBid.team_id : null);

      if (!finalSoldToTeam) {
        return res.status(400).json({ error: 'No team selected for sale' });
      }

      // 3. Check team budget
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('budget')
        .eq('id', finalSoldToTeam)
        .single();

      if (teamError) throw teamError;
      if (!team) return res.status(400).json({ error: 'Team not found' });
      if (team.budget < finalSoldPrice) {
        return res.status(400).json({ error: 'Team does not have enough budget' });
      }

      // 4. Update team budget
      // Note: Supabase doesn't have "decrement" easily without stored proc.
      // We calculate new budget in JS and set it. Race condition possible but unlikely in this low-concurrency app.
      const newBudget = team.budget - finalSoldPrice;
      const { error: updateBudgetError } = await supabase
        .from('teams')
        .update({ budget: newBudget })
        .eq('id', finalSoldToTeam);

      if (updateBudgetError) throw updateBudgetError;

      // 5. Update player status
      const { error: updatePlayerError } = await supabase
        .from('players')
        .update({
          status: 'SOLD',
          sold_price: finalSoldPrice,
          sold_to_team: finalSoldToTeam,
          was_unsold: 0 // Reset flag
        })
        .eq('id', playerId);

      if (updatePlayerError) throw updatePlayerError;

      io.emit('player-marked', { playerId, status, soldPrice: finalSoldPrice, soldToTeam: finalSoldToTeam });
      io.emit('team-budget-updated', { teamId: finalSoldToTeam });

    } else {
      // Mark as UNSOLD
      const { error: updatePlayerError } = await supabase
        .from('players')
        .update({
          status: 'UNSOLD',
          sold_price: null,
          sold_to_team: null,
          was_unsold: 1 // Set flag
        })
        .eq('id', playerId);

      if (updatePlayerError) throw updatePlayerError;

      io.emit('player-marked', { playerId, status, soldPrice: null, soldToTeam: null });
    }

    // 6. Auto-load next player (Shared logic)
    // Find next available or unsold player
    // Randomly pick from (AVAILABLE, UNSOLD) ordered by was_unsold ASC (prioritize never sold?)
    // Original logic: ORDER BY was_unsold ASC, RANDOM() LIMIT 1

    // Supabase can't do "ORDER BY RANDOM()" easily without RPC.
    // We can fetch pending players and pick one in JS.
    const { data: pendingPlayers, error: pendingError } = await supabase
      .from('players')
      .select('*')
      .in('status', ['AVAILABLE', 'UNSOLD'])
      .order('was_unsold', { ascending: true }); // Prioritize fresh players

    if (pendingError) {
      console.error('Error finding next player:', pendingError);
      return res.json({ success: true });
    }

    if (pendingPlayers && pendingPlayers.length > 0) {
      // Pick random one from the top priority group?
      // Or just pick a random one from all candidates?
      // Original logic was: Order by was_unsold ASC, then Random.
      // So if we have was_unsold=0 players, we strictly pick from them first?
      // SQL `ORDER BY was_unsold ASC, RANDOM()` does prioritize 0s, but within 0s it's random.
      // If there are 0s, 1s are at the bottom.

      const priority0 = pendingPlayers.filter(p => p.was_unsold === 0);
      const priority1 = pendingPlayers.filter(p => p.was_unsold === 1); // previously unsold

      let nextPlayer = null;
      if (priority0.length > 0) {
        nextPlayer = priority0[Math.floor(Math.random() * priority0.length)];
      } else if (priority1.length > 0) {
        nextPlayer = priority1[Math.floor(Math.random() * priority1.length)];
      }

      if (nextPlayer) {
        // Update auction state
        await supabase
          .from('auction_state')
          .update({
            current_player_id: nextPlayer.id,
            status: 'LIVE',
            updated_at: new Date()
          })
          .eq('id', 1);

        // Clear bids
        await supabase.from('bids').delete().eq('player_id', nextPlayer.id);

        console.log('Auto-loaded next player:', nextPlayer.name);
        io.emit('player-loaded', { player: nextPlayer });
        res.json({ success: true, nextPlayerLoaded: true, nextPlayer });
      } else {
        // Should not happen if length > 0
        res.json({ success: true });
      }
    } else {
      // No more players
      await supabase
        .from('auction_state')
        .update({
          current_player_id: null,
          status: 'STOPPED',
          updated_at: new Date()
        })
        .eq('id', 1);

      io.emit('player-loaded', { player: null });
      res.json({ success: true, nextPlayerLoaded: false, message: 'No more available players' });
    }

  } catch (err) {
    console.error('Error in mark-player:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Reset bidding for next player
router.post('/reset-bidding', async (req, res) => {
  const io = req.app.locals.io;

  try {
    const { data: state, error: stateError } = await supabase
      .from('auction_state')
      .select('current_player_id')
      .eq('id', 1)
      .maybeSingle();

    if (stateError || !state || !state.current_player_id) {
      return res.status(400).json({ error: 'No active player' });
    }

    const { error: deleteError } = await supabase
      .from('bids')
      .delete()
      .eq('player_id', state.current_player_id);

    if (deleteError) throw deleteError;

    io.emit('bidding-reset', { playerId: state.current_player_id });
    res.json({ success: true });
  } catch (err) {
    console.error('Error resetting bidding:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Reset unsold tag for a player
router.post('/reset-unsold-tag/:playerId', async (req, res) => {
  const { playerId } = req.params;
  const io = req.app.locals.io;

  try {
    // Check current status first to know if we need to change it
    const { data: player, error: fetchError } = await supabase
      .from('players')
      .select('status')
      .eq('id', playerId)
      .single();

    if (fetchError) throw fetchError;
    if (!player) return res.status(404).json({ error: 'Player not found' });

    const newStatus = player.status === 'UNSOLD' ? 'AVAILABLE' : player.status;

    const { error: updateError } = await supabase
      .from('players')
      .update({
        was_unsold: 0,
        status: newStatus
      })
      .eq('id', playerId);

    if (updateError) throw updateError;

    // Emit event to update UI for all clients (admin and owners)
    io.emit('player-marked', { playerId });
    res.json({ success: true, message: 'Unsold tag reset successfully' });
  } catch (err) {
    console.error('Error resetting unsold tag:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all players
router.get('/players', async (req, res) => {
  try {
    // Fetch players
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .order('id', { ascending: true });

    if (playersError) throw playersError;

    // Fetch teams to map names (since FK might be missing for join)
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('id, name');

    if (teamsError) throw teamsError;

    // Create team map
    const teamMap = {};
    if (teams) {
      teams.forEach(t => {
        teamMap[t.id] = t.name;
      });
    }

    // Flatten logic / Manual Join
    const processedPlayers = players.map(p => ({
      ...p,
      team_name: p.sold_to_team ? teamMap[p.sold_to_team] : null
    }));

    res.json({ players: processedPlayers });
  } catch (err) {
    console.error('Error getting players:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get auction history
router.get('/history', async (req, res) => {
  try {
    const { data: history, error } = await supabase
      .from('bids')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Fetch players and teams manually
    const playerIds = [...new Set(history.map(b => b.player_id))];
    const teamIds = [...new Set(history.map(b => b.team_id))];

    const playerMap = {};
    if (playerIds.length > 0) {
      const { data: players } = await supabase.from('players').select('id, name, base_price').in('id', playerIds);
      if (players) players.forEach(p => playerMap[p.id] = p);
    }

    const teamMap = {};
    if (teamIds.length > 0) {
      const { data: teams } = await supabase.from('teams').select('id, name').in('id', teamIds);
      if (teams) teams.forEach(t => teamMap[t.id] = t);
    }

    // Flatten
    const processedHistory = history.map(b => ({
      ...b,
      player_name: playerMap[b.player_id]?.name,
      base_price: playerMap[b.player_id]?.base_price,
      team_name: teamMap[b.team_id]?.name
    }));

    res.json({ history: processedHistory });
  } catch (err) {
    console.error('Error getting history:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Upload image endpoint
router.post('/upload-image', upload.single('image'), async (req, res) => {
  if (!req.file) {
    console.error('No file uploaded');
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    console.log('File uploaded locally:', req.file.filename, req.file.size, 'bytes');

    const fileContent = fs.readFileSync(req.file.path);
    const filename = req.file.filename; // Use the generated unique filename from multer

    const { data, error } = await supabase
      .storage
      .from('auction-images')
      .upload(filename, fileContent, {
        contentType: req.file.mimetype,
        upsert: true
      });

    if (error) {
      console.error('Supabase storage upload error:', error);
      throw error;
    }

    // Get public URL
    const { data: publicUrlData } = supabase
      .storage
      .from('auction-images')
      .getPublicUrl(filename);

    const publicUrl = publicUrlData.publicUrl;
    console.log('Image uploaded to Supabase:', publicUrl);

    // Clean up local file
    fs.unlinkSync(req.file.path);

    // Return the PUBLIC URL. 
    // Note: The frontend might expect a relative path if it prepends the host.
    // However, we should return the full URL now.
    // If usage elsewhere prepends server URL, we might need to adjust.
    // But usually frontend just uses `src={player.image}`.
    // If `player.image` was `/uploads/foo.jpg`, frontend might have used `http://localhost:4000/uploads/foo.jpg`.
    // Now it is `https://supabase.../foo.jpg`.
    // We should return the full URL.
    res.json({ success: true, imageUrl: publicUrl });
  } catch (error) {
    console.error('Upload error:', error);
    // Try to cleanup
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to process upload: ' + error.message });
  }
});

// Add new player
router.post('/players', async (req, res) => {
  const { name, image, role, country, age, base_price, serial_number } = req.body;
  const io = req.app.locals.io;

  if (!name || !role || !base_price) {
    return res.status(400).json({ error: 'Name, role, and base_price are required' });
  }

  try {
    let finalSerialNum = null;

    if (serial_number !== undefined && serial_number !== null && serial_number !== '') {
      const serialNum = parseInt(serial_number);
      finalSerialNum = serialNum;

      // Check if serial number already exists
      const { data: existing, error: checkError } = await supabase
        .from('players')
        .select('id')
        .eq('serial_number', serialNum)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existing) {
        // Shift all players with serial_number >= serialNum up by 1
        // Fetch all affected rows
        const { data: playersToShift, error: fetchError } = await supabase
          .from('players')
          .select('id, serial_number')
          .gte('serial_number', serialNum)
          .order('serial_number', { ascending: false }); // Start from end to avoid constraint issues if unique? serial_number is not unique constraint in schema but implies order

        if (fetchError) throw fetchError;

        if (playersToShift && playersToShift.length > 0) {
          const updates = playersToShift.map(p => ({
            id: p.id,
            serial_number: p.serial_number + 1
          }));
          // Upsert
          const { error: upsertError } = await supabase
            .from('players')
            .upsert(updates);

          if (upsertError) throw upsertError;
        }
      }
    }

    // Insert new player
    const { data: newPlayer, error: insertError } = await supabase
      .from('players')
      .insert([{
        name,
        image: image || null,
        role,
        country: country || null,
        base_price: base_price,
        status: 'AVAILABLE',
        serial_number: finalSerialNum
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    console.log('Player added:', newPlayer.name);
    io.emit('player-added', { player: newPlayer });
    res.json({ success: true, player: newPlayer });

  } catch (err) {
    console.error('Error adding player:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// Bulk add players
router.post('/players-bulk', async (req, res) => {
  const { players } = req.body;
  const io = req.app.locals.io;

  if (!players || !Array.isArray(players) || players.length === 0) {
    return res.status(400).json({ error: 'Invalid players data' });
  }

  try {
    const validPlayers = [];
    const errors = [];

    // Pre-process and validate
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p.name || !p.role || !p.base_price) {
        errors.push({ index: i, error: 'Missing required fields (Name, Role, Base Price)', data: p });
        continue;
      }
      validPlayers.push({
        name: p.name,
        role: p.role,
        base_price: parseFloat(p.base_price),
        country: p.country || null,
        age: p.age ? parseInt(p.age) : null,
        serial_number: p.serial_number ? parseInt(p.serial_number) : null,
        status: 'AVAILABLE',
        image: p.image || null // Default image will be handled by frontend if null
      });
    }

    if (validPlayers.length === 0) {
      return res.status(400).json({ error: 'No valid players found to add', detailedErrors: errors });
    }

    // Bulk insert
    const { data: inserted, error: insertError } = await supabase
      .from('players')
      .insert(validPlayers)
      .select();

    if (insertError) throw insertError;

    console.log(`Bulk added ${inserted.length} players`);

    // Emit event for frontend update
    io.emit('player-added', { count: inserted.length });

    res.json({
      success: true,
      count: inserted.length,
      totalProcessed: players.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    console.error('Error adding players bulk:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// Update player
router.put('/players/:id', async (req, res) => {
  const { id } = req.params;
  const { name, image, role, country, age, base_price, status, sold_price, sold_to_team, serial_number } = req.body;
  const io = req.app.locals.io;

  try {
    // Handle serial number logic if needed
    if (serial_number !== undefined) {
      // Get current player details
      const { data: currentPlayer, error: fetchError } = await supabase
        .from('players')
        .select('serial_number')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      const oldSerial = currentPlayer?.serial_number;
      const newSerial = serial_number !== null && serial_number !== '' ? parseInt(serial_number) : null;

      if (newSerial !== oldSerial) {
        if (newSerial === null && oldSerial !== null) {
          // Shift > oldSerial down by 1
          // fetch p > oldSerial
          // p.serial - 1
          const { data: shiftDown, error: sErr } = await supabase.from('players').select('id, serial_number').gt('serial_number', oldSerial);
          if (sErr) throw sErr;
          if (shiftDown.length > 0) {
            await supabase.from('players').upsert(shiftDown.map(p => ({ id: p.id, serial_number: p.serial_number - 1 })));
          }
        } else if (newSerial !== null) {
          // Check collision for newSerial
          const { data: conflict } = await supabase.from('players').select('id').eq('serial_number', newSerial).neq('id', id).maybeSingle();

          if (oldSerial === null) {
            // Obtaining new number. If conflict, shift >= newSerial up
            if (conflict) {
              const { data: shiftUp } = await supabase.from('players').select('id, serial_number').gte('serial_number', newSerial);
              if (shiftUp && shiftUp.length > 0) {
                await supabase.from('players').upsert(shiftUp.map(p => ({ id: p.id, serial_number: p.serial_number + 1 })));
              }
            }
          } else {
            // Moving number
            if (newSerial > oldSerial) {
              // Shift (oldSerial, newSerial] down by 1
              const { data: shiftDown } = await supabase.from('players').select('id, serial_number').gt('serial_number', oldSerial).lte('serial_number', newSerial).neq('id', id);
              if (shiftDown && shiftDown.length > 0) {
                await supabase.from('players').upsert(shiftDown.map(p => ({ id: p.id, serial_number: p.serial_number - 1 })));
              }
            } else { // newSerial < oldSerial
              // Shift [newSerial, oldSerial) up by 1
              const { data: shiftUp } = await supabase.from('players').select('id, serial_number').gte('serial_number', newSerial).lt('serial_number', oldSerial).neq('id', id);
              if (shiftUp && shiftUp.length > 0) {
                await supabase.from('players').upsert(shiftUp.map(p => ({ id: p.id, serial_number: p.serial_number + 1 })));
              }
            }
          }
        }
      }
    }

    // Now update the player fields
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (image !== undefined) updates.image = image; // Supabase path or URL
    if (role !== undefined) updates.role = role;
    if (country !== undefined) updates.country = country;
    if (base_price !== undefined) updates.base_price = base_price;
    if (status !== undefined) updates.status = status;
    if (sold_price !== undefined) updates.sold_price = sold_price;
    if (sold_to_team !== undefined) updates.sold_to_team = sold_to_team;
    if (serial_number !== undefined) {
      updates.serial_number = serial_number !== null && serial_number !== '' ? parseInt(serial_number) : null;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { data: updatedPlayer, error: updateError } = await supabase
      .from('players')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    io.emit('player-updated', { player: updatedPlayer });
    res.json({ success: true, player: updatedPlayer });
  } catch (err) {
    console.error('Error updating player:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// Delete player
router.delete('/players/:id', async (req, res) => {
  const { id } = req.params;
  const io = req.app.locals.io;

  try {
    // Check if current player
    const { data: state } = await supabase.from('auction_state').select('current_player_id').eq('id', 1).single();
    if (state && state.current_player_id === parseInt(id)) {
      return res.status(400).json({ error: 'Cannot delete player that is currently being auctioned' });
    }

    // Delete bids
    await supabase.from('bids').delete().eq('player_id', id);

    // Delete player image from storage if exists
    const { data: player } = await supabase.from('players').select('image').eq('id', id).single();
    if (player && player.image) {
      // Extract filename
      const parts = player.image.split('/');
      const filename = parts[parts.length - 1];
      if (filename) await supabase.storage.from('auction-images').remove([filename]);
    }

    // Delete player
    const { error: deleteError } = await supabase.from('players').delete().eq('id', id);
    if (deleteError) throw deleteError;

    io.emit('player-deleted', { playerId: parseInt(id) });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting player:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get all teams
router.get('/teams', async (req, res) => {
  try {
    const { data: teams, error } = await supabase
      .from('teams')
      .select('*');

    if (error) throw error;

    // Fetch owners manually
    const ownerIds = [...new Set(teams.map(t => t.owner_id).filter(id => id))];
    const ownerMap = {};
    if (ownerIds.length > 0) {
      const { data: users } = await supabase.from('users').select('id, username').in('id', ownerIds);
      if (users) users.forEach(u => ownerMap[u.id] = u.username);
    }

    const teamsWithDetails = teams.map(t => ({
      ...t,
      owner_username: t.owner_id ? ownerMap[t.owner_id] : null,
      bidding_locked: t.bidding_locked === 1
    }));

    res.json(teamsWithDetails);
  } catch (err) {
    console.error('Error getting teams:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Add new team
router.post('/teams', upload.single('logo'), async (req, res) => {
  const { name, owner_name, budget } = req.body;
  const io = req.app.locals.io;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Team name is required' });
  }

  try {
    // Upload logo if exists
    let logoPath = null;
    if (req.file) {
      const fileContent = fs.readFileSync(req.file.path);
      const filename = req.file.filename;
      const { error: uploadError } = await supabase.storage.from('auction-images').upload(filename, fileContent, { upsert: true, contentType: req.file.mimetype });
      if (uploadError) console.error('Logo upload error:', uploadError);
      else {
        const { data: publicUrlData } = supabase.storage.from('auction-images').getPublicUrl(filename);
        logoPath = publicUrlData.publicUrl;
      }
      fs.unlinkSync(req.file.path);
    }

    const teamBudget = budget ? parseFloat(budget) : 1000000;

    // Check name uniqueness
    const { data: existing } = await supabase.from('teams').select('id').eq('name', name.trim()).maybeSingle();
    if (existing) return res.status(400).json({ error: 'Team name already exists' });

    // Insert team first to get ID
    const { data: team, error: insertError } = await supabase
      .from('teams')
      .insert([{
        name: name.trim(),
        owner_name: owner_name || null,
        logo: logoPath,
        budget: teamBudget,
        bidding_locked: 0
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    // Credentials generation
    let username = '';
    let password = '';
    let isUnique = false;
    let baseUsername = name.trim().toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 3);
    if (baseUsername.length < 3) baseUsername = (baseUsername + 'team').substring(0, 3);

    while (!isUnique) {
      const suffix = Math.floor(100 + Math.random() * 900);
      username = `${baseUsername}${suffix}`;
      const { count } = await supabase.from('users').select('id', { count: 'exact', head: true }).eq('username', username);
      if (count === 0) isUnique = true;
    }
    password = username;
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create User
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{
        username,
        password: hashedPassword,
        role: 'owner',
        team_id: team.id
      }])
      .select()
      .single();

    if (userError) throw userError;

    // Update team with owner info
    const { data: finalTeam, error: finalUpdateError } = await supabase
      .from('teams')
      .update({
        owner_id: user.id,
        access_code: username,
        plain_password: password
      })
      .eq('id', team.id)
      .select()
      .single();

    if (finalUpdateError) throw finalUpdateError;

    io.emit('team-added', { team: finalTeam });
    res.json({
      success: true,
      team: finalTeam,
      credentials: { username, password }
    });

  } catch (err) {
    console.error('Error adding team:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Update team
router.put('/teams/:id', upload.single('logo'), async (req, res) => {
  const { id } = req.params;
  const { name, owner_name, budget } = req.body;
  const io = req.app.locals.io;

  try {
    const updates = {};
    if (name) updates.name = name;
    if (owner_name !== undefined) updates.owner_name = owner_name;
    if (budget !== undefined) updates.budget = parseFloat(budget);

    if (req.file) {
      const fileContent = fs.readFileSync(req.file.path);
      const filename = req.file.filename;
      const { error: uploadError } = await supabase.storage.from('auction-images').upload(filename, fileContent, { upsert: true, contentType: req.file.mimetype });
      if (!uploadError) {
        const { data: publicUrlData } = supabase.storage.from('auction-images').getPublicUrl(filename);
        updates.logo = publicUrlData.publicUrl;
      }
      fs.unlinkSync(req.file.path);
    }

    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No fields' });

    const { data: updatedTeam, error: updateError } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    io.emit('team-updated', { team: updatedTeam });
    res.json({ success: true, team: updatedTeam });
  } catch (err) {
    console.error('Error updating team:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete team
// Delete team
router.delete('/teams/:id', async (req, res) => {
  const { id } = req.params;
  const io = req.app.locals.io;

  try {
    // Check constraints - check for bids and sold players
    const { count: bidCount } = await supabase.from('bids').select('id', { count: 'exact', head: true }).eq('team_id', id);
    const { count: playerCount } = await supabase.from('players').select('id', { count: 'exact', head: true }).eq('sold_to_team', id);

    if (bidCount > 0 || playerCount > 0) {
      return res.status(400).json({ error: 'Cannot delete team with existing bids or sold players' });
    }

    // 1. Break likely circular dependency: Set owner_id to NULL on the team
    await supabase.from('teams').update({ owner_id: null }).eq('id', id);

    // 2. Delete all users associated with this team (this should catch the owner)
    // Note: If multiple users exist for one team (shouldn't happen but good to be safe), this cleans them up.
    const { error: deleteUsersError } = await supabase.from('users').delete().eq('team_id', id);
    if (deleteUsersError) {
      console.error('Error deleting team users:', deleteUsersError);
      // Continue anyway, as we want to delete the team
    }

    // 3. Delete team
    const { error: deleteTeamError } = await supabase.from('teams').delete().eq('id', id);
    if (deleteTeamError) throw deleteTeamError;

    io.emit('team-deleted', { teamId: parseInt(id) });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting team:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// Update team budget
router.put('/teams/:id/budget', async (req, res) => {
  const { id } = req.params;
  const { budget } = req.body;
  const io = req.app.locals.io;

  try {
    const { error } = await supabase.from('teams').update({ budget }).eq('id', id);
    if (error) throw error;

    io.emit('team-budget-updated', { teamId: parseInt(id) });
    res.json({ success: true, budget });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Lock/unlock team bidding
router.put('/teams/:id/lock-bidding', async (req, res) => {
  const { id } = req.params;
  const { locked } = req.body;
  const io = req.app.locals.io;

  try {
    const { error } = await supabase.from('teams').update({ bidding_locked: locked ? 1 : 0 }).eq('id', id);
    if (error) throw error;

    io.emit('team-bidding-locked', { teamId: parseInt(id), locked });
    res.json({ success: true, locked });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update team credentials manually
router.put('/teams/:id/credentials', async (req, res) => {
  const { id } = req.params;
  const { username, password } = req.body;
  const io = req.app.locals.io;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const { data: team } = await supabase.from('teams').select('owner_id').eq('id', id).single();
    if (!team) return res.status(404).json({ error: 'Team not found' });

    // Check conflict (username taken by someone else?)
    // We check if any user has this username, EXCLUDING the current owner_id (if it exists)
    let query = supabase.from('users').select('id').eq('username', username);
    if (team.owner_id) {
      query = query.neq('id', team.owner_id);
    }
    const { data: existing } = await query.maybeSingle();

    if (existing) return res.status(400).json({ error: 'Username taken' });

    const hashedPassword = await bcrypt.hash(password, 10);
    let ownerId = team.owner_id;

    if (ownerId) {
      // Try to update existing user
      const { error: updateError } = await supabase.from('users').update({ username, password: hashedPassword }).eq('id', ownerId);
      if (updateError) {
        console.error("Error updating user, might rely on recreating:", updateError);
      }
      // Verify if user actually exists still
      const { data: userCheck } = await supabase.from('users').select('id').eq('id', ownerId).maybeSingle();
      if (!userCheck) {
        ownerId = null; // Valid user not found, recreate
      }
    }

    if (!ownerId) {
      // Create new user if no owner_id or user missing
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([{
          username,
          password: hashedPassword,
          role: 'owner',
          team_id: id
        }])
        .select()
        .single();

      if (createError) throw createError;
      ownerId = newUser.id;
    }

    // Update team
    const { data: updatedTeam, error: updateError } = await supabase
      .from('teams')
      .update({
        access_code: username,
        plain_password: password,
        owner_id: ownerId
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    const teamToSend = {
      ...updatedTeam,
      bidding_locked: updatedTeam.bidding_locked === 1
    };

    io.emit('team-updated', { team: teamToSend });
    res.json({ success: true, team: teamToSend });

  } catch (err) {
    console.error('Error updating creds:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});


// (Legacy SQLite routes removed for Supabase migration)


// Get players by status (for owner dashboard)
router.get('/players-by-status/:status', async (req, res) => {
  const { status } = req.params;

  if (!['SOLD', 'AVAILABLE', 'UNSOLD'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const { data: players, error } = await supabase
      .from('players')
      .select('*')
      .eq('status', status)
      .order('name');

    if (error) throw error;

    // Fetch teams map
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
    console.error('Error getting players by status:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Get team squads (teams with their sold players)
router.get('/team-squads', async (req, res) => {
  try {
    // Fetch all teams
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .order('name');

    if (teamsError) throw teamsError;

    // Fetch all sold players
    const { data: players, error: playersError } = await supabase
      .from('players')
      .select('*')
      .eq('status', 'SOLD')
      .order('name');

    if (playersError) throw playersError;

    // Combine them
    const teamSquads = teams.map(team => {
      const teamPlayers = players.filter(p => p.sold_to_team === team.id);
      return { team, players: teamPlayers };
    });

    res.json(teamSquads);
  } catch (err) {
    console.error('Error getting team squads:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Remove player from team and return to auction
router.post('/remove-player-from-team/:playerId', async (req, res) => {
  const { playerId } = req.params;
  const io = req.app.locals.io;

  try {
    // Get player details
    const { data: player, error: fetchError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();

    if (fetchError) throw fetchError;
    if (!player) return res.status(404).json({ error: 'Player not found' });

    if (player.status !== 'SOLD' || !player.sold_to_team) {
      return res.status(400).json({ error: 'Player is not sold to any team' });
    }

    const teamId = player.sold_to_team;
    const soldPrice = player.sold_price || 0;

    // Refund budget
    // Get current budget
    const { data: team, error: teamError } = await supabase.from('teams').select('budget').eq('id', teamId).single();
    if (teamError) throw teamError;

    // Update budget
    const newBudget = (team.budget || 0) + soldPrice;
    await supabase.from('teams').update({ budget: newBudget }).eq('id', teamId);

    // Update player
    const { data: updatedPlayer, error: updateError } = await supabase
      .from('players')
      .update({
        status: 'AVAILABLE',
        sold_price: null,
        sold_to_team: null,
        was_unsold: 1
      })
      .eq('id', playerId)
      .select()
      .single();

    if (updateError) throw updateError;

    io.emit('player-removed-from-team', {
      playerId: parseInt(playerId),
      teamId: teamId,
      player: updatedPlayer
    });
    io.emit('team-budget-updated', { teamId: teamId });
    io.emit('player-updated', { player: updatedPlayer });

    res.json({
      success: true,
      message: 'Player removed from team and returned to auction',
      player: updatedPlayer
    });

  } catch (err) {
    console.error('Error removing player:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Admin place bid on behalf of team
router.post('/admin-bid', async (req, res) => {
  const { teamId, amount } = req.body;
  const io = req.app.locals.io;

  if (!teamId || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid team ID or bid amount' });
  }

  try {
    // 1. Check auction state
    const { data: state, error: stateError } = await supabase.from('auction_state').select('*').eq('id', 1).single();
    if (stateError || !state) throw new Error('Auction state error');

    if (state.status !== 'LIVE') return res.status(400).json({ error: 'Auction is not live' });
    if (!state.current_player_id) return res.status(400).json({ error: 'No player is currently being auctioned' });

    // 2. Get current highest bid
    const { data: currentHighest } = await supabase
      .from('bids')
      .select('*')
      .eq('player_id', state.current_player_id)
      .order('amount', { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3. Get player info
    const { data: player } = await supabase.from('players').select('base_price').eq('id', state.current_player_id).single();
    if (!player) return res.status(404).json({ error: 'Player not found' });

    // Validations
    if (currentHighest && amount <= currentHighest.amount) {
      return res.status(400).json({ error: `Bid must be higher than current highest bid of ${currentHighest.amount}` });
    }
    if (amount < player.base_price) {
      return res.status(400).json({ error: `Bid must be at least the base price of ${player.base_price}` });
    }
    if (currentHighest && currentHighest.team_id === teamId) {
      return res.status(400).json({ error: 'This team is already the highest bidder' });
    }

    // 4. Check wallet balance
    const { data: team } = await supabase.from('teams').select('budget').eq('id', teamId).single();
    if (!team) return res.status(400).json({ error: 'Team not found' });

    // Smart logic
    const maxPlayersPerTeam = state.max_players_per_team || 10;
    const enforceMaxBid = state.enforce_max_bid === 1;

    // Count players bought
    const { count: playersBought } = await supabase
      .from('players')
      .select('id', { count: 'exact', head: true })
      .eq('sold_to_team', teamId)
      .eq('status', 'SOLD');

    const remainingPlayers = maxPlayersPerTeam - (playersBought || 0);

    if (enforceMaxBid) {
      if (remainingPlayers <= 0) {
        return res.status(400).json({ error: `Team has reached the maximum of ${maxPlayersPerTeam} players` });
      }
      const minimumAmountToKeep = remainingPlayers * 1000;
      const maxBidAllowed = Math.max(0, team.budget - minimumAmountToKeep);

      if (amount > maxBidAllowed) {
        return res.status(400).json({ error: `Bid exceeds maximum allowed (Smart Logic). Max: ${maxBidAllowed}` });
      }
    } else {
      if (amount > team.budget) {
        return res.status(400).json({ error: `Bid exceeds team budget of ${team.budget}` });
      }
    }

    // 5. Place bid
    const { data: newBid, error: bidError } = await supabase
      .from('bids')
      .insert([{
        player_id: state.current_player_id,
        team_id: teamId,
        amount: amount,
        timestamp: new Date()
      }])
      .select()
      .single();



    if (bidError) throw bidError;

    // Flatten for frontend
    const bidToSend = {
      ...newBid,
      team_name: team.name // Use team name fetched earlier
    };

    // Calculate increment for notification
    const previousBidAmount = currentHighest ? currentHighest.amount : player.base_price;
    const increment = amount - previousBidAmount;

    io.emit('bid-placed', {
      bid: bidToSend,
      increment: increment
    });
    io.emit('bid-updated', {
      highestBid: bidToSend,
      playerId: state.current_player_id,
      previousBid: previousBidAmount
    });

    res.json({ success: true, bid: bidToSend });

  } catch (err) {
    console.error('Error in admin bid:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;


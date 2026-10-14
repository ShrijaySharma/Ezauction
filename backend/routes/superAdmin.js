import express from 'express';
import bcrypt from 'bcrypt';
import { supabase } from '../supabaseClient.js';
import { requireSuperAdmin } from '../middleware/auth.js';
import { refreshAuctionState, clearAdminAnonymousBid, resetTradingWindowState } from '../auctionState.js';

const router = express.Router();

// Helper: generate a random alphanumeric password
function generatePassword(len = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pass = '';
  for (let i = 0; i < len; i++) pass += chars[Math.floor(Math.random() * chars.length)];
  return pass;
}

// ── Super Admin Login ──────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('role', 'super_admin')
      .maybeSingle();

    if (error) throw error;
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = 'super_admin';

    res.json({ success: true, user: { id: user.id, username: user.username, role: 'super_admin' } });
  } catch (err) {
    console.error('Super admin login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// All routes below require super_admin session
router.use(requireSuperAdmin);

// ── Create Auction ─────────────────────────────────────────────────────────────
router.post('/auctions', async (req, res) => {
  const { id, name } = req.body;

  if (!id || !name) return res.status(400).json({ error: 'Auction ID and name are required' });

  // Validate slug: lowercase alphanumeric + hyphens only, 3-30 chars
  if (!/^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(id)) {
    return res.status(400).json({ error: 'Auction ID must be 3-30 chars, lowercase letters, numbers, and hyphens only (no leading/trailing hyphens)' });
  }

  try {
    // Check uniqueness
    const { data: existing } = await supabase.from('auctions').select('id').eq('id', id).maybeSingle();
    if (existing) return res.status(409).json({ error: 'Auction ID already exists. Choose a different one.' });

    // Generate admin credentials
    const adminUsername = `admin_${id}`;
    const plainPassword = generatePassword(10);
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    // Insert auction
    const { error: auctionError } = await supabase.from('auctions').insert([{
      id,
      name,
      admin_username: adminUsername,
      admin_password: hashedPassword,
      status: 'active'
    }]);
    if (auctionError) throw auctionError;

    // Insert admin user for this auction
    const { error: userError } = await supabase.from('users').insert([{
      username: adminUsername,
      password: hashedPassword,
      role: 'admin',
      auction_id: id
    }]);
    if (userError) {
      await supabase.from('auctions').delete().eq('id', id);
      throw userError;
    }

    // Initialize auction_state row for this auction
    const { error: stateError } = await supabase.from('auction_state').insert([{
      auction_id: id,
      status: 'STOPPED',
      current_player_id: null,
      bidding_locked: 0,
      bid_increment_1: 500,
      bid_increment_2: 1000,
      bid_increment_3: 5000,
      max_players_per_team: 10,
      enforce_max_bid: 0,
      sequential_mode: 0,
      sequential_last_serial: null
    }]);
    if (stateError) {
      // Clean up orphaned auction and user records if auction_state failed
      await supabase.from('users').delete().eq('username', adminUsername).eq('auction_id', id);
      await supabase.from('auctions').delete().eq('id', id);
      throw stateError;
    }

    res.json({
      success: true,
      auction: { id, name, status: 'active' },
      credentials: {
        adminUsername,
        adminPassword: plainPassword // Shown ONCE, not stored in plain text
      }
    });
  } catch (err) {
    console.error('Error creating auction:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// ── List All Auctions ──────────────────────────────────────────────────────────
router.get('/auctions', async (req, res) => {
  try {
    const { data: auctions, error } = await supabase
      .from('auctions')
      .select('id, name, status, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(auctions);
  } catch (err) {
    console.error('Error listing auctions:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Get Single Auction (for links panel) ──────────────────────────────────────
router.get('/auctions/:auctionId', async (req, res) => {
  try {
    const { data: auction, error } = await supabase
      .from('auctions')
      .select('id, name, status, admin_username, created_at')
      .eq('id', req.params.auctionId)
      .single();

    if (error || !auction) return res.status(404).json({ error: 'Auction not found' });
    res.json(auction);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Archive / Restore Auction ──────────────────────────────────────────────────
router.patch('/auctions/:auctionId/status', async (req, res) => {
  const { status } = req.body;
  if (!['active', 'archived'].includes(status)) return res.status(400).json({ error: 'Status must be active or archived' });

  try {
    const { error } = await supabase
      .from('auctions')
      .update({ status })
      .eq('id', req.params.auctionId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Reset Auction Data (wipe players/teams/bids, keep auction + creds) ─────────
router.post('/auctions/:auctionId/reset', async (req, res) => {
  const auctionId = req.params.auctionId;
  try {
    // Clean up in FK-safe order:
    // 1. Decouple current player from auction_state first to satisfy FK constraints
    await supabase.from('auction_state').update({
      status: 'STOPPED',
      current_player_id: null,
      bidding_locked: 0,
      sequential_last_serial: null
    }).eq('auction_id', auctionId);

    // 2. Detach owners from teams to break circular dependency
    await supabase.from('teams').update({ owner_id: null }).eq('auction_id', auctionId);

    // 3. Delete dependent child records
    await supabase.from('bids').delete().eq('auction_id', auctionId);
    await supabase.from('trades').delete().eq('auction_id', auctionId);
    await supabase.from('users').delete().eq('auction_id', auctionId).eq('role', 'owner');

    // 4. Delete players and teams
    await supabase.from('players').delete().eq('auction_id', auctionId);
    await supabase.from('teams').delete().eq('auction_id', auctionId);

    clearAdminAnonymousBid(auctionId);
    resetTradingWindowState(auctionId);
    await refreshAuctionState(auctionId);

    res.json({ success: true, message: 'Auction data reset. Credentials preserved.' });
  } catch (err) {
    console.error('Reset error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Regenerate Admin Credentials ───────────────────────────────────────────────
router.post('/auctions/:auctionId/regen-creds', async (req, res) => {
  const auctionId = req.params.auctionId;
  try {
    const { data: auction } = await supabase.from('auctions').select('admin_username').eq('id', auctionId).single();
    if (!auction) return res.status(404).json({ error: 'Auction not found' });

    const plainPassword = generatePassword(10);
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    await supabase.from('auctions').update({ admin_password: hashedPassword }).eq('id', auctionId);
    await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('username', auction.admin_username)
      .eq('auction_id', auctionId);

    res.json({
      success: true,
      credentials: { adminUsername: auction.admin_username, adminPassword: plainPassword }
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Delete Auction (Direct delete with complete cleanup) ───────────────────────
router.delete('/auctions/:auctionId', async (req, res) => {
  const auctionId = req.params.auctionId;
  try {
    const { data: auction } = await supabase.from('auctions').select('id, admin_username').eq('id', auctionId).maybeSingle();
    if (!auction) return res.status(404).json({ error: 'Auction not found' });

    // Clean up all related tables in foreign-key safe order:
    // 1. Delete auction_state (removes FK reference to players)
    await supabase.from('auction_state').delete().eq('auction_id', auctionId);
    // 2. Break circular FK between teams and users
    await supabase.from('teams').update({ owner_id: null }).eq('auction_id', auctionId);
    // 3. Delete dependent rows
    await supabase.from('bids').delete().eq('auction_id', auctionId);
    await supabase.from('trades').delete().eq('auction_id', auctionId);
    await supabase.from('users').delete().eq('auction_id', auctionId);
    // 4. Delete players and teams
    await supabase.from('players').delete().eq('auction_id', auctionId);
    await supabase.from('teams').delete().eq('auction_id', auctionId);

    const { error } = await supabase.from('auctions').delete().eq('id', auctionId);
    if (error) throw error;
    clearAdminAnonymousBid(auctionId);
    resetTradingWindowState(auctionId);
    res.json({ success: true, message: `Auction ${auctionId} deleted successfully.` });
  } catch (err) {
    console.error('Delete auction error:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

export default router;

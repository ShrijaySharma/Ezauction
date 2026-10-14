
import express from 'express';
import bcrypt from 'bcrypt';
import { supabase } from '../supabaseClient.js';

const router = express.Router({ mergeParams: true });

// Login endpoint
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const targetAuctionId = req.params.auctionId || req.body.auctionId || null;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    // Normal users must enter through a tenant link. Super-admin authentication
    // is deliberately kept on its separate endpoint.
    if (!targetAuctionId) {
      return res.status(400).json({ error: 'Auction ID is required. Use the auction-specific login link.' });
    }

    const { data: auction, error: auctionError } = await supabase
      .from('auctions')
      .select('id, status')
      .eq('id', targetAuctionId)
      .maybeSingle();

    if (auctionError) throw auctionError;
    if (!auction || auction.status !== 'active') {
      return res.status(404).json({ error: 'This auction is unavailable' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('auction_id', targetAuctionId)
      .maybeSingle();

    if (error) {
      console.error('Database error during login:', error);
      return res.status(500).json({ error: 'Database error: ' + error.message });
    }

    if (!user) {
      console.log('Login attempt failed: User not found -', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.log('Login attempt failed: Invalid password for user -', username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Map team data manually
    let teamName = null;
    const teamId = user.team_id;

    if (teamId) {
      const { data: team } = await supabase
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .eq('auction_id', targetAuctionId)
        .maybeSingle();

      if (team) teamName = team.name;
    }

    const userAuctionId = user.auction_id;

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.teamId = teamId;
    req.session.auctionId = userAuctionId;

    console.log('Login successful:', user.username, 'Role:', user.role, 'AuctionId:', userAuctionId);

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        teamId: teamId,
        teamName: teamName,
        auctionId: userAuctionId
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Authentication error' });
  }
});

// Logout endpoint
router.post('/logout', (req, res) => {
  const sessionCookieName = req.session.cookie?.name || 'connect.sid';

  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    // Clear the session cookie
    res.clearCookie(sessionCookieName, {
      path: '/',
      httpOnly: true,
      secure: false
    });
    res.json({ success: true });
  });
});

// Check session endpoint
router.get('/me', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.session.userId)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const userAuctionId = user.auction_id || req.session.auctionId || null;
    const routeAuctionId = req.params.auctionId || req.session.auctionId || null;
    if (routeAuctionId && user.role !== 'super_admin' && userAuctionId !== routeAuctionId) {
      return res.status(403).json({ error: 'Access denied: auction scope mismatch' });
    }

    // Map team data manually
    let teamName = null;
    const teamId = user.team_id;

    if (teamId) {
      const { data: team } = await supabase
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .eq('auction_id', userAuctionId)
        .maybeSingle();

      if (team) teamName = team.name;
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        teamId: teamId,
        teamName: teamName,
        auctionId: userAuctionId
      }
    });
  } catch (err) {
    console.error('Session check error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;


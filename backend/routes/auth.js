
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
    let user;

    if (!targetAuctionId) {
      // Look up user by username across all accounts
      const { data: matchedUsers, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username);

      if (userError) throw userError;

      if (!matchedUsers || matchedUsers.length === 0) {
        console.log('Login attempt failed: User not found -', username);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (matchedUsers.length > 1) {
        return res.status(400).json({ error: 'Multiple accounts match this username. Please use your auction-specific login link.' });
      }

      user = matchedUsers[0];

      // If user belongs to an auction, check that the auction exists and is active
      if (user.auction_id) {
        const { data: auction } = await supabase
          .from('auctions')
          .select('id, status')
          .eq('id', user.auction_id)
          .maybeSingle();

        if (!auction || auction.status !== 'active') {
          return res.status(404).json({ error: 'This auction is currently unavailable or archived' });
        }
      }
    } else {
      // Validate auction exists and is active
      const { data: auction, error: auctionError } = await supabase
        .from('auctions')
        .select('id, status')
        .eq('id', targetAuctionId)
        .maybeSingle();

      if (auctionError) throw auctionError;
      if (!auction || auction.status !== 'active') {
        return res.status(404).json({ error: 'This auction is unavailable' });
      }

      // Check for user in this auction, or allow super_admin
      let { data: matchedUser, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('username', username)
        .eq('auction_id', targetAuctionId)
        .maybeSingle();

      if (userError) {
        console.error('Database error during login:', userError);
        return res.status(500).json({ error: 'Database error: ' + userError.message });
      }

      if (!matchedUser) {
        const { data: saUser, error: saError } = await supabase
          .from('users')
          .select('*')
          .eq('username', username)
          .eq('role', 'super_admin')
          .maybeSingle();

        if (saError) {
          console.error('Database error checking super_admin during login:', saError);
          return res.status(500).json({ error: 'Database error: ' + saError.message });
        }
        matchedUser = saUser;
      }
      user = matchedUser;
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

    if (teamId && user.auction_id) {
      const { data: team } = await supabase
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .eq('auction_id', user.auction_id)
        .maybeSingle();

      if (team) teamName = team.name;
    }

    const userAuctionId = user.auction_id || null;

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


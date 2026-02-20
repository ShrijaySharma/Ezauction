
import express from 'express';
import bcrypt from 'bcrypt';
import { supabase } from '../supabaseClient.js';

const router = express.Router();

// Login endpoint
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
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
    const teamId = user.team_id; // Using foreign key directly

    if (teamId) {
      const { data: team } = await supabase
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .maybeSingle();

      if (team) teamName = team.name;
    }

    // Set session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.role = user.role;
    req.session.teamId = teamId;

    console.log('Login successful:', user.username, 'Role:', user.role);

    res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        teamId: teamId,
        teamName: teamName
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

    // Map team data manually
    let teamName = null;
    const teamId = user.team_id;

    if (teamId) {
      const { data: team } = await supabase
        .from('teams')
        .select('name')
        .eq('id', teamId)
        .maybeSingle();

      if (team) teamName = team.name;
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        teamId: teamId,
        teamName: teamName
      }
    });
  } catch (err) {
    console.error('Session check error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;


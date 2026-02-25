import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import session from 'express-session';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import ownerRoutes from './routes/owner.js';
import hostRoutes from './routes/host.js';
import appOwnerRoutes from './routes/appOwner.js';
import { supabase } from './supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => {
      // Allow all origins for local network access
      callback(null, true);
    },
    credentials: true
  }
});

const PORT = process.env.PORT || 4000;

// Middleware - Allow all origins for local network access
app.use(cors({
  origin: true, // Allow all origins for local network
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded images (Keep for backward compatibility if any local files remain, though we use Supabase now)
app.use('/uploads', express.static(join(__dirname, 'uploads')));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ message: 'EzAuction Server is running!' });
});

// Trust proxy (required for Render/Heroku SSL)
app.set('trust proxy', 1);

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'cricket-auction-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Only secure in production
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // Lax for local development
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Make io available to routes
app.locals.io = io;

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/host', hostRoutes);
app.use('/api/app-owner', appOwnerRoutes);

// Image proxy to bypass ISP DNS blocks in India (e.g. Reliance Jio blocking *.supabase.co)
app.get('/api/proxy-image', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl) {
    return res.status(400).send('URL query parameter is required');
  }

  try {
    // We fetch the image from Supabase via Render's backend (which isn't blocked by Jio)
    const response = await fetch(imageUrl);

    if (!response.ok) {
      return res.status(response.status).send('Failed to fetch image from Supabase');
    }

    // Set exactly the same headers the image should have
    res.setHeader('Content-Type', response.headers.get('content-type') || 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year

    // Stream the image directly to the client's browser using arrayBuffer
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).send('Internal Server Error while proxying image');
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  // Handle request for initial state (e.g. from Overlay)
  socket.on('request-info', async () => {
    try {
      const { data: state } = await supabase
        .from('auction_state')
        .select('current_player_id')
        .eq('id', 1)
        .maybeSingle();

      if (state && state.current_player_id) {
        // Fetch player
        const { data: player } = await supabase
          .from('players')
          .select('*')
          .eq('id', state.current_player_id)
          .single();

        if (player) {
          socket.emit('player-loaded', { player });

          // Fetch highest bid for this player
          const { data: bid } = await supabase
            .from('bids')
            .select('*')
            .eq('player_id', state.current_player_id)
            .order('amount', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (bid) {
            // Fetch team name
            const { data: team } = await supabase
              .from('teams')
              .select('name')
              .eq('id', bid.team_id)
              .maybeSingle();

            const processedBid = {
              ...bid,
              team_name: team ? team.name : null
            };

            socket.emit('bid-updated', { highestBid: processedBid });
          }
        }
      }
    } catch (err) {
      console.error('Error sending initial info:', err);
    }
  });
});

// Start server
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📱 Access from network: http://<YOUR_LOCAL_IP>:${PORT}`);
});

export { io };


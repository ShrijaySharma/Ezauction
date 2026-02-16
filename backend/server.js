import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import session from 'express-session';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase } from './db.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import ownerRoutes from './routes/owner.js';
import hostRoutes from './routes/host.js';
import appOwnerRoutes from './routes/appOwner.js';

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

// Serve uploaded images
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

// Initialize database
const db = await initDatabase();

// Make db available to routes
app.locals.db = db;
app.locals.io = io;

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/host', hostRoutes);
app.use('/api/app-owner', appOwnerRoutes);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start server
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`📱 Access from network: http://<YOUR_LOCAL_IP>:${PORT}`);
});

export { io, db };


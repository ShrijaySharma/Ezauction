import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bcrypt from 'bcrypt';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function initDatabase() {
  return new Promise((resolve, reject) => {
    const dbPath = join(__dirname, 'auction.db');
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      console.log('✅ Connected to SQLite database');
    });

    // Create tables
    db.serialize(() => {
      // Users table
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        team_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);

      // Teams table
      db.run(`CREATE TABLE IF NOT EXISTS teams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        owner_id INTEGER,
        owner_name TEXT,
        logo TEXT,
        budget REAL DEFAULT 1000000,
        bidding_locked INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, () => {
        // Try to add new columns if they don't exist (for existing databases)
        // SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we ignore errors
        db.run(`ALTER TABLE teams ADD COLUMN owner_name TEXT`, (err) => {
          // Ignore error if column already exists
        });
        db.run(`ALTER TABLE teams ADD COLUMN logo TEXT`, (err) => {
          // Ignore error if column already exists
        });
        db.run(`ALTER TABLE teams ADD COLUMN bidding_locked INTEGER DEFAULT 0`, (err) => {
          // Ignore error if column already exists
        });
        db.run(`ALTER TABLE teams ADD COLUMN access_code TEXT`, (err) => {
          // Ignore error if column already exists
        });
        db.run(`ALTER TABLE teams ADD COLUMN plain_password TEXT`, (err) => {
          // Ignore error if column already exists
        });
      });

      // Players table
      db.run(`CREATE TABLE IF NOT EXISTS players (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        image TEXT,
        role TEXT NOT NULL,
        country TEXT,
        base_price REAL NOT NULL,
        status TEXT DEFAULT 'AVAILABLE',
        sold_price REAL,
        sold_to_team INTEGER,
        was_unsold INTEGER DEFAULT 0,
        serial_number INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, () => {
        // Add was_unsold column if it doesn't exist (for existing databases)
        db.run(`ALTER TABLE players ADD COLUMN was_unsold INTEGER DEFAULT 0`, (err) => {
          // Ignore error if column already exists
        });
        // Add serial_number column if it doesn't exist (for existing databases)
        db.run(`ALTER TABLE players ADD COLUMN serial_number INTEGER`, (err) => {
          // Ignore error if column already exists
        });
      });

      // Bids table
      db.run(`CREATE TABLE IF NOT EXISTS bids (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL,
        team_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES players(id),
        FOREIGN KEY (team_id) REFERENCES teams(id)
      )`);

      // Auction state table
      db.run(`CREATE TABLE IF NOT EXISTS auction_state (
        id INTEGER PRIMARY KEY,
        status TEXT DEFAULT 'STOPPED',
        current_player_id INTEGER,
        bidding_locked INTEGER DEFAULT 0,
        bid_increment_1 REAL DEFAULT 500,
        bid_increment_2 REAL DEFAULT 1000,
        bid_increment_3 REAL DEFAULT 5000,
        max_players_per_team INTEGER DEFAULT 10,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, () => {
        // Try to add max_players_per_team column if it doesn't exist (for existing databases)
        db.run(`ALTER TABLE auction_state ADD COLUMN max_players_per_team INTEGER DEFAULT 10`, (err) => {
          // Ignore error if column already exists
        });
        // Add enforce_max_bid column if it doesn't exist
        db.run(`ALTER TABLE auction_state ADD COLUMN enforce_max_bid INTEGER DEFAULT 0`, (err) => {
          // Ignore error
        });
        // Initialize auction state if not exists
        db.run(`INSERT OR IGNORE INTO auction_state (id, status) VALUES (1, 'STOPPED')`);

        // Seed default users
        const seedUsers = async () => {
          const users = [
            { username: 'kanha08', password: 'kanha7000@0007', role: 'app_owner' },
            { username: 'admin', password: 'admin', role: 'admin' }, // Default admin
            { username: 'host', password: 'host', role: 'host' }    // Default host
          ];

          for (const user of users) {
            db.get('SELECT id FROM users WHERE role = ?', [user.role], async (err, existingUser) => {
              if (!existingUser) {
                console.log(`Seeding user: ${user.username}`);
                const hashedPassword = await bcrypt.hash(user.password, 10);
                db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)',
                  [user.username, hashedPassword, user.role]);
              }
            });
          }
        };
        seedUsers();

        resolve(db);
      });
    });
  });
}

export function getDb() {
  return db;
}


import sqlite3 from 'sqlite3';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'auction.db');

console.log('🗑️  STARTING HARD RESET...\n');

// 1. Delete the database file if it exists
if (fs.existsSync(dbPath)) {
    try {
        fs.unlinkSync(dbPath);
        console.log('✅ Deleted existing auction.db file');
    } catch (err) {
        console.error('❌ Error deleting database file:', err);
        console.log('   (Make sure to stop the backend server first!)');
        process.exit(1);
    }
} else {
    console.log('ℹ️  No existing database file found');
}

// 2. Create new database
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error creating new database:', err);
        process.exit(1);
    }
    console.log('✅ Created new empty auction.db');
});

// 3. Initialize Schema
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
    )`);

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
    )`);

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
        enforce_max_bid INTEGER DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, () => {
        // Initialize auction state
        db.run(`INSERT INTO auction_state (id, status, max_players_per_team) VALUES (1, 'STOPPED', 15)`);
        console.log('✅ Database schema created');
    });

    // 4. Restore Admin User
    const adminHash = '$2b$10$xwYnhAsdAa7YKN9eUjg3hOKN/LLVfyC3Xz36BDbju.wxGEx9jX5M2'; // Current hash
    db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
        ['admin', adminHash, 'admin'],
        (err) => {
            if (err) {
                console.error('❌ Error restoring admin:', err);
            } else {
                console.log('✅ Restored admin user');
            }

            // Final check
            db.get('SELECT COUNT(*) as count FROM teams', (err, row) => {
                console.log(`\n📊 Final State: ${row.count} teams, Admin restored.`);
                console.log('✨ HARD RESET COMPLETE! Please restart your backend server.');
                db.close();
            });
        }
    );
});

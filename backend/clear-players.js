import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'auction.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    console.log('Starting database cleanup...');

    db.run('DELETE FROM bids', (err) => {
        if (err) console.error('Error deleting bids:', err);
        else console.log('✅ All bids deleted.');
    });

    db.run('DELETE FROM players', (err) => {
        if (err) console.error('Error deleting players:', err);
        else console.log('✅ All players deleted.');
    });

    // Reset auction state
    db.run('UPDATE auction_state SET current_player_id = NULL, status = "STOPPED"', (err) => {
        if (err) console.error('Error resetting auction state:', err);
        else console.log('✅ Auction state reset.');
    });

    // Also reset team budgets if they were modified by bidding (optional, but keep it as is unless asked)
    // The user didn't ask to reset teams, just players.
});

db.close((err) => {
    if (err) console.error(err.message);
    console.log('Database cleanup complete.');
});

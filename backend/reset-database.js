import sqlite3 from 'sqlite3';

const sqlite = sqlite3.verbose();
const db = new sqlite.Database('./auction.db');

console.log('🗑️  Starting database cleanup...\n');

db.serialize(() => {
    // Delete all bids
    db.run('DELETE FROM bids', (err) => {
        if (err) {
            console.error('❌ Error deleting bids:', err);
        } else {
            console.log('✅ Deleted all bids');
        }
    });

    // Delete all players
    db.run('DELETE FROM players', (err) => {
        if (err) {
            console.error('❌ Error deleting players:', err);
        } else {
            console.log('✅ Deleted all players');
        }
    });

    // Delete all teams
    db.run('DELETE FROM teams', (err) => {
        if (err) {
            console.error('❌ Error deleting teams:', err);
        } else {
            console.log('✅ Deleted all teams');
        }
    });

    // Reset auction state
    db.run(`UPDATE auction_state SET 
        current_player_id = NULL,
        status = 'STOPPED',
        bidding_locked = 0
        WHERE id = 1`, (err) => {
        if (err) {
            console.error('❌ Error resetting auction state:', err);
        } else {
            console.log('✅ Reset auction state');
        }
    });

    // Keep admin user, only show confirmation
    db.get('SELECT COUNT(*) as count FROM users WHERE role = ?', ['admin'], (err, result) => {
        if (err) {
            console.error('❌ Error checking admin:', err);
        } else {
            console.log(`✅ Admin user preserved (count: ${result.count})`);
        }
    });

    // Final summary
    db.all(`SELECT 
        (SELECT COUNT(*) FROM players) as players,
        (SELECT COUNT(*) FROM teams) as teams,
        (SELECT COUNT(*) FROM bids) as bids,
        (SELECT COUNT(*) FROM users WHERE role = 'admin') as admins
    `, (err, rows) => {
        if (err) {
            console.error('❌ Error getting final counts:', err);
        } else {
            const counts = rows[0];
            console.log('\n📊 Final Database State:');
            console.log(`   Players: ${counts.players}`);
            console.log(`   Teams: ${counts.teams}`);
            console.log(`   Bids: ${counts.bids}`);
            console.log(`   Admin users: ${counts.admins}`);
            console.log('\n✨ Database is ready for a new auction!\n');
        }

        db.close();
    });
});

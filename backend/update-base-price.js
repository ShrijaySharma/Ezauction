import { initDatabase } from './db.js';

async function updateBasePrice() {
    console.log('🔄 Connecting to database...');
    const db = await initDatabase();

    console.log('💸 Updating base price for all players to 3000...');

    await new Promise((resolve, reject) => {
        db.run('UPDATE players SET base_price = 2000', function (err) {
            if (err) {
                console.error('❌ Error updating base price:', err);
                reject(err);
            } else {
                console.log(`✅ Updated ${this.changes} players.`);
                resolve();
            }
        });
    });

    console.log('🔍 Verifying update (Checking first 5 players)...');
    db.all('SELECT name, base_price FROM players LIMIT 5', (err, rows) => {
        if (err) console.error(err);
        else {
            console.table(rows);
            // Double check values
            const allUpdated = rows.every(r => r.base_price === 2000);
            if (allUpdated) {
                console.log('✅ Verification PASS: All checked players have base_price = 2000');
            } else {
                console.error('❌ Verification FAIL: Some players still have incorrect base_price');
            }
        }
    });
}

updateBasePrice().catch(console.error);

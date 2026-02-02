import { initDatabase } from './db.js';

async function verify() {
    const db = await initDatabase();

    db.all('SELECT serial_number, name, role FROM players ORDER BY serial_number LIMIT 5', (err, rows) => {
        if (err) console.error(err);
        else {
            console.log('--- Top 5 Players ---');
            console.log(JSON.stringify(rows, null, 2));
        }
    });

    db.all('SELECT role, COUNT(*) as count FROM players GROUP BY role', (err, rows) => {
        if (err) console.error(err);
        else {
            console.log('\n--- Role Distribution ---');
            console.log(JSON.stringify(rows, null, 2));
        }
    });
}

verify();

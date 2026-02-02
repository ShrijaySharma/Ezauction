import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'auction.db');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err);
        process.exit(1);
    }
});

db.serialize(() => {
    db.get('SELECT count(*) as count FROM teams', (err, row) => {
        if (err) console.error(err);
        else console.log('Teams count:', row.count);
    });

    db.get('SELECT count(*) as count FROM users', (err, row) => {
        if (err) console.error(err);
        else console.log('Users count:', row.count);
    });

    db.all('SELECT name, username FROM teams JOIN users ON teams.owner_id = users.id', (err, rows) => {
        if (err) console.error(err);
        else {
            console.log('Sample Teams and Owners:');
            rows.slice(0, 5).forEach(row => {
                console.log(`- ${row.name} (${row.username})`);
            });
        }
        db.close();
    });
});

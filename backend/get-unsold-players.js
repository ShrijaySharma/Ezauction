import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'auction.db');
const db = new sqlite3.Database(dbPath);
const outputPath = join(__dirname, '..', 'unsold_names.txt');

db.serialize(() => {
    db.all("SELECT name FROM players WHERE was_unsold = 1 ORDER BY name", (err, rows) => {
        if (err) {
            console.error(err.message);
            return;
        }

        const content = rows.map(row => row.name).join('\n');

        fs.writeFileSync(outputPath, content);
        console.log(`Successfully wrote ${rows.length} names to ${outputPath}`);
    });
});

db.close();

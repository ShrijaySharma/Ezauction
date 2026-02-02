import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join, extname } from 'path';
import fs from 'fs';
import { initDatabase } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const playersImgDir = join(__dirname, '../players_img');
const uploadsDir = join(__dirname, 'uploads');

const PLAYER_ROLES = [
    "Batsman", "Bowler", "All rounder", "All rounder", "Batsman", "All rounder", "Batsman", "All rounder", "Batsman", "Batsman",
    "All rounder", "Batsman", "Batsman", "Bowler", "Batsman", "Batsman", "Batsman", "All rounder", "All rounder", "Batsman",
    "All rounder", "Bowler", "All rounder", "Batsman", "All rounder", "Bowler", "All rounder", "Batsman", "Bowler", "All rounder",
    "All rounder", "All rounder", "Batsman", "All rounder", "Bowler", "Batsman", "Batsman", "Batsman", "Batsman", "All rounder",
    "Batsman", "All rounder", "All rounder", "Bowler", "Batsman", "All rounder", "Batsman", "Batsman", "Batsman", "Bowler",
    "Batsman", "Batsman", "All rounder", "All rounder", "Bowler", "All rounder", "All rounder", "Batsman", "Batsman", "All rounder",
    "Batsman", "All rounder", "Bowler", "All rounder", "Bowler", "Batsman", "Batsman", "All rounder", "Batsman", "All rounder",
    "Batsman", "Batsman", "All rounder", "Batsman", "Bowler", "Batsman", "Bowler", "Batsman", "All rounder", "Batsman",
    "Bowler", "Batsman", "batsman", "All rounder", "All rounder", "All rounder", "Batsman", "Batsman", "Batsman", "All rounder",
    "Bowler", "Batsman", "Batsman", "Bowler", "Batsman", "Batsman", "All rounder", "All rounder", "Batsman", "Batsman",
    "Batsman", "Bowler", "All rounder", "Batsman", "batsman", "Batsman", "Bowler", "Bowler", "All rounder", "Batsman",
    "All rounder", "Batsman", "All rounder", "All rounder", "All rounder", "All rounder", "Batsman", "Batsman", "Batsman", "Batsman",
    "All rounder", "Batsman", "Batsman", "All rounder", "Batsman", "Batsman", "All rounder", "Batsman", "Bowler", "All rounder",
    "All rounder", "Batsman", "Batsman", "All rounder", "All rounder", "Batsman", "Batsman", "All rounder", "Batsman", "All rounder",
    "Batsman", "Batsman", "Bowler", "Batsman", "Batsman", "All rounder", "Bowler", "Batsman", "Batsman", "Batsman",
    "Bowler", "Batsman", "All rounder", "All rounder", "Batsman", "Batsman", "Batsman", "Batsman", "Bowler", "Batsman",
    "Batsman", "All rounder", "Batsman", "Batsman", "All rounder", "Batsman", "All rounder", "Batsman", "Batsman", "All rounder",
    "Batsman", "Batsman", "Batsman", "Batsman", "All rounder", "All rounder", "Bowler", "Batsman", "Bowler", "Batsman",
    "Batsman", "Batsman", "Bowler", "All rounder", "Bowler", "Batsman", "All rounder", "Batsman", "Bowler", "Bowler",
    "Batsman", "All rounder", "Batsman", "Batsman", "Bowler", "Batsman", "All rounder", "ALL rounder", "Bowler", "Batsman",
    "batsman", "Batsman", "Batsman", "All rounder", "Batsman", "All rounder", "All rounder", "Batsman", "Batsman", "Bowler",
    "Bowler", "Bowler", "All rounder", "All rounder", "All rounder", "Batsman", "Batsman", "All rounder", "Batsman", "Bowler",
    "All rounder", "All rounder", "Batsman", "All rounder", "All rounder", "All rounder", "Bowler", "All rounder", "All rounder", "All rounder",
    "Batsman", "Batsman", "Batsman", "Batsman", "Batsman", "All rounder", "Bowler", "All rounder", "All rounder", "Batsman",
    "All rounder", "Bowler", "Bowler", "Batsman", "Batsman", "Batsman", "Batsman", "Batsman", "All rounder", "Batsman",
    "Batsman", "Bowler", "All rounder", "All rounder", "All rounder", "All rounder", "All rounder", "All rounder", "Batsman", "All rounder",
    "All rounder", "Bowler", "Batsman", "Bowler", "Batsman", "All rounder", "All rounder", "All rounder", "Batsman", "Batsman",
    "Batsman", "Bowler", "All rounder", "Batsman", "Bowler", "Batsman", "All rounder", "Batsman", "All rounder", "All rounder",
    "Batsman", "Bowler", "All rounder", "Batsman", "Batsman", "Bowler", "Batsman", "Bowler", "Batsman", "Batsman",
    "Bowler", "Batsman", "Batsman", "All rounder", "Bowler", "Batsman", "Batsman", "batsman", "All rounder", "Batsman",
    "Bowler", "Batsman", "Batsman", "Batsman", "All rounder", "Batsman", "Bowler", "Batsman", "All rounder", "Batsman",
    "Batsman", "All rounder", "Batsman", "Batsman", "Batsman", "All rounder", "All rounder", "Batsman", "Batsman", "All rounder",
    "Batsman"
];

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

async function processNewTournament() {
    console.log('🔄 Starting fresh import for new tournament...');

    const db = await initDatabase();

    // 1. Clear old data (Optional: user might want to keep sold players)
    console.log('🗑️  Clearing bids and resetting auction state (Players will be updated/added)...');
    await new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('DELETE FROM bids');
            // We don't delete players anymore - we update them
            // db.run('DELETE FROM players');
            db.run('UPDATE auction_state SET status = "STOPPED", current_player_id = NULL');
            db.run('UPDATE teams SET budget = 1000000', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });

    // 2. Read and parse files from players_img
    const files = fs.readdirSync(playersImgDir);
    console.log(`📂 Found ${files.length} files in players_img`);

    let playersToImport = [];
    let skippedCount = 0;

    for (const file of files) {
        const ext = extname(file).toLowerCase();
        // Supporting common image formats + PDF
        if (!['.jpg', '.jpeg', '.png', '.webp', '.heic', '.pdf'].includes(ext)) {
            continue;
        }

        let playerName = '';
        let detectedRole = null;

        // Extract name from filename
        if (file.includes(' - ')) {
            const parts = file.split(' - ');
            // Usually "Prefix - Name.ext"
            playerName = parts[parts.length - 1].replace(ext, '').trim();
        } else {
            // Direct filename cleaning
            playerName = file.replace(ext, '')
                .replace(/IMG[-_]\d+[-_]?WA\d+/i, '')
                .replace(/Screenshot_\d+-\d+-\d+-\d+-\d+/i, '')
                .replace(/[^a-zA-Z\s\(\)]/g, ' ') // Keep parentheses for role extraction
                .trim();
        }

        // Role extraction regex
        const roleRegex = /\((AR|All[ -]rounder|Bowler|Batsman)\)/i;
        const roleMatch = playerName.match(roleRegex);
        if (roleMatch) {
            const roleStr = roleMatch[1].toUpperCase();
            if (roleStr === 'AR' || roleStr === 'ALL ROUNDER' || roleStr === 'ALL-ROUNDER') {
                detectedRole = 'ALL-ROUNDER';
            } else if (roleStr === 'BOWLER') {
                detectedRole = 'BOWLER';
            } else if (roleStr === 'BATSMAN') {
                detectedRole = 'BATSMAN';
            }
            // Clean the name from role info
            playerName = playerName.replace(roleRegex, '').trim();
        }

        // Final name cleaning
        playerName = playerName.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();

        // Skip files that don't seem to have a real name after cleaning
        if (!playerName || playerName.length < 2 || playerName.toUpperCase() === 'IMAGE') {
            console.log(`⏩ Skipping file with no clear name: ${file}`);
            skippedCount++;
            continue;
        }

        playersToImport.push({
            name: playerName,
            role: detectedRole,
            originalFile: file,
            ext: ext
        });
    }

    // 3. Sort players alphabetically by name (case-insensitive)
    console.log('🔤 Sorting players alphabetically...');
    playersToImport.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    let importCount = 0;

    // 4. Process and insert sorted players
    for (const playerData of playersToImport) {
        const { name: playerName, role: detectedRole, originalFile: file, ext } = playerData;

        // Use detected role, or pick from provided list, default if missing
        let role = detectedRole || PLAYER_ROLES[importCount] || 'ALL-ROUNDER';
        // Normalize role for database consistency (uppercase)
        role = role.trim().toUpperCase().replace(/\s+/g, '-');

        console.log(`👤 Processing player #${importCount + 1}: "${playerName}" as "${role}" (from ${file})`);

        // Check if player already exists
        const existingPlayer = await new Promise((resolve) => {
            db.get('SELECT * FROM players WHERE name = ?', [playerName], (err, row) => {
                resolve(row);
            });
        });

        // Copy image to uploads
        const timestamp = Date.now();
        const safeName = playerName.replace(/\s+/g, '_').toLowerCase();
        const newFileName = `player-${safeName}-${timestamp}-${importCount}${ext}`;
        const sourcePath = join(playersImgDir, file);
        const destPath = join(uploadsDir, newFileName);

        try {
            fs.copyFileSync(sourcePath, destPath);
            const imageDbPath = `/uploads/${newFileName}`;

            if (existingPlayer) {
                console.log(`🆙 Updating existing player: "${playerName}"`);
                await new Promise((resolve, reject) => {
                    db.run(
                        'UPDATE players SET image = ?, role = ?, serial_number = ? WHERE id = ?',
                        [imageDbPath, role, importCount + 1, existingPlayer.id],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            } else {
                console.log(`🆕 Inserting new player: "${playerName}"`);
                // Insert into database
                await new Promise((resolve, reject) => {
                    db.run(
                        'INSERT INTO players (name, image, role, country, base_price, status, serial_number) VALUES (?, ?, ?, ?, ?, ?, ?)',
                        [playerName, imageDbPath, role, 'India', 2000, 'AVAILABLE', importCount + 1],
                        (err) => {
                            if (err) reject(err);
                            else resolve();
                        }
                    );
                });
            }

            importCount++;
        } catch (err) {
            console.error(`❌ Error importing ${file}:`, err);
        }
    }

    console.log(`\n🎉 Import complete!`);
    console.log(`✅ New players imported: ${importCount}`);
    console.log(`⚠️  Files skipped: ${skippedCount}`);

    db.close();
}

processNewTournament().catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});

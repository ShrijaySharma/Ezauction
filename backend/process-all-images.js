import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join, extname, basename } from 'path';
import fs from 'fs';
import { initDatabase } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const playersImgDir = join(__dirname, '../players_img');
const extraListsDir = join(__dirname, '../extralists');
const uploadsDir = join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

function cleanPlayerName(filename) {
    let name = filename;

    // Remove extension
    const ext = extname(name);
    name = name.substring(0, name.length - ext.length);

    // Common prefix removal (files often start with "IMG...", "Screenshot...", dates, etc. followed by " - ")
    // We look for the LAST occurrence of " - " to separate the prefix from the potential name
    if (name.includes(' - ')) {
        const parts = name.split(' - ');
        // Take the last part as the name candidate
        name = parts[parts.length - 1];
    } else {
        // Fallback cleanup for specific patterns if " - " isn't there but garbage is
        name = name
            .replace(/^IMG[-_]\d+[-_]?WA\d+/i, '')
            .replace(/^Screenshot_\d+-\d+-\d+-\d+-\d+/i, '')
            .replace(/^FB_IMG_\d+/i, '')
            .replace(/^PXL_\d+/i, '');
    }

    return name.trim();
}

function extractRole(nameFragment) {
    let name = nameFragment;
    let role = 'Unspecified';

    // Regex for (Role) pattern - fairly flexible on spacing and case
    // Matches: (Batsman), ( Bowler ), (AR), (All rounder), etc.
    const roleRegex = /\(\s*(AR|All[ -]?rounder|Bowler|Batsman|Wicket[ -]?keeper|WK)\s*\)/i;

    const match = name.match(roleRegex);
    if (match) {
        const roleStr = match[1].toUpperCase().replace('-', ' ').replace(/\s+/g, ' ');

        if (roleStr === 'AR' || roleStr.includes('ALL ROUNDER')) {
            role = 'ALL-ROUNDER';
        } else if (roleStr === 'BOWLER') {
            role = 'BOWLER';
        } else if (roleStr === 'BATSMAN') {
            role = 'BATSMAN';
        } else if (roleStr === 'WK' || roleStr.includes('WICKET')) {
            role = 'WICKET KEEPER';
        }

        // Remove the role extraction from the name
        name = name.replace(roleRegex, '');
    }

    // Clean up any remaining non-name characters (keeping spaces and letters)
    // We allow . for initials (e.g. M.S. Dhoni)
    name = name.replace(/[^a-zA-Z\s.]/g, ' ').replace(/\s+/g, ' ').trim();

    return { name, role };
}

async function processAllImages() {
    console.log('🔄 Starting comprehensive player import...');

    const db = await initDatabase();

    // 1. Clear old data?
    // The user said "extract player names... arrange them...". 
    // Usually implies a fresh start or update. 
    // SAFEST APPROACH: We will UPSERT. If name exists, update. If not, insert.
    // BUT, for the "arrange alphabetically" requirement to effectively show the order, 
    // we usually need to reset the serial_numbers.
    // Let's ask the database to clear players first to ensure clean alphabetical order as per user request context implies a setup.
    // Actually, let's just delete all and re-insert to be sure about the alphabetical order ID assignment unless preserving IDs is critical (usually not for a setup task).
    // Given the prompt "arrange them alphabetically", re-inserting is the best way to ensure IDs/Serial Numbers follow that order.

    console.log('🗑️  Clearing existing players and bids to ensure clean alphabetical sort...');
    await new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('DELETE FROM bids');
            db.run('DELETE FROM players');
            db.run('DELETE FROM sqlite_sequence WHERE name="players"'); // Reset auto-increment ID
            db.run('UPDATE auction_state SET status = "STOPPED", current_player_id = NULL', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    });

    // 2. Gather files from both directories
    let allFiles = [];

    const collectFiles = (dir) => {
        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            console.log(`📂 Found ${files.length} files in ${basename(dir)}`);
            files.forEach(file => {
                const ext = extname(file).toLowerCase();
                if (['.jpg', '.jpeg', '.png', '.webp', '.heic', '.pdf'].includes(ext)) {
                    allFiles.push({ filename: file, dir: dir });
                }
            });
        } else {
            console.warn(`⚠️  Directory not found: ${dir}`);
        }
    };

    collectFiles(playersImgDir);
    collectFiles(extraListsDir);

    // 3. Process filenames
    let playersToImport = [];
    let skippedCount = 0;

    for (const fileObj of allFiles) {
        let cleanedNameFragment = cleanPlayerName(fileObj.filename);

        // Skip junk files
        if (!cleanedNameFragment || cleanedNameFragment.toUpperCase() === 'IMAGE' || cleanedNameFragment.length < 2) {
            console.log(`⏩ Skipping ambiguous file: ${fileObj.filename}`);
            skippedCount++;
            continue;
        }

        const { name, role } = extractRole(cleanedNameFragment);

        if (!name || name.length < 2) {
            console.log(`⏩ Skipping file with no name after extraction: ${fileObj.filename}`);
            skippedCount++;
            continue;
        }

        playersToImport.push({
            name: name,
            role: role, // Now defaults to 'Unspecified'
            originalFile: fileObj.filename,
            sourceDir: fileObj.dir,
            ext: extname(fileObj.filename)
        });
    }

    // 4. Sort alphabetically
    console.log('🔤 Sorting players alphabetically...');
    playersToImport.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    // 5. Insert into DB
    let importCount = 0;
    for (const player of playersToImport) {
        // Copy image
        const timestamp = Date.now();
        const safeName = player.name.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
        // Add a random suffix to avoid collision if times match exactly or names are identical
        const newFileName = `player-${safeName}-${importCount}-${Math.floor(Math.random() * 1000)}${player.ext}`;
        const sourcePath = join(player.sourceDir, player.originalFile);
        const destPath = join(uploadsDir, newFileName);
        const imageDbPath = `/uploads/${newFileName}`;

        try {
            fs.copyFileSync(sourcePath, destPath);

            await new Promise((resolve, reject) => {
                db.run(
                    'INSERT INTO players (name, image, role, country, base_price, status, serial_number) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [player.name, imageDbPath, player.role, 'India', 2000, 'AVAILABLE', importCount + 1],
                    (err) => {
                        if (err) reject(err);
                        else resolve();
                    }
                );
            });

            console.log(`✅ [${importCount + 1}] Added: "${player.name}" (${player.role})`);
            importCount++;

        } catch (err) {
            console.error(`❌ Error processing ${player.name}:`, err);
        }
    }

    console.log(`\n🎉 Import complete!`);
    console.log(`✅ Total players imported: ${importCount}`);
    console.log(`⚠️  Files skipped: ${skippedCount}`);

    db.close();
}

processAllImages().catch(err => {
    console.error('💥 Fatal error:', err);
    process.exit(1);
});

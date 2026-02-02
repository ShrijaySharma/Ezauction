import sqlite3 from 'sqlite3';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import fs from 'fs';
import { initDatabase } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function reseed() {
    const db = await initDatabase();

    console.log('🌱 Starting database reset for 19 teams...');

    // Hash passwords
    const adminPassword = await bcrypt.hash('admin123', 10);
    const hostPassword = await bcrypt.hash('host123', 10);
    const ownerPassword = await bcrypt.hash('owner123', 10);

    // Clear existing data
    db.serialize(() => {
        // 1. Clear tables
        db.run('DELETE FROM bids');
        db.run('DELETE FROM players');
        db.run('DELETE FROM teams');
        db.run('DELETE FROM users');
        db.run('DELETE FROM sqlite_sequence'); // Reset auto-increment IDs

        console.log('✅ Cleared existing data');

        // 2. Insert admin and host
        db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, ['admin', adminPassword, 'admin']);
        db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, ['host', hostPassword, 'host']);
        console.log('✅ Admin and Host users created');

        // 3. Define 19 Teams
        const teamData = [
            { name: "Aarth warriors", username: "aarth" },
            { name: "Abraham 11", username: "abraham" },
            { name: "AVM warriors", username: "avm" },
            { name: "Basantpur 11", username: "basantpur" },
            { name: "CG brothers", username: "cg_brothers" },
            { name: "Chitransh 11", username: "chitransh" },
            { name: "CRS ISHWAR SONKAR", username: "crs_ishwar" },
            { name: "Elite 11", username: "elite" },
            { name: "Good Morning cricket club", username: "good_morning" },
            { name: "Krishna 11", username: "krishna" },
            { name: "Mahadev 11", username: "mahadev" },
            { name: "Manan superkings", username: "manan" },
            { name: "Nartaj 11", username: "nartaj" },
            { name: "RV kings", username: "rv_kings" },
            { name: "South indian kings", username: "south_indian" },
            { name: "WInter cricket club", username: "winter" },
            { name: "yashoda group", username: "yashoda" },
            { name: "Team VSR PTS", username: "vsr_pts" },
            { name: "Team Anandam", username: "anandam" }
        ];

        // 4. Insert Teams and Owners
        const credentials = [];
        let completed = 0;

        const processTeam = async (team) => {
            return new Promise((resolve, reject) => {
                db.run(
                    `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`,
                    [team.username, ownerPassword, 'owner'],
                    function (err) {
                        if (err) {
                            console.error(`Error inserting user ${team.username}:`, err);
                            reject(err);
                            return;
                        }
                        const userId = this.lastID;

                        db.run(
                            `INSERT INTO teams (name, owner_id, budget) VALUES (?, ?, ?)`,
                            [team.name, userId, 1000000], // Default budget
                            function (err) {
                                if (err) {
                                    console.error(`Error inserting team ${team.name}:`, err);
                                    reject(err);
                                    return;
                                }
                                const teamId = this.lastID;

                                // Link user back to team
                                db.run(
                                    `UPDATE users SET team_id = ? WHERE id = ?`,
                                    [teamId, userId],
                                    (err) => {
                                        if (err) reject(err);
                                        else resolve();
                                    }
                                );
                            }
                        );
                    }
                );
            });
        };

        const runProcess = async () => {
            for (const team of teamData) {
                await processTeam(team);
                credentials.push(`| ${team.name} | ${team.username} | owner123 |`);
            }

            // 5. Write Credentials to File
            const credsContent = `# Auction App Credentials - 19 Teams
Generated on: ${new Date().toLocaleString()}

## Admin
Username: admin
Password: admin123

## Host
Username: host
Password: host123

## Teams
| Team Name | Username | Password |
|-----------|----------|----------|
${credentials.join('\n')}
`;
            const rootPath = resolve(__dirname, '..');
            const credsPath = join(rootPath, 'LOGIN_CREDENTIALS.md');

            fs.writeFileSync(credsPath, credsContent);
            console.log(`✅ Generated 19 teams`);
            console.log(`📄 Credentials saved to: ${credsPath}`);

            db.close();
            console.log('🎉 Reset complete!');
        };

        runProcess().catch(err => console.error("Fatal error:", err));
    });
}

reseed().catch(console.error);

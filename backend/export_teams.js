import { fetch, setGlobalDispatcher, Agent } from 'undici';

const agent = new Agent({
    connect: {
        lookup: (hostname, options, callback) => {
            if (hostname === 'arrtlpxbyahfijxlxdpc.supabase.co') {
                return callback(null, [{ address: '104.18.38.10', family: 4 }]);
            }
            return require('dns').lookup(hostname, options, (err, address, family) => {
                if (err) return callback(err);
                return callback(null, [{ address, family }]);
            });
        }
    }
});

setGlobalDispatcher(agent);

// We don't need a custom fetch wrapper, just use global undici fetch
const customFetch = fetch;

import { createClient } from '@supabase/supabase-js';
import ExcelJS from 'exceljs';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false
    },
    global: {
        fetch: customFetch
    }
});

async function exportTeamData() {
    try {
        console.log('Fetching teams and sold players...');

        // Fetch teams
        const { data: teams, error: teamsError } = await supabase
            .from('teams')
            .select('id, name')
            .order('name');

        if (teamsError) throw teamsError;

        // Fetch sold players
        const { data: players, error: playersError } = await supabase
            .from('players')
            .select('name, role, sold_price, serial_number, sold_to_team')
            .eq('status', 'SOLD')
            .order('serial_number');

        if (playersError) throw playersError;

        // Create workbook
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Team Squads');

        // Build columns based on teams
        // Structure: [Team A Name, Team A Player, Team A Price] [Team B Name...]

        // To make it easy to read, we'll have Team names as headers
        // Row 1: Team Names
        // Row 2: Serial | Name | Price for each team
        // Row 3+: Data

        // We need 3 sub-columns per team: Serial, Name, Price
        const teamHeaders = [];
        const subHeaders = [];

        teams.forEach(team => {
            // Add team name header spanning 3 columns
            teamHeaders.push(team.name, '', '');
            subHeaders.push('Serial #', 'Player Name', 'Price');
        });

        // Add headers to sheet
        sheet.addRow(teamHeaders);
        sheet.addRow(subHeaders);

        // Merge cells for team names
        let startCol = 1;
        teams.forEach(team => {
            sheet.mergeCells(1, startCol, 1, startCol + 2);

            // Style team headers
            const cell = sheet.getCell(1, startCol);
            cell.font = { bold: true, size: 12 };
            cell.alignment = { horizontal: 'center' };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD3D3D3' } // light gray
            };

            // Style sub-headers
            for (let i = 0; i < 3; i++) {
                const subCell = sheet.getCell(2, startCol + i);
                subCell.font = { bold: true };
                subCell.border = { bottom: { style: 'thin' } };
            }

            startCol += 3;
        });

        // Group players by team
        const playersByTeam = {};
        teams.forEach(t => { playersByTeam[t.id] = []; });

        players.forEach(p => {
            if (p.sold_to_team && playersByTeam[p.sold_to_team]) {
                playersByTeam[p.sold_to_team].push(p);
            }
        });

        // Find max players in any team to know how many rows to create
        let maxPlayers = 0;
        Object.values(playersByTeam).forEach(teamPlayers => {
            if (teamPlayers.length > maxPlayers) maxPlayers = teamPlayers.length;
        });

        // Fill rows
        for (let rowIdx = 0; rowIdx < maxPlayers; rowIdx++) {
            const rowData = [];

            teams.forEach(team => {
                const teamPlayers = playersByTeam[team.id];
                const player = teamPlayers[rowIdx];

                if (player) {
                    rowData.push(
                        player.serial_number || '',
                        player.name || '',
                        player.sold_price || ''
                    );
                } else {
                    rowData.push('', '', ''); // Empty cells if team has fewer players
                }
            });

            sheet.addRow(rowData);
        }

        // Auto-fit columns
        for (let i = 1; i <= teams.length * 3; i++) {
            let maxWidth = 10;
            sheet.getColumn(i).eachCell({ includeEmpty: false }, cell => {
                const value = cell.value ? cell.value.toString() : '';
                if (value.length > maxWidth) maxWidth = value.length;
            });
            sheet.getColumn(i).width = maxWidth + 2;
        }

        const exportPath = path.join(process.cwd(), 'Team_Squads_Export.xlsx');
        await workbook.xlsx.writeFile(exportPath);
        console.log(`Successfully exported data to ${exportPath}`);

    } catch (error) {
        console.error('Export failed:', error);
    }
}

exportTeamData();

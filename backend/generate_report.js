import { supabase } from './supabaseClient.js';
import XLSX from 'xlsx';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function generateReport() {
    console.log('📊 Fetching data from Supabase...');

    // Fetch all teams
    const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .order('name');

    if (teamsError) {
        console.error('❌ Error fetching teams:', teamsError.message);
        process.exit(1);
    }

    // Fetch all sold players
    const { data: players, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('status', 'SOLD')
        .order('serial_number');

    if (playersError) {
        console.error('❌ Error fetching players:', playersError.message);
        process.exit(1);
    }

    console.log(`✅ Found ${teams.length} teams and ${players.length} sold players.`);

    // Group players by team
    const teamPlayersMap = {};
    for (const team of teams) {
        teamPlayersMap[team.id] = {
            teamName: team.name,
            ownerName: team.owner_name || '-',
            budget: team.budget,
            players: []
        };
    }

    for (const player of players) {
        if (player.sold_to_team && teamPlayersMap[player.sold_to_team]) {
            teamPlayersMap[player.sold_to_team].players.push(player);
        }
    }

    // Build worksheet rows
    const rows = [];

    for (const teamId of Object.keys(teamPlayersMap)) {
        const team = teamPlayersMap[teamId];

        // Team header row
        rows.push({
            'Team Name': team.teamName,
            'Owner': team.ownerName,
            'Remaining Budget': team.budget,
            'Serial No.': '',
            'Player Name': '',
            'Role': '',
            'Base Price': '',
            'Bought Price': '',
        });

        if (team.players.length === 0) {
            rows.push({
                'Team Name': '',
                'Owner': '',
                'Remaining Budget': '',
                'Serial No.': '',
                'Player Name': '(No players bought)',
                'Role': '',
                'Base Price': '',
                'Bought Price': '',
            });
        } else {
            for (const p of team.players) {
                rows.push({
                    'Team Name': '',
                    'Owner': '',
                    'Remaining Budget': '',
                    'Serial No.': p.serial_number ?? '-',
                    'Player Name': p.name,
                    'Role': p.role,
                    'Base Price': p.base_price,
                    'Bought Price': p.sold_price,
                });
            }
        }

        // Empty row as separator
        rows.push({});
    }

    // Create workbook
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    // Set column widths
    ws['!cols'] = [
        { wch: 22 }, // Team Name
        { wch: 18 }, // Owner
        { wch: 18 }, // Remaining Budget
        { wch: 12 }, // Serial No.
        { wch: 25 }, // Player Name
        { wch: 15 }, // Role
        { wch: 14 }, // Base Price
        { wch: 14 }, // Bought Price
    ];

    XLSX.utils.book_append_sheet(wb, ws, 'Teams Report');

    const outputPath = join(__dirname, '..', 'Auction_Teams_Report.xlsx');
    XLSX.writeFile(wb, outputPath);

    console.log(`\n✅ Report generated: ${outputPath}`);
}

generateReport().catch(err => {
    console.error('❌ Unexpected error:', err);
    process.exit(1);
});

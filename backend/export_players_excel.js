import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import xlsx from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function exportPlayers() {
    try {
        console.log('Fetching players from Supabase...');
        const { data: players, error } = await supabase
            .from('players')
            .select('serial_number, name')
            .order('serial_number', { ascending: true });

        if (error) {
            console.error('Error fetching players:', error);
            process.exit(1);
        }

        console.log(`Fetched ${players.length} players.`);

        // Sort just in case order is not exactly as expected due to string types, but order by serial_number in query should be fine if it's numeric.
        // If serial_number is string, let's sort numerically.
        players.sort((a, b) => {
            const numA = parseInt(a.serial_number, 10);
            const numB = parseInt(b.serial_number, 10);
            if (isNaN(numA)) return 1;
            if (isNaN(numB)) return -1;
            return numA - numB;
        });

        // Map to expected format
        const excelData = players.map(player => ({
            'Serial number': player.serial_number,
            'Player name': player.name
        }));

        // Create workbook
        const wb = xlsx.utils.book_new();
        const ws = xlsx.utils.json_to_sheet(excelData);

        xlsx.utils.book_append_sheet(wb, ws, "Players");

        const exportPath = join(__dirname, '..', 'Players_List.xlsx');
        xlsx.writeFile(wb, exportPath);

        console.log(`Excel file successfully created at: ${exportPath}`);
    } catch (err) {
        console.error('Unexpected error:', err);
    }
}

exportPlayers();

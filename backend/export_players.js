import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import * as xlsx from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure .env is loaded
const envPath = join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    console.error('.env file not found at:', envPath);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function exportPlayers() {
    console.log('Fetching players from Supabase...');
    const { data: players, error } = await supabase
        .from('players')
        .select('serial_number, name, role')
        .order('serial_number', { ascending: true, nullsFirst: false });

    if (error) {
        console.error('Error fetching players:', error);
        return;
    }

    if (!players || players.length === 0) {
        console.log('No players found in the database.');
        return;
    }

    console.log(`Found ${players.length} players. Generating Excel file...`);

    // Format data: Serial Number, Name, Role
    const formattedData = players.map(player => ({
        'Serial Number': player.serial_number || '',
        'Name': player.name || '',
        'Role': player.role || ''
    }));

    // Create a new workbook and add the worksheet
    const worksheet = xlsx.utils.json_to_sheet(formattedData);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Players');

    // Save the file to the root directory
    const outputPath = join(dirname(__dirname), 'current_auction_players.xlsx');
    xlsx.writeFile(workbook, outputPath);

    console.log(`Successfully generated Excel file at: ${outputPath}`);
}

exportPlayers();

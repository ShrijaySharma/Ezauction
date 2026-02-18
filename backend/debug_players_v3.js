
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure .env is loaded from same directory
const envPath = join(__dirname, '.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    console.error('.env file not found at:', envPath);
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; // Using the key from .env

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in output');
    console.log('URL:', supabaseUrl);
    console.log('KEY:', supabaseKey ? 'Found' : 'Missing');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('--- Checking PLAYERS ---');
    const { data: players, error } = await supabase
        .from('players')
        .select('id, name, status, was_unsold')
        .limit(5);

    if (error) {
        console.error('Error fetching players:', error);
    } else {
        console.log('Players sample:', players);
        if (players.length > 0) {
            console.log('Type of was_unsold:', typeof players[0].was_unsold);
        }
    }

    console.log('\n--- Checking AUCTION STATE ---');
    const { data: state, error: stateError } = await supabase
        .from('auction_state')
        .select('*')
        .eq('id', 1);

    if (stateError) {
        console.error('Error fetching state:', stateError);
    } else {
        console.log('Auction State:', state);
    }

    console.log('\n--- Checking TEAMS ---');
    const { data: teams, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .limit(2);

    if (teamsError) {
        console.error('Error fetching teams state:', teamsError);
    } else {
        console.log('Teams sample:', teams);
    }
}

checkData();

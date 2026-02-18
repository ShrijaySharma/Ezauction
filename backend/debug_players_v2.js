
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars
const envPath = join(__dirname, '.env');
const envConfig = dotenv.parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.SUPABASE_URL;
const supabaseKey = envConfig.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPlayers() {
    console.log('Checking players table...');

    const { data: players, error } = await supabase
        .from('players')
        .select('id, name, status, was_unsold')
        .limit(5);

    if (error) {
        console.error('Error fetching players:', error);
        return;
    }

    console.log('Players sample:', players);
    if (players.length > 0) {
        console.log('Type of was_unsold:', typeof players[0].was_unsold);
        console.log('Value of was_unsold:', players[0].was_unsold);
    }

    // Check auction state
    const { data: state, error: stateError } = await supabase
        .from('auction_state')
        .select('*')
        .eq('id', 1);

    if (stateError) {
        console.error('Error fetching state:', stateError);
    } else {
        console.log('Auction State:', state);
    }
}

checkPlayers();


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
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('--- Checking AUCTION STATE (id=1) ---');
    let { data: state, error: stateError } = await supabase
        .from('auction_state')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

    if (stateError) {
        console.error('Error fetching state:', stateError);
    } else {
        console.log('Auction State:', JSON.stringify(state, null, 2));

        if (!state) {
            console.log('State not found! Inserting default row...');
            const { error: insertError } = await supabase.from('auction_state').insert([{ id: 1, status: 'STOPPED', max_players_per_team: 15 }]);
            if (insertError) console.error('Insert error:', insertError);
            else console.log('Inserted default state.');
        }
    }

    console.log('\n--- Testing UPDATE max_players_per_team to 12 ---');
    const { error: updateError } = await supabase
        .from('auction_state')
        .update({ max_players_per_team: 12 })
        .eq('id', 1);

    if (updateError) {
        console.error('Update failed:', updateError);
    } else {
        console.log('Update successful.');
        const { data: newState } = await supabase.from('auction_state').select('max_players_per_team').eq('id', 1).single();
        console.log('New max_players:', newState?.max_players_per_team);
    }
}

checkData();

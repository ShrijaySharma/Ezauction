
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ensure .env is loaded
const envPath = join(__dirname, '.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHostLogic() {
    console.log('--- Simulating Host Logic ---');

    // 1. Get State
    const { data: state, error: stateError } = await supabase
        .from('auction_state')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

    if (stateError) {
        console.error('Error fetching state:', stateError);
        return;
    }

    console.log('State:', state);
    const currentPlayerId = state ? state.current_player_id : null;
    console.log('Current Player ID:', currentPlayerId);

    // 2. Prepare promises
    const promises = [
        supabase.from('players').select('id', { count: 'exact', head: true }).eq('status', 'SOLD'),
        supabase.from('players').select('id', { count: 'exact', head: true }).eq('status', 'UNSOLD'),
        supabase.from('players').select('id', { count: 'exact', head: true }).eq('status', 'AVAILABLE')
    ];

    if (currentPlayerId) {
        console.log('Adding player and bid queries...');
        promises.push(supabase.from('players').select('*').eq('id', currentPlayerId).single());
        promises.push(
            supabase.from('bids')
                .select('*')
                .eq('player_id', currentPlayerId)
                .order('amount', { ascending: false })
                .limit(1)
                .maybeSingle()
        );
    }

    // 3. Execute
    const results = await Promise.all(promises);

    console.log('Results length:', results.length);

    const soldResult = results[0];
    console.log('Sold Count:', soldResult.count);

    if (currentPlayerId) {
        const playerResult = results[3];
        const bidResult = results[4];

        console.log('Player Result:', JSON.stringify(playerResult, null, 2));
        console.log('Bid Result:', JSON.stringify(bidResult, null, 2));
    } else {
        console.log('No current player, skipping player/bid check');
    }
}

checkHostLogic();

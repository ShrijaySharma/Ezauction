import { supabase } from './backend/supabaseClient.js';

async function checkState() {
    console.log('Checking auction state...');
    const { data: state, error } = await supabase
        .from('auction_state')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('Auction State:', state);

    if (state?.current_player_id) {
        const { data: player } = await supabase
            .from('players')
            .select('id, name, status')
            .eq('id', state.current_player_id)
            .single();
        console.log('Current Player:', player);
    } else {
        console.log('No current player set.');
    }
}

checkState();

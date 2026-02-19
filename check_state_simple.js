import { supabase } from './backend/supabaseClient.js';

async function checkState() {
    const { data: state, error } = await supabase
        .from('auction_state')
        .select('current_player_id, status')
        .eq('id', 1)
        .maybeSingle();

    if (error) {
        console.error('DB Error:', error.message);
    } else {
        console.log('Auction State:', JSON.stringify(state, null, 2));
        if (state?.current_player_id) {
            const { data: player } = await supabase.from('players').select('name').eq('id', state.current_player_id).single();
            console.log('Active Player:', player ? player.name : 'Unknown');
        }
    }
}

checkState();

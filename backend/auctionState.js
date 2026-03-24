import { supabase } from './supabaseClient.js';

// Centralized in-memory cache for auction state
let auctionStateCache = {
    id: 1,
    status: 'STOPPED',
    current_player_id: null,
    bidding_locked: 0,
    bid_increment_1: 500,
    bid_increment_2: 1000,
    bid_increment_3: 1000,
    max_players_per_team: 10,
    enforce_max_bid: 0,
    updated_at: new Date()
};

/**
 * Initializes or refreshes the auction state cache from Supabase.
 * Call this on server startup and after any state mutation.
 */
export async function refreshAuctionState() {
    try {
        const { data, error } = await supabase
            .from('auction_state')
            .select('*')
            .eq('id', 1)
            .maybeSingle();

        if (error) {
            console.error('[Cache] Error refreshing auction state:', error);
            return;
        }

        if (data) {
            auctionStateCache = { ...data };
            // console.log('[Cache] Auction state synchronized');
        } else {
            // If it doesn't exist, create it (id=1 is standard)
            console.warn('[Cache] Auction state not found. Initializing record...');
            const { error: insertError } = await supabase
                .from('auction_state')
                .insert([{ id: 1, status: 'STOPPED' }]);
            
            if (insertError) console.error('[Cache] Error creating initial state:', insertError);
            // After insert, the next refresh will pick it up, or we just keep the default
        }
    } catch (err) {
        console.error('[Cache] Unexpected error in refreshAuctionState:', err);
    }
}

/**
 * Returns the currently cached auction state.
 * Use this instead of querying Supabase for auction_state.
 */
export function getAuctionState() {
    return auctionStateCache;
}

// Export the raw cache for advanced use cases (not recommended for simple reads)
export { auctionStateCache };

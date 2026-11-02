import { supabase } from './supabaseClient.js';

// ─── Per-auction state caches (Map keyed by auctionId) ───────────────────────
const auctionStateCaches = new Map();        // auctionId → auction_state row
const tradingWindowStates = new Map();       // auctionId → { isOpen, trades[] }
const adminAnonymousBids = new Map();        // auctionId → { amount, playerId }

function defaultAuctionState(auctionId) {
    return {
        auction_id: auctionId,
        status: 'STOPPED',
        current_player_id: null,
        bidding_locked: 0,
        bid_increment_1: 500,
        bid_increment_2: 1000,
        bid_increment_3: 5000,
        max_players_per_team: 10,
        enforce_max_bid: 0,
        sequential_mode: 0,
        sequential_last_serial: null,
        category_queue: null,
        category_slot_index: 0,
        category_slot_served: 0,
        updated_at: new Date()
    };
}

/**
 * Initializes or refreshes the auction state cache for a specific auction.
 * Call this on server startup (for all active auctions) and after any state mutation.
 */
export async function refreshAuctionState(auctionId) {
    try {
        const { data, error } = await supabase
            .from('auction_state')
            .select('*')
            .eq('auction_id', auctionId)
            .maybeSingle();

        if (error) {
            console.error(`[Cache:${auctionId}] Error refreshing auction state:`, error);
            return;
        }

        if (data) {
            // Also merge persistent category queue state from auctions.broadcast_config if present
            let categoryQueue = data.category_queue ?? null;
            let slotIndex = data.category_slot_index ?? 0;
            let slotServed = data.category_slot_served ?? 0;

            try {
                const { data: aData } = await supabase
                    .from('auctions')
                    .select('broadcast_config')
                    .eq('id', auctionId)
                    .maybeSingle();
                const bCfg = aData?.broadcast_config || {};
                if (bCfg.category_queue !== undefined) categoryQueue = bCfg.category_queue;
                if (bCfg.category_slot_index !== undefined) slotIndex = bCfg.category_slot_index;
                if (bCfg.category_slot_served !== undefined) slotServed = bCfg.category_slot_served;
            } catch (_) {}

            auctionStateCaches.set(auctionId, {
                ...data,
                category_queue: categoryQueue,
                category_slot_index: slotIndex,
                category_slot_served: slotServed,
                broadcast_config: bCfg
            });
        } else {
            // Create it if missing
            console.warn(`[Cache:${auctionId}] Auction state not found. Initializing...`);
            const defaults = defaultAuctionState(auctionId);
            const { data: insertedState, error: insertError } = await supabase
                .from('auction_state')
                .insert([defaults])
                .select()
                .single();
            if (insertError) {
                console.error(`[Cache:${auctionId}] Error creating initial state:`, insertError);
            } else {
                auctionStateCaches.set(auctionId, insertedState);
            }
        }
    } catch (err) {
        console.error(`[Cache:${auctionId}] Unexpected error in refreshAuctionState:`, err);
    }
}

/**
 * Refresh all active auctions on server startup.
 */
export async function refreshAllAuctionStates() {
    try {
        const { data: auctions, error } = await supabase
            .from('auctions')
            .select('id')
            .eq('status', 'active');

        if (error) {
            console.error('[Cache] Error loading active auctions:', error);
            return;
        }

        if (!auctions || auctions.length === 0) {
            console.log('[Cache] No active auctions found on startup.');
            return;
        }

        await Promise.all(auctions.map(a => refreshAuctionState(a.id)));
        console.log(`[Cache] Loaded auction states for: ${auctions.map(a => a.id).join(', ')}`);
    } catch (err) {
        console.error('[Cache] Error in refreshAllAuctionStates:', err);
    }
}

/**
 * Returns the cached auction state for a specific auction.
 */
export function getAuctionState(auctionId) {
    return auctionStateCaches.get(auctionId) ?? defaultAuctionState(auctionId);
}

// ─── Trading Window State (per auction) ──────────────────────────────────────

export function getTradingWindowState(auctionId) {
    return tradingWindowStates.get(auctionId) ?? { isOpen: false, trades: [] };
}

export function setTradingWindowState(auctionId, newState) {
    const current = getTradingWindowState(auctionId);
    tradingWindowStates.set(auctionId, { ...current, ...newState });
}

export function addTradeToWindow(auctionId, trade) {
    const current = getTradingWindowState(auctionId);
    tradingWindowStates.set(auctionId, {
        ...current,
        trades: [trade, ...current.trades]
    });
}

export function resetTradingWindowState(auctionId) {
    tradingWindowStates.set(auctionId, { isOpen: false, trades: [] });
}

// ─── Admin Anonymous Bid (per auction, in-memory only) ────────────────────────

export function getAdminAnonymousBid(auctionId) {
    return adminAnonymousBids.get(auctionId) ?? { amount: 0, playerId: null };
}

export function setAdminAnonymousBid(auctionId, amount, playerId) {
    adminAnonymousBids.set(auctionId, { amount, playerId });
}

export function clearAdminAnonymousBid(auctionId) {
    adminAnonymousBids.set(auctionId, { amount: 0, playerId: null });
}

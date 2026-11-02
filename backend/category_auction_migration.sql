-- ============================================================
-- Category-Wise Auction Migration
-- Run once in your Supabase SQL editor if desired.
-- EzAuction also supports zero-migration mode by automatically
-- persisting category queues inside auctions.broadcast_config!
-- ============================================================

-- 1. Ensure category column exists on players table
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS category text DEFAULT NULL;

-- 2. Optional columns on auction_state
ALTER TABLE public.auction_state
  ADD COLUMN IF NOT EXISTS category_queue jsonb DEFAULT NULL;

ALTER TABLE public.auction_state
  ADD COLUMN IF NOT EXISTS category_slot_index integer DEFAULT 0;

ALTER TABLE public.auction_state
  ADD COLUMN IF NOT EXISTS category_slot_served integer DEFAULT 0;

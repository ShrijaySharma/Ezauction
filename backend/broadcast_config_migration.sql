-- ============================================================
-- Broadcast Config Migration
-- Run once in your Supabase SQL editor
-- ============================================================

ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS broadcast_config jsonb DEFAULT '{}';

-- Default all existing auctions to Theme 1 (black_gold), Main display
UPDATE public.auctions
  SET broadcast_config = '{"theme":"black_gold","hostDisplayMode":"main"}'::jsonb
  WHERE broadcast_config IS NULL OR broadcast_config = '{}'::jsonb;

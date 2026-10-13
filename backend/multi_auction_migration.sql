-- ============================================================
-- EzAuction Multi-Auction Migration
-- Run this in Supabase SQL Editor (one-time)
-- ============================================================

-- 1. Create the 'auctions' table (tenant root)
CREATE TABLE IF NOT EXISTS public.auctions (
  id            text primary key,                    -- slug e.g. "ipl2025"
  name          text not null,                       -- display name
  admin_username text unique not null,
  admin_password text not null,                      -- bcrypt hash
  status        text default 'active',               -- active | archived
  created_at    timestamptz default now()
);

-- 2. Add auction_id to all scoped tables
ALTER TABLE public.players      ADD COLUMN IF NOT EXISTS auction_id text REFERENCES public.auctions(id) ON DELETE CASCADE;
ALTER TABLE public.teams        ADD COLUMN IF NOT EXISTS auction_id text REFERENCES public.auctions(id) ON DELETE CASCADE;
ALTER TABLE public.bids         ADD COLUMN IF NOT EXISTS auction_id text REFERENCES public.auctions(id) ON DELETE CASCADE;
ALTER TABLE public.trades       ADD COLUMN IF NOT EXISTS auction_id text REFERENCES public.auctions(id) ON DELETE CASCADE;
ALTER TABLE public.users        ADD COLUMN IF NOT EXISTS auction_id text REFERENCES public.auctions(id) ON DELETE CASCADE;
ALTER TABLE public.auction_state ADD COLUMN IF NOT EXISTS auction_id text REFERENCES public.auctions(id) ON DELETE CASCADE;

-- 3. Add 'super_admin' as valid role for the users table role check
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'host', 'app_owner', 'owner', 'super_admin'));

-- 4. Performance indexes
CREATE INDEX IF NOT EXISTS idx_players_auction  ON public.players(auction_id);
CREATE INDEX IF NOT EXISTS idx_teams_auction    ON public.teams(auction_id);
CREATE INDEX IF NOT EXISTS idx_bids_auction     ON public.bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_trades_auction   ON public.trades(auction_id);
CREATE INDEX IF NOT EXISTS idx_users_auction    ON public.users(auction_id);
CREATE INDEX IF NOT EXISTS idx_astate_auction   ON public.auction_state(auction_id);

-- 5. Unique constraint: one auction_state row per auction
CREATE UNIQUE INDEX IF NOT EXISTS uq_astate_auction ON public.auction_state(auction_id);

-- EzAuction tenant hardening migration
-- Run once in the Supabase SQL Editor after deploying the matching backend.
-- This intentionally removes the obsolete unscoped legacy test data. It does
-- not remove super-admin accounts.

begin;

-- The old single-auction records cannot safely coexist with tenant rows.
-- First decouple cyclic and referencing columns so deletions don't violate constraints.
update public.auction_state set current_player_id = null where auction_id is null;
update public.teams set owner_id = null where auction_id is null;
update public.users set team_id = null where auction_id is null;

delete from public.bids where auction_id is null;
delete from public.trades where auction_id is null;
delete from public.players where auction_id is null;
delete from public.teams where auction_id is null;
delete from public.users where auction_id is null and role <> 'super_admin';
delete from public.auction_state where auction_id is null;

-- Ensure auction_state has an auto-incrementing id sequence
create sequence if not exists public.auction_state_id_seq;
select setval('public.auction_state_id_seq', greatest(coalesce((select max(id) from public.auction_state), 0) + 1, 1), false);
alter table public.auction_state alter column id set default nextval('public.auction_state_id_seq');

-- Team and owner names are unique inside an auction, not across the product.
alter table public.teams drop constraint if exists teams_name_key;
alter table public.users drop constraint if exists users_username_key;
create unique index if not exists uq_teams_auction_name
  on public.teams (auction_id, name);
create unique index if not exists uq_users_auction_username
  on public.users (auction_id, username)
  where auction_id is not null;
create unique index if not exists uq_super_admin_username
  on public.users (username)
  where role = 'super_admin';

-- Every auction-owned record now has a mandatory tenant identity.
alter table public.players alter column auction_id set not null;
alter table public.teams alter column auction_id set not null;
alter table public.bids alter column auction_id set not null;
alter table public.trades alter column auction_id set not null;
alter table public.auction_state alter column auction_id set not null;

-- Composite unique keys let PostgreSQL reject cross-auction relationships even
-- if a future application query accidentally omits auction_id.
create unique index if not exists uq_players_auction_id on public.players (auction_id, id);
create unique index if not exists uq_teams_auction_id on public.teams (auction_id, id);
create unique index if not exists uq_users_auction_id on public.users (auction_id, id);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'players_sold_team_same_auction_fk') then
    alter table public.players add constraint players_sold_team_same_auction_fk
      foreign key (auction_id, sold_to_team) references public.teams (auction_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bids_player_same_auction_fk') then
    alter table public.bids add constraint bids_player_same_auction_fk
      foreign key (auction_id, player_id) references public.players (auction_id, id)
      on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'bids_team_same_auction_fk') then
    alter table public.bids add constraint bids_team_same_auction_fk
      foreign key (auction_id, team_id) references public.teams (auction_id, id)
      on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'users_team_same_auction_fk') then
    alter table public.users add constraint users_team_same_auction_fk
      foreign key (auction_id, team_id) references public.teams (auction_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'teams_owner_same_auction_fk') then
    alter table public.teams add constraint teams_owner_same_auction_fk
      foreign key (auction_id, owner_id) references public.users (auction_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trades_player_same_auction_fk') then
    alter table public.trades add constraint trades_player_same_auction_fk
      foreign key (auction_id, player_id) references public.players (auction_id, id)
      on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trades_from_team_same_auction_fk') then
    alter table public.trades add constraint trades_from_team_same_auction_fk
      foreign key (auction_id, from_team_id) references public.teams (auction_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'trades_to_team_same_auction_fk') then
    alter table public.trades add constraint trades_to_team_same_auction_fk
      foreign key (auction_id, to_team_id) references public.teams (auction_id, id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'auction_state_player_same_auction_fk') then
    alter table public.auction_state add constraint auction_state_player_same_auction_fk
      foreign key (auction_id, current_player_id) references public.players (auction_id, id)
      on delete set null;
  end if;
end $$;

-- Durable server-side sessions. RLS intentionally has no public policy: only
-- the backend's service-role client can read or write session payloads.
create table if not exists public.app_sessions (
  sid text primary key,
  data jsonb not null,
  expires_at timestamptz not null
);
create index if not exists idx_app_sessions_expires_at
  on public.app_sessions (expires_at);
alter table public.app_sessions enable row level security;

commit;

create table if not exists public.user_persona_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  persona_id text not null,
  persona_name text,
  usage_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, persona_id)
);
alter table public.user_persona_usage enable row level security;
create policy "read own persona usage" on public.user_persona_usage for select using (auth.uid() = user_id);
create policy "upsert own persona usage" on public.user_persona_usage for insert with check (auth.uid() = user_id);
create policy "update own persona usage" on public.user_persona_usage for update using (auth.uid() = user_id);

create table if not exists public.user_character_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id text not null,
  character_name text,
  usage_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, character_id)
);
alter table public.user_character_usage enable row level security;
create policy "read own character usage" on public.user_character_usage for select using (auth.uid() = user_id);
create policy "upsert own character usage" on public.user_character_usage for insert with check (auth.uid() = user_id);
create policy "update own character usage" on public.user_character_usage for update using (auth.uid() = user_id);

create table if not exists public.user_persona_pins (
  user_id uuid not null references auth.users(id) on delete cascade,
  persona_id text not null,
  pinned boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, persona_id)
);
alter table public.user_persona_pins enable row level security;
create policy "read own persona pins" on public.user_persona_pins for select using (auth.uid() = user_id);
create policy "upsert own persona pins" on public.user_persona_pins for insert with check (auth.uid() = user_id);
create policy "update own persona pins" on public.user_persona_pins for update using (auth.uid() = user_id);

create table if not exists public.user_character_pins (
  user_id uuid not null references auth.users(id) on delete cascade,
  character_id text not null,
  pinned boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, character_id)
);
alter table public.user_character_pins enable row level security;
create policy "read own character pins" on public.user_character_pins for select using (auth.uid() = user_id);
create policy "upsert own character pins" on public.user_character_pins for insert with check (auth.uid() = user_id);
create policy "update own character pins" on public.user_character_pins for update using (auth.uid() = user_id);
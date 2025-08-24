-- 2025-08-16: Optional table for user_history_tags (per-entry tag list)
create table if not exists public.user_history_tags (
  user_id uuid not null references auth.users(id) on delete cascade,
  history_id text not null,
  tags text[] not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, history_id)
);

alter table public.user_history_tags enable row level security;

create policy "user can read own tags" on public.user_history_tags
for select using (auth.uid() = user_id);

create policy "user can upsert own tags" on public.user_history_tags
for insert with check (auth.uid() = user_id);

create policy "user can update own tags" on public.user_history_tags
for update using (auth.uid() = user_id);

do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='user_history' and column_name='tags') then
    alter table public.user_history add column tags text[] default '{}';
  end if;
end $$;

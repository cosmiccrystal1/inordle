-- Run once before the catalog update. Safe to retry.
begin;
create table if not exists public.word_forms(
 plural text primary key, singular text not null references public.dictionary(word)
);
create table if not exists public.daily_puzzles(day date primary key, letters text not null);
alter table public.word_forms enable row level security;
alter table public.daily_puzzles enable row level security;
revoke all on public.word_forms,public.daily_puzzles from anon,authenticated;
create or replace function public.normalize_word(w text) returns text
language sql stable set search_path = '' as $$
 select coalesce((select singular from public.word_forms where plural=w),w);
$$;
revoke all on function public.normalize_word(text) from public,anon,authenticated;

-- Preserve the live trail for everyone, including new arrivals, until New York midnight.
insert into public.daily_puzzles(day,letters)
select (statement_timestamp() at time zone 'America/New_York')::date,
 public.trail((statement_timestamp() at time zone 'America/New_York')::date)
on conflict(day) do nothing;
commit;

-- Existing v3 deployment: preserve the current day's puzzle before replacing the catalog.
begin;
insert into public.daily_puzzles(day,letters)
select (statement_timestamp() at time zone 'America/New_York')::date,
 public.trail((statement_timestamp() at time zone 'America/New_York')::date)
on conflict(day) do nothing;
commit;

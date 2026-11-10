-- Existing v2 deployment: run after 01-prepare.sql and 02-trails.sql.
begin;
do $$ begin
 if (select count(*) from public.blocked_words) < 1915 then
  raise exception 'Load the moderation list before updating validation';
 end if;
end $$;
create or replace function public.play(action text, guess text default null, request_id uuid default null, expected_day date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 d date := (statement_timestamp() at time zone 'America/New_York')::date;
 g public.daily_games%rowtype;
 letters text := public.trail(d);
 w text := lower(btrim(guess));
 raw_word text := lower(btrim(guess));
 valid boolean;
 eligible boolean := true;
 rejection text := null;
 done boolean;
 rows jsonb := '[]'::jsonb;
begin
 if uid is null then raise exception 'Please sign in anonymously to play.'; end if;
 if action not in ('status','submit') or action is null then raise exception 'Unknown action'; end if;
 if action='submit' and (expected_day is distinct from d) then raise exception 'A new trail has started. Refresh the page.'; end if;
 if action='submit' and (request_id is null or guess is null) then raise exception 'Malformed submission'; end if;
 insert into public.daily_games(player,day) values(uid,d) on conflict do nothing;
 select * into g from public.daily_games where player=uid and day=d for update;
 -- Row lock makes parallel requests atomic. Request IDs make network retries idempotent.
 if action='submit' then
  w := public.normalize_word(raw_word);
  if raw_word !~ '^[a-z]{2,32}$' then
   eligible := false; rejection := 'Use 2–32 English letters. No attempt used.';
  elsif exists(select 1 from public.blocked_words where word=raw_word or word=w) then
   eligible := false; rejection := 'That word cannot be submitted. No attempt used.';
  end if;
 end if;
 if action='submit' and eligible and g.answer is null and cardinality(g.attempts)<3 and not(request_id=any(g.requests)) then
  valid := raw_word ~ '^[a-z]{2,32}$' and exists(select 1 from public.dictionary where word=raw_word)
   and exists(select 1 from public.dictionary where word=w)
   and w ~ ('.*' || array_to_string(regexp_split_to_array(lower(letters),''),'.*') || '.*');
  update public.daily_games set attempts=array_append(attempts,w), requests=array_append(requests,request_id), answer=case when valid then w else null end
   where player=uid and day=d returning * into g;
 end if;
 done := g.answer is not null or cardinality(g.attempts)>=3;
 if done then
  select coalesce(jsonb_agg(jsonb_build_object('word',s.answer,'count',s.n) order by s.n desc,s.answer),'[]'::jsonb) into rows
  from (select public.normalize_word(answer) as answer,count(*) as n from public.daily_games where day=d and answer is not null group by public.normalize_word(answer)) s;
 end if;
 return jsonb_build_object('rejection',rejection,'day',d,'letters',letters,'attempts',g.attempts,'answer',g.answer,'done',done,'rankings',rows,'answer_count',(select count(*) from public.daily_games where day=d and answer is not null));
end $$;
revoke all on function public.play(text,text,uuid,date) from public, anon;
grant execute on function public.play(text,text,uuid,date) to authenticated;

commit;

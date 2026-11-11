-- Apply to the existing v4 database.
begin;
alter table public.dictionary drop constraint if exists dictionary_word_check;
alter table public.dictionary add constraint dictionary_word_check check(word ~ '^[a-z]{2,50}$');
create or replace function public.play(action text, guess text default null, request_id uuid default null, expected_day date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 d date := (statement_timestamp() at time zone 'America/New_York')::date;
 g public.daily_games%rowtype;
 letters text := public.trail(d);
 w text := lower(btrim(guess));
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
  if length(w)<2 then
   eligible := false; rejection := 'Too short';
  elsif length(w)>50 then
   eligible := false; rejection := 'Too long';
  elsif w !~ '^[a-z]+$'
   or exists(select 1 from public.blocked_words where word=w)
   or not exists(select 1 from public.dictionary where word=w) then
   eligible := false; rejection := 'Not a word';
  end if;
 end if;
 if action='submit' and eligible and g.answer is null and cardinality(g.attempts)<3 and not(request_id=any(g.requests)) then
  valid := w ~ ('.*' || array_to_string(regexp_split_to_array(lower(letters),''),'.*') || '.*');
  update public.daily_games set attempts=array_append(attempts,w), requests=array_append(requests,request_id), answer=case when valid then w else null end
   where player=uid and day=d returning * into g;
 end if;
 done := g.answer is not null or cardinality(g.attempts)>=3;
 if done then
  select coalesce(jsonb_agg(jsonb_build_object('word',s.answer,'count',s.n) order by s.n desc,s.answer),'[]'::jsonb) into rows
  from (select answer,count(*) as n from public.daily_games where day=d and answer is not null group by answer) s;
 end if;
 return jsonb_build_object('rejection',rejection,'day',d,'letters',letters,'attempts',g.attempts,'answer',g.answer,'done',done,'rankings',rows,'answer_count',(select count(*) from public.daily_games where day=d and answer is not null));
end $$;
revoke all on function public.play(text,text,uuid,date) from public, anon;
grant execute on function public.play(text,text,uuid,date) to authenticated;
commit;

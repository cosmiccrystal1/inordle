-- Run schema.sql, dictionary.sql, then trails.sql before opening the site.
create table public.dictionary(word text primary key check(word ~ '^[a-z]{2,32}$'));
create table public.daily_games(
 player uuid not null references auth.users(id) on delete cascade,
 day date not null,
 attempts text[] not null default '{}',
 requests uuid[] not null default '{}',
 answer text,
 primary key(player,day),
 check(cardinality(attempts)<=3)
);
alter table public.dictionary enable row level security;
alter table public.daily_games enable row level security;
-- No table policies: clients only access the narrowly scoped function below.
revoke all on public.dictionary, public.daily_games from anon, authenticated;

-- The catalog-backed trail function is installed by trails.sql.

create function public.play(action text, guess text default null, request_id uuid default null, expected_day date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 uid uuid := auth.uid();
 d date := (statement_timestamp() at time zone 'America/New_York')::date;
 g public.daily_games%rowtype;
 letters text := public.trail(d);
 w text := lower(btrim(guess));
 valid boolean;
 done boolean;
 rows jsonb := '[]'::jsonb;
begin
 if uid is null then raise exception 'Please sign in anonymously to play.'; end if;
 if action not in ('status','submit') or action is null then raise exception 'Unknown action'; end if;
 if action='submit' and (expected_day is distinct from d) then raise exception 'A new trail has started. Refresh the page.'; end if;
 if action='submit' and (request_id is null or guess is null or length(guess)>100) then raise exception 'Malformed submission'; end if;
 insert into public.daily_games(player,day) values(uid,d) on conflict do nothing;
 select * into g from public.daily_games where player=uid and day=d for update;
 -- Row lock makes parallel requests atomic. Request IDs make network retries idempotent.
 if action='submit' and g.answer is null and cardinality(g.attempts)<3 and not(request_id=any(g.requests)) then
  valid := w ~ '^[a-z]{2,32}$' and exists(select 1 from public.dictionary where word=w)
   and w ~ ('.*' || array_to_string(regexp_split_to_array(lower(letters),''),'.*') || '.*');
  update public.daily_games set attempts=array_append(attempts,w), requests=array_append(requests,request_id), answer=case when valid then w else null end
   where player=uid and day=d returning * into g;
 end if;
 done := g.answer is not null or cardinality(g.attempts)>=3;
 if done then
  select coalesce(jsonb_agg(jsonb_build_object('word',s.answer,'count',s.n) order by s.n desc,s.answer),'[]'::jsonb) into rows
  from (select answer,count(*) as n from public.daily_games where day=d and answer is not null group by answer) s;
 end if;
 return jsonb_build_object('day',d,'letters',letters,'attempts',g.attempts,'answer',g.answer,'done',done,'rankings',rows,'answer_count',(select count(*) from public.daily_games where day=d and answer is not null));
end $$;
revoke all on function public.play(text,text,uuid,date) from public, anon;
grant execute on function public.play(text,text,uuid,date) to authenticated;
create index daily_answers on public.daily_games(day,answer) where answer is not null;

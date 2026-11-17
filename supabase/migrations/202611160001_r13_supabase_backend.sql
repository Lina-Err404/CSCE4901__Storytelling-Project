-- Add the relational fields used by the Supabase-backed class and lobby API.
alter table public.classes
  add column if not exists name text not null default 'Class',
  add column if not exists active_lobby_id uuid,
  add column if not exists created_at timestamptz not null default now();

alter table public.lobbies
  add column if not exists lobby_id uuid not null default gen_random_uuid(),
  add column if not exists lobby_name text not null default '',
  add column if not exists join_code text,
  add column if not exists status text not null default 'waiting',
  add column if not exists game_mode text not null default 'divide',
  add column if not exists min_words integer not null default 0,
  add column if not exists max_words integer not null default 100,
  add column if not exists max_players integer not null default 500,
  add column if not exists player_count integer not null default 0,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists lobbies_lobby_id_unique on public.lobbies(lobby_id);
create unique index if not exists lobbies_join_code_unique on public.lobbies(join_code);
create index if not exists lobbies_class_status_created_idx
  on public.lobbies(class_id, status, created_at desc);

create table if not exists public.class_roster (
  class_id uuid not null references public.classes(class_id) on delete cascade,
  student_id text not null,
  display_name text not null,
  created_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

alter table public.lobby_participants
  add column if not exists display_name text not null default 'Student',
  add column if not exists status text not null default 'joined';

create unique index if not exists lobby_participants_lobby_student_unique
  on public.lobby_participants(lobby_id, student_id);

alter table public.classes enable row level security;
alter table public.lobbies enable row level security;
alter table public.class_roster enable row level security;
alter table public.lobby_participants enable row level security;

create table if not exists public.stories (
  story_id text primary key,
  title text not null default '',
  "group" text not null default '',
  authors text not null default '',
  text text[] not null default '{}',
  feedback text not null default '',
  status text not null default 'pending' check (status in ('pending', 'approved')),
  created_at timestamptz not null default now(),
  feedback_updated_at timestamptz,
  approved_at timestamptz
);

alter table public.stories enable row level security;
drop policy if exists stories_teacher_read on public.stories;
create policy stories_teacher_read on public.stories
  for select to authenticated
  using (exists (
    select 1 from public.profiles as profile
    where profile.id = (select auth.uid()) and profile.role = 'teacher'
  ));
drop policy if exists stories_teacher_insert on public.stories;
create policy stories_teacher_insert on public.stories
  for insert to authenticated
  with check (exists (
    select 1 from public.profiles as profile
    where profile.id = (select auth.uid()) and profile.role = 'teacher'
  ));
drop policy if exists stories_teacher_update on public.stories;
create policy stories_teacher_update on public.stories
  for update to authenticated
  using (exists (
    select 1 from public.profiles as profile
    where profile.id = (select auth.uid()) and profile.role = 'teacher'
  ))
  with check (exists (
    select 1 from public.profiles as profile
    where profile.id = (select auth.uid()) and profile.role = 'teacher'
  ));

create or replace function public.r13_upsert_class_roster(
  p_class_id uuid,
  p_students jsonb
) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.class_roster (class_id, student_id, display_name)
  select p_class_id, student.student_id, student.display_name
  from jsonb_to_recordset(p_students) as student(student_id text, display_name text)
  on conflict (class_id, student_id)
  do update set display_name = excluded.display_name;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.r13_remove_roster_student(
  p_class_id uuid,
  p_student_id text
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_lobby_id uuid;
begin
  delete from public.class_roster
  where class_id = p_class_id and student_id = p_student_id;
  if not found then return null; end if;

  select class.active_lobby_id into v_lobby_id
  from public.classes as class
  where class.class_id = p_class_id;

  if v_lobby_id is not null then
    update public.lobby_participants as participant
    set status = 'kicked'
    from public.lobbies as lobby
    where participant.lobby_id = v_lobby_id
      and participant.student_id = p_student_id
      and lobby.lobby_id = v_lobby_id
      and lobby.status in ('waiting', 'active');
    if not found then return null; end if;
  end if;

  return v_lobby_id;
end;
$$;

create or replace function public.r13_create_lobby(
  p_teacher_id uuid,
  p_class_id uuid,
  p_join_code text,
  p_game_mode text,
  p_min_words integer,
  p_max_words integer,
  p_max_players integer default 500
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_active_lobby_id uuid;
  v_lobby_id uuid;
begin
  perform 1 from public.classes as class
  where class.class_id = p_class_id and class.teacher_id = p_teacher_id
  for update;
  if not found then
    raise exception 'Class not found for this teacher' using errcode = '42501';
  end if;

  select lobby.lobby_id into v_active_lobby_id
  from public.lobbies as lobby
  where lobby.class_id = p_class_id and lobby.status in ('waiting', 'active')
  order by lobby.created_at desc
  limit 1;
  if v_active_lobby_id is not null then
    return jsonb_build_object('activeLobbyId', v_active_lobby_id);
  end if;

  insert into public.lobbies (
    lobby_id, class_id, lobby_name, join_code, status, game_mode,
    min_words, max_words, max_players, player_count
  ) values (
    gen_random_uuid(), p_class_id, p_join_code, p_join_code, 'waiting', p_game_mode,
    p_min_words, p_max_words, p_max_players, 0
  )
  returning lobby_id into v_lobby_id;

  update public.classes set active_lobby_id = v_lobby_id
  where class_id = p_class_id;

  return jsonb_build_object('lobbyId', v_lobby_id);
end;
$$;

create or replace function public.r13_join_lobby(
  p_lobby_id uuid,
  p_student_id text,
  p_display_name text default 'Student'
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_status text;
  v_max_players integer;
  v_player_count integer;
  v_existing_status text;
  v_already_joined boolean;
begin
  select lobby.status, lobby.max_players into v_status, v_max_players
  from public.lobbies as lobby
  where lobby.lobby_id = p_lobby_id
  for update;
  if not found or v_status <> 'waiting' then
    raise exception 'Lobby not found or already started' using errcode = 'P0002';
  end if;

  select participant.status into v_existing_status
  from public.lobby_participants as participant
  where participant.lobby_id = p_lobby_id and participant.student_id = p_student_id;
  if found and v_existing_status in ('kicked', 'removed') then
    raise exception 'Student seat is unavailable' using errcode = '42501';
  end if;
  v_already_joined := found;

  select count(*) into v_player_count
  from public.lobby_participants as participant
  where participant.lobby_id = p_lobby_id
    and participant.status not in ('kicked', 'removed');

  if not v_already_joined and v_player_count >= v_max_players then
    raise exception 'Lobby is full' using errcode = 'P0001';
  end if;

  insert into public.lobby_participants (lobby_id, student_id, display_name, status)
  values (p_lobby_id, p_student_id, coalesce(nullif(btrim(p_display_name), ''), 'Student'), 'joined')
  on conflict (lobby_id, student_id)
  do update set display_name = excluded.display_name;

  if not v_already_joined then
    v_player_count := v_player_count + 1;
  end if;
  update public.lobbies set player_count = v_player_count
  where lobby_id = p_lobby_id;

  return jsonb_build_object(
    'playerCount', v_player_count,
    'alreadyJoined', v_already_joined
  );
end;
$$;

create or replace function public.r13_update_lobby_status(
  p_lobby_id uuid,
  p_status text
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_class_id uuid;
begin
  if p_status not in ('waiting', 'active', 'ended') then
    raise exception 'Invalid lobby status' using errcode = '22023';
  end if;

  update public.lobbies
  set status = p_status
  where lobby_id = p_lobby_id
  returning class_id into v_class_id;
  if not found then raise exception 'Lobby not found' using errcode = 'P0002'; end if;

  if p_status = 'ended' then
    update public.classes set active_lobby_id = null
    where class_id = v_class_id and active_lobby_id = p_lobby_id;
  end if;
end;
$$;

create or replace function public.r13_kick_lobby_student(
  p_lobby_id uuid,
  p_student_id text
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.lobby_participants (lobby_id, student_id, display_name, status)
  values (p_lobby_id, p_student_id, 'Student', 'kicked')
  on conflict (lobby_id, student_id)
  do update set status = 'kicked';
end;
$$;

revoke execute on function public.r13_upsert_class_roster(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.r13_remove_roster_student(uuid, text) from public, anon, authenticated;
revoke execute on function public.r13_create_lobby(uuid, uuid, text, text, integer, integer, integer) from public, anon, authenticated;
revoke execute on function public.r13_join_lobby(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.r13_update_lobby_status(uuid, text) from public, anon, authenticated;
revoke execute on function public.r13_kick_lobby_student(uuid, text) from public, anon, authenticated;
grant execute on function public.r13_upsert_class_roster(uuid, jsonb) to service_role;
grant execute on function public.r13_remove_roster_student(uuid, text) to service_role;
grant execute on function public.r13_create_lobby(uuid, uuid, text, text, integer, integer, integer) to service_role;
grant execute on function public.r13_join_lobby(uuid, text, text) to service_role;
grant execute on function public.r13_update_lobby_status(uuid, text) to service_role;
grant execute on function public.r13_kick_lobby_student(uuid, text) to service_role;

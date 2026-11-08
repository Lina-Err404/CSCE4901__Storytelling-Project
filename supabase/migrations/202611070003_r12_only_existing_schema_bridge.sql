-- R12-ONLY BRIDGE FOR THE TEAM'S EXISTING SUPABASE SCHEMA.
-- Does not CREATE or REPLACE any application tables.
-- Only R12 class, roster, lobby, join-code, prompt and breakout operations.
-- Run only after reviewing the PRE-FLIGHT section in README. All functions are
-- service-role-only; browser clients must not be allowed to invoke them.
-- Features present in R12 but missing from the provided existing lobby schema.
alter table public.lobbies
  add column if not exists max_players integer not null default 500,
  add column if not exists min_words integer not null default 0,
  add column if not exists max_words integer not null default 100,
  add column if not exists starting_prompt text not null default '',
  add column if not exists prompt_type text not null default 'none',
  add column if not exists prompt_assignment_type text not null default 'entire-class';

-- A join code must identify exactly one lobby for secure joining.
-- First check for duplicate values via the pre-flight query in the README.
create unique index if not exists r12_existing_lobbies_join_code_uq on public.lobbies(join_code);

-- Keep existing database statuses: waiting = R12 open; active = R12 locked.
-- Teacher ID lives on classes, never on lobbies.
create or replace function public.r12_create_lobby(
 p_class_id uuid, p_teacher_id uuid, p_join_code text,
 p_game_mode text, p_min_words integer, p_max_words integer
) returns public.lobbies language plpgsql security invoker set search_path = '' as $$
declare v_class public.classes; v_created public.lobbies;
begin
  select * into v_class from public.classes where class_id=p_class_id for update;
  if not found or v_class.teacher_id is distinct from p_teacher_id then
    raise exception 'Class not found for this teacher' using errcode='P0001';
  end if;
  if exists (select 1 from public.lobbies where class_id=p_class_id and status <> 'closed') then
    raise exception 'Class already has an active lobby' using errcode='P0001';
  end if;
  if p_game_mode <> 'divide' or p_min_words < 0 or p_max_words < p_min_words or p_max_words > 1000 then
    raise exception 'Invalid lobby configuration' using errcode='P0001';
  end if;
  insert into public.lobbies (class_id, join_code, lobby_name, status, min_words, max_words)
    values (p_class_id, p_join_code, 'Story Session', 'waiting', p_min_words, p_max_words)
    returning * into v_created;
  return v_created;
end $$;

create or replace function public.r12_join_lobby(p_code text, p_student_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_lobby public.lobbies; v_status text; v_display text; v_count integer;
begin
  select * into v_lobby from public.lobbies where join_code=p_code for update;
  if not found or v_lobby.status='closed' then
    raise exception 'Could not join' using errcode='P0001';
  end if;
  if not exists (select 1 from public.class_students
    where class_id=v_lobby.class_id and student_id=p_student_id) then
    raise exception 'Could not join' using errcode='P0001';
  end if;
  select status into v_status from public.lobby_participants
    where lobby_id=v_lobby.lobby_id and student_id=p_student_id;
  if v_status is not null and v_status <> 'active' then
    raise exception 'Could not join' using errcode='P0001';
  end if;
  select count(*) into v_count from public.lobby_participants
    where lobby_id=v_lobby.lobby_id and status='active';
  select display_name into v_display from public.profiles where id=p_student_id;
  v_display := coalesce(nullif(v_display, ''), 'Student');
  if v_status='active' then
    return jsonb_build_object('lobbyId',v_lobby.lobby_id,'displayName',v_display,
      'playerCount',v_count,'alreadyJoined',true,'status',v_lobby.status);
  end if;
  if v_lobby.status <> 'waiting' or v_count >= v_lobby.max_players then
    raise exception 'Could not join' using errcode='P0001';
  end if;
  insert into public.lobby_participants(lobby_id,student_id,status)
    values(v_lobby.lobby_id,p_student_id,'active');
  return jsonb_build_object('lobbyId',v_lobby.lobby_id,'displayName',v_display,
    'playerCount',v_count+1,'alreadyJoined',false,'status',v_lobby.status);
end $$;

create or replace function public.r12_set_lobby_status(
 p_lobby_id uuid, p_teacher_id uuid, p_status text
) returns void language plpgsql security invoker set search_path = '' as $$
declare v_lobby public.lobbies; v_db_status text;
begin
  select l.* into v_lobby from public.lobbies l
    join public.classes c on c.class_id=l.class_id
    where l.lobby_id=p_lobby_id and c.teacher_id=p_teacher_id for update of l;
  if not found then raise exception 'Forbidden' using errcode='P0001'; end if;
  if v_lobby.status='closed' then raise exception 'Lobby is closed' using errcode='P0001'; end if;
  v_db_status := case p_status when 'open' then 'waiting'
                  when 'locked' then 'active' when 'closed' then 'closed' else null end;
  if v_db_status is null then raise exception 'Invalid status' using errcode='P0001'; end if;
  update public.lobbies set status=v_db_status where lobby_id=p_lobby_id;
end $$;

create or replace function public.r12_remove_roster_student(
 p_class_id uuid, p_teacher_id uuid, p_student_id uuid
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_lobby uuid;
begin
  perform 1 from public.classes where class_id=p_class_id and teacher_id=p_teacher_id for update;
  if not found then raise exception 'Forbidden' using errcode='P0001'; end if;
  select lobby_id into v_lobby from public.lobbies where class_id=p_class_id
    and status <> 'closed' order by created_at desc limit 1;
  delete from public.breakout_participants where student_id=p_student_id
    and lobby_id in (select lobby_id from public.lobbies where class_id=p_class_id
      and status <> 'closed');
  delete from public.lobby_participants where student_id=p_student_id
    and lobby_id in (select lobby_id from public.lobbies where class_id=p_class_id
      and status <> 'closed');
  delete from public.class_students where class_id=p_class_id and student_id=p_student_id;
  return v_lobby;
end $$;

create or replace function public.r12_kick_lobby_student(
 p_lobby_id uuid, p_teacher_id uuid, p_student_id uuid
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.lobbies l join public.classes c on c.class_id=l.class_id
    where l.lobby_id=p_lobby_id and c.teacher_id=p_teacher_id for update of l;
  if not found then raise exception 'Forbidden' using errcode='P0001'; end if;
  delete from public.breakout_participants where lobby_id=p_lobby_id and student_id=p_student_id;
  -- Existing status is text with default 'active'. Preserve seat and mark removed,
  -- so students cannot immediately rejoin a lobby after being kicked.
  update public.lobby_participants set status='removed'
    where lobby_id=p_lobby_id and student_id=p_student_id;
end $$;

create or replace function public.r12_replace_breakout_rooms(
 p_lobby_id uuid, p_teacher_id uuid, p_rooms jsonb
) returns void language plpgsql security invoker set search_path = '' as $$
declare v_lobby public.lobbies; v_room jsonb; v_member jsonb;
        v_room_id uuid; v_member_id uuid; v_name text; v_seen uuid[] := array[]::uuid[];
begin
  select l.* into v_lobby from public.lobbies l join public.classes c on c.class_id=l.class_id
    where l.lobby_id=p_lobby_id and c.teacher_id=p_teacher_id for update of l;
  if not found or v_lobby.status <> 'waiting' then
    raise exception 'Breakout rooms can only change before the session starts' using errcode='P0001';
  end if;
  if jsonb_typeof(p_rooms) <> 'array' or jsonb_array_length(p_rooms) > 100 then
    raise exception 'Invalid rooms' using errcode='P0001';
  end if;
  if exists(select 1 from public.stories s join public.breakout_rooms r on r.room_id=s.room_id
    where r.lobby_id=p_lobby_id) then
    raise exception 'Breakout rooms are locked after story creation' using errcode='P0001';
  end if;
  delete from public.breakout_participants where lobby_id=p_lobby_id;
  delete from public.breakout_rooms where lobby_id=p_lobby_id;
  for v_room in select value from jsonb_array_elements(p_rooms) loop
    if jsonb_typeof(v_room->'studentIds') <> 'array' or
       jsonb_array_length(v_room->'studentIds') < 2 or
       jsonb_typeof(v_room->'roomId') <> 'string' or
       jsonb_typeof(v_room->'roomName') <> 'string' then
      raise exception 'Invalid room' using errcode='P0001';
    end if;
    v_room_id := (v_room->>'roomId')::uuid;
    v_name := trim(v_room->>'roomName');
    if char_length(v_name) < 1 or char_length(v_name) > 100 then
      raise exception 'Invalid room name' using errcode='P0001';
    end if;
    insert into public.breakout_rooms (room_id,lobby_id,room_name)
      values (v_room_id,p_lobby_id,v_name);
    for v_member in select value from jsonb_array_elements(v_room->'studentIds') loop
      if jsonb_typeof(v_member) <> 'string' then
        raise exception 'Invalid student' using errcode='P0001';
      end if;
      v_member_id := (v_member #>> '{}')::uuid;
      if v_member_id=any(v_seen) or not exists (
        select 1 from public.lobby_participants where lobby_id=p_lobby_id
          and student_id=v_member_id and status='active'
      ) then raise exception 'Duplicate or inactive student' using errcode='P0001'; end if;
      v_seen := array_append(v_seen,v_member_id);
      insert into public.breakout_participants(lobby_id,room_id,student_id)
        values (p_lobby_id,v_room_id,v_member_id);
    end loop;
  end loop;
end $$;

-- Explicit grants: no public/anon/authenticated invocation of privileged RPCs.
revoke all on function public.r12_create_lobby(uuid,uuid,text,text,integer,integer) from PUBLIC,anon,authenticated;
revoke all on function public.r12_join_lobby(text,uuid) from PUBLIC,anon,authenticated;
revoke all on function public.r12_set_lobby_status(uuid,uuid,text) from PUBLIC,anon,authenticated;
revoke all on function public.r12_remove_roster_student(uuid,uuid,uuid) from PUBLIC,anon,authenticated;
revoke all on function public.r12_kick_lobby_student(uuid,uuid,uuid) from PUBLIC,anon,authenticated;
revoke all on function public.r12_replace_breakout_rooms(uuid,uuid,jsonb) from PUBLIC,anon,authenticated;
grant execute on function public.r12_create_lobby(uuid,uuid,text,text,integer,integer) to service_role;
grant execute on function public.r12_join_lobby(text,uuid) to service_role;
grant execute on function public.r12_set_lobby_status(uuid,uuid,text) to service_role;
grant execute on function public.r12_remove_roster_student(uuid,uuid,uuid) to service_role;
grant execute on function public.r12_kick_lobby_student(uuid,uuid,uuid) to service_role;
grant execute on function public.r12_replace_breakout_rooms(uuid,uuid,jsonb) to service_role;

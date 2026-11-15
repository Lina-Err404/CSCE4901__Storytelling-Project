-- R12 BRIDGE FOR THE EXISTING 11-TABLE SUPABASE PROJECT.
-- DOES NOT CREATE/REPLACE classes, class_students, lobbies, lobby_participants,
-- breakout_rooms, breakout_participants, profiles, stories, story_segments,
-- segment_drawings, or segment_feedback.
-- Run only after reviewing the PRE-FLIGHT section in README. All functions are
-- service-role-only; browser clients must not be allowed to invoke them.
create extension if not exists pgcrypto;

-- Features present in R12 but missing from the provided existing lobby schema.
alter table public.lobbies
  add column if not exists max_players integer not null default 500,
  add column if not exists min_words integer not null default 0,
  add column if not exists max_words integer not null default 100,
  add column if not exists starting_prompt text not null default '',
  add column if not exists prompt_type text not null default 'none',
  add column if not exists assignment_type text not null default 'entire-class';

-- A join code must identify exactly one lobby for secure joining.
-- First check for duplicate values via the pre-flight query in the README.
create unique index if not exists r12_existing_lobbies_join_code_uq on public.lobbies(join_code);

-- Keep original database statuses: waiting = R12 open; active = R12 locked.
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

-- Existing stories are linked to breakout_rooms.room_id (not a lobby_id).
-- If no teacher-created groups exist, establish exactly one default group for
-- the current lobby, then assign active participants to that group.
create or replace function public.r12_ensure_story(p_lobby_id uuid, p_student_id uuid)
returns public.stories language plpgsql security invoker set search_path = '' as $$
declare v_lobby public.lobbies; v_room uuid; v_story public.stories;
begin
  select * into v_lobby from public.lobbies where lobby_id=p_lobby_id for update;
  if not found or v_lobby.status <> 'active' then
    raise exception 'Story session has not started' using errcode='P0001';
  end if;
  if not exists(select 1 from public.lobby_participants
    where lobby_id=p_lobby_id and student_id=p_student_id and status='active') then
    raise exception 'Not an active participant' using errcode='P0001';
  end if;
  select room_id into v_room from public.breakout_participants
    where lobby_id=p_lobby_id and student_id=p_student_id limit 1;
  if v_room is null then
    if exists(select 1 from public.breakout_rooms where lobby_id=p_lobby_id) then
      raise exception 'No breakout room assigned' using errcode='P0001';
    end if;
    insert into public.breakout_rooms(lobby_id,room_name) values(p_lobby_id,'Entire class')
      returning room_id into v_room;
    insert into public.breakout_participants(lobby_id,room_id,student_id)
      select p_lobby_id,v_room,student_id from public.lobby_participants
      where lobby_id=p_lobby_id and status='active';
  end if;
  -- Lobby row lock serializes concurrent story creation, avoiding duplicate stories.
  select * into v_story from public.stories where room_id=v_room
    order by created_at,story_id limit 1;
  if not found then
    insert into public.stories(room_id,class_id,title,status)
      values(v_room,v_lobby.class_id,'Untitled Story','in_progress')
      returning * into v_story;
  end if;
  return v_story;
end $$;

create or replace function public.r12_save_story_section(
 p_story_id uuid, p_student_id uuid, p_content text
) returns void language plpgsql security invoker set search_path = '' as $$
declare v_story public.stories; v_lobby_id uuid; v_existing uuid; v_next integer;
begin
  if p_content is null or char_length(p_content) > 10000 then
    raise exception 'Invalid content' using errcode='P0001';
  end if;
  select * into v_story from public.stories where story_id=p_story_id for update;
  if not found or v_story.status = 'approved' then
    raise exception 'Story is not editable' using errcode='P0001';
  end if;
  select lobby_id into v_lobby_id from public.breakout_rooms where room_id=v_story.room_id;
  if not exists(select 1 from public.lobbies where lobby_id=v_lobby_id and status='active') then
    raise exception 'Story session is not active' using errcode='P0001';
  end if;
  if not exists(select 1 from public.breakout_participants p
      join public.lobby_participants lp on lp.lobby_id=p.lobby_id and lp.student_id=p.student_id
      where p.lobby_id=v_lobby_id and p.room_id=v_story.room_id
        and p.student_id=p_student_id and lp.status='active') then
    raise exception 'Not assigned to this story' using errcode='P0001';
  end if;
  select segment_id into v_existing from public.story_segments
    where story_id=p_story_id and student_id=p_student_id order by section_order limit 1;
  if v_existing is null then
    select coalesce(max(section_order),0)+1 into v_next
      from public.story_segments where story_id=p_story_id;
    insert into public.story_segments(story_id,student_id,section,section_order,writing_content)
      values(p_story_id,p_student_id,'writing',v_next,p_content);
  else
    update public.story_segments set writing_content=p_content where segment_id=v_existing;
  end if;
end $$;

-- Feedback attaches to a real segment, not to stories (which has no feedback column).
-- Serializes reviews on the story row so a simultaneous save/approval cannot race.
create or replace function public.r12_review_story(
 p_story_id uuid, p_teacher_id uuid, p_feedback text, p_approve boolean
) returns void language plpgsql security invoker set search_path = '' as $$
declare v_story public.stories; v_segment uuid; v_feedback_id uuid;
begin
  select * into v_story from public.stories where story_id=p_story_id for update;
  if not found or not exists(select 1 from public.breakout_rooms br
    join public.lobbies l on l.lobby_id=br.lobby_id
    join public.classes c on c.class_id=l.class_id
    where br.room_id=v_story.room_id and c.teacher_id=p_teacher_id) then
    raise exception 'Forbidden' using errcode='P0001';
  end if;
  if p_feedback is not null and char_length(p_feedback)>10000 then
    raise exception 'Feedback too long' using errcode='P0001';
  end if;
  if v_story.status='approved' and (p_feedback is not null or p_approve) then
    raise exception 'Story is already approved' using errcode='P0001';
  end if;
  if p_feedback is not null or p_approve then
    select segment_id into v_segment from public.story_segments
      where story_id=p_story_id order by section_order,segment_id limit 1;
    if v_segment is null then
      raise exception 'Students must write before the story can be reviewed' using errcode='P0001';
    end if;
    select feedback_id into v_feedback_id from public.segment_feedback
      where segment_id=v_segment and teacher_id=p_teacher_id
      order by updated_at desc limit 1;
    if v_feedback_id is null then
      insert into public.segment_feedback(segment_id,teacher_id,body,status,approved_at)
        values(v_segment,p_teacher_id,coalesce(p_feedback,''),
          case when p_approve then 'approved' else 'pending' end,
          case when p_approve then now() else null end);
    else
      update public.segment_feedback set
        body=coalesce(p_feedback,body),
        status=case when p_approve then 'approved' else status end,
        approved_at=case when p_approve then now() else approved_at end,
        updated_at=now() where feedback_id=v_feedback_id;
    end if;
    if p_approve then
      update public.stories set status='approved' where story_id=p_story_id;
    end if;
  end if;
end $$;

-- Explicit grants: no public/anon/authenticated invocation of privileged RPCs.
revoke all on function public.r12_create_lobby(uuid,uuid,text,text,integer,integer) from PUBLIC,anon,authenticated;
revoke all on function public.r12_join_lobby(text,uuid) from PUBLIC,anon,authenticated;
revoke all on function public.r12_set_lobby_status(uuid,uuid,text) from PUBLIC,anon,authenticated;
revoke all on function public.r12_remove_roster_student(uuid,uuid,uuid) from PUBLIC,anon,authenticated;
revoke all on function public.r12_kick_lobby_student(uuid,uuid,uuid) from PUBLIC,anon,authenticated;
revoke all on function public.r12_replace_breakout_rooms(uuid,uuid,jsonb) from PUBLIC,anon,authenticated;
revoke all on function public.r12_ensure_story(uuid,uuid) from PUBLIC,anon,authenticated;
revoke all on function public.r12_save_story_section(uuid,uuid,text) from PUBLIC,anon,authenticated;
revoke all on function public.r12_review_story(uuid,uuid,text,boolean) from PUBLIC,anon,authenticated;
grant execute on function public.r12_create_lobby(uuid,uuid,text,text,integer,integer) to service_role;
grant execute on function public.r12_join_lobby(text,uuid) to service_role;
grant execute on function public.r12_set_lobby_status(uuid,uuid,text) to service_role;
grant execute on function public.r12_remove_roster_student(uuid,uuid,uuid) to service_role;
grant execute on function public.r12_kick_lobby_student(uuid,uuid,uuid) to service_role;
grant execute on function public.r12_replace_breakout_rooms(uuid,uuid,jsonb) to service_role;
grant execute on function public.r12_ensure_story(uuid,uuid) to service_role;
grant execute on function public.r12_save_story_section(uuid,uuid,text) to service_role;
grant execute on function public.r12_review_story(uuid,uuid,text,boolean) to service_role;

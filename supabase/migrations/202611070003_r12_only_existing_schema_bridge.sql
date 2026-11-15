-- R12 stores one starting-prompt configuration per existing lobby.
alter table public.lobbies
  add column if not exists starting_prompt text not null default '',
  add column if not exists prompt_type text not null default 'none',
  add column if not exists prompt_assignment_type text not null default 'entire-class';

-- Check the teacher's ownership as part of the write. Only the server can
-- invoke this function, after verifying the teacher's Supabase access token.
create or replace function public.r12_save_starting_prompt(
  p_teacher_id uuid,
  p_lobby_id uuid,
  p_prompt_type text,
  p_prompt_text text,
  p_assignment_type text
) returns boolean language sql security invoker set search_path = '' as $$
  with updated as (
    update public.lobbies as lobby
    set starting_prompt = case when p_prompt_type = 'custom' then btrim(p_prompt_text) else '' end,
        prompt_type = p_prompt_type,
        prompt_assignment_type = p_assignment_type
    where lobby.lobby_id = p_lobby_id
      and lobby.status in ('waiting', 'active')
      and p_prompt_type in ('custom', 'random', 'none')
      and p_assignment_type in ('entire-class', 'different-groups', 'randomized')
      and (p_prompt_type <> 'custom' or char_length(btrim(p_prompt_text)) between 1 and 10000)
      and exists (
        select 1 from public.classes as class
        join public.profiles as teacher on teacher.id = class.teacher_id
        where class.class_id = lobby.class_id
          and teacher.id = p_teacher_id
          and teacher.role = 'teacher'
      )
    returning lobby.lobby_id
  )
  select exists (select 1 from updated);
$$;

revoke execute on function public.r12_save_starting_prompt(uuid, uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.r12_save_starting_prompt(uuid, uuid, text, text, text)
  to service_role;

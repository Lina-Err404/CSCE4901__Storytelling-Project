# R12-only Supabase migration — CSCE4901 Storytelling

This archive migrates the existing flows from `feature/r12-starting-prompts` to the team's Supabase schema. It does **not** import the story-creation page, teacher-review page, standalone starting-prompts page, sidebar, drawing editor, or their APIs/components from `develop-supabase-cleanup` or `main`.

## Original R12 feature surface, preserved

- Teacher/student sign-in UI (now Supabase Auth).
- Teacher class/roster dashboard, class creation, roster CSV import/edit/removal.
- Lobby creation, join codes, student join/rejoin, teacher start/lock/close, student monitoring and Socket.IO.
- Teacher starting-prompt settings in the original dashboard, saved on the current lobby. Custom mode saves text. Random and No Prompt save the mode with empty text, matching the original API. Distribution is stored as a setting.
- Existing manual breakout-room assignment page and API (now persisted).
- Existing original R12 artwork/styles/assets.

The original `Moderation` navigation item remains the original placeholder; this migration **does not implement teacher review**. Starting a session shows the original status notice; it **does not link to the unrelated story editor**.

## Existing tables (NO new application tables)

The R12 feature uses only: `profiles`, `classes`, `class_students`, `lobbies`, `lobby_participants`, `breakout_rooms`, `breakout_participants`. It **does not create, alter or query** `stories`, `story_segments`, `segment_feedback` or `segment_drawings` in its UI/API. The breakout-room SQL function checks `stories` to avoid deleting a breakout room already referenced by another feature; no story data is written.

### SQL bridge for R12 only

`supabase/migrations/202611070003_r12_only_existing_schema_bridge.sql` **does not create tables**. It proposes:

1. Six columns on existing `lobbies`: `max_players`, `min_words`, `max_words`, `starting_prompt`, `prompt_type`, `prompt_assignment_type` (with defaults).
2. Unique join-code index (requires no existing duplicate codes).
3. Six **service-role-only** database functions: `r12_create_lobby`, `r12_join_lobby`, `r12_set_lobby_status`, `r12_remove_roster_student`, `r12_kick_lobby_student`, `r12_replace_breakout_rooms`.

Use this bridge as the migration for this archive. If an earlier R12 SQL script was already applied, inspect the existing columns and RPC signatures first. In particular, an earlier draft used `assignment_type`. Review any data in that column before moving to `prompt_assignment_type`.

The bridge was checked locally against the columns and constraints in the two supplied CSVs. Check the target database for duplicate join codes and schema changes before applying it:

```sql
-- Must return zero rows before adding unique join-code index
select join_code, count(*) from public.lobbies group by join_code having count(*) > 1;
-- R12 expects waiting/active/closed (lobbies), and active/removed (participants)
select status, count(*) from public.lobbies group by status;
select status, count(*) from public.lobby_participants group by status;
-- See current FK/unique/check constraints
select conrelid::regclass as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint where connamespace='public'::regnamespace
order by table_name::text, conname;
```

The supplied export shows row-level security disabled. This archive leaves shared table permissions to the team's database configuration. Before deployment, verify that direct access by `anon` and `authenticated` cannot bypass the server's authorization checks.

## Environment

Create `.env` in the project root from `.env.example`. Never commit `.env` or post credentials in chat.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-or-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-server-only-secret-key
JWT_SECRET=at-least-32-random-characters
STORY_API_URL=http://127.0.0.1:4000
NEXT_PUBLIC_API_URL=http://localhost:4000
WEB_ORIGIN=http://localhost:3000
```

Use `openssl rand -hex 32` for `JWT_SECRET`. The frontend only gets the publishable key; the server uses the secret key in private server code. Privileged teacher roles come from **`profiles.role`**, not user-selected UI roles or Auth metadata. Admin: `node server/scripts/grant-teacher.js <SUPABASE_AUTH_UUID>`.

## Install and run (macOS / CLion)

Node **22+** is recommended: the existing original R12 Jest DOM 7 dependency requires Node >=22. The team should choose a shared Node version before merging.

```bash
npm ci
npm --prefix server ci
npm run build
npm test -- --runInBand
npm --prefix server test
npm run dev
```

`http://localhost:3000` is Next.js; `http://localhost:4000/health` checks Express. Next.js proxies `/api/backend/*` to Express.

## CSV roster format

`class_students.student_id` is a UUID linked to Supabase Auth. Each roster student must **already have a Supabase Auth account**. CSV: `studentId,name` where ID is their Supabase Auth UUID, or `studentId,name,email` where email resolves to an existing Auth account. Non-UUID school IDs cannot be retained in this schema and are not stored. Profile display names are kept in `profiles.display_name`.

## Verification checklist

After the bridge has been reviewed/applied in a **development** project, test with a teacher and two registered students: create class, import roster, create lobby, join/rejoin, start session, save a starting prompt, assign a breakout room with two students, and close the lobby. Verify rows in the corresponding seven existing tables. Check access as a different teacher and as an unrostered student.

A successful Next.js build and unit tests **do not verify** live Supabase connectivity, SQL behavior, migrations, authentication deliverability, or row-level access controls. Do not deploy on a shared database before those tests.

## Scope diff

The added `/api/account/role` endpoint lets the existing login choose the dashboard using the role in `profiles`. The existing manual breakout page receives the current lobby ID from the dashboard because it previously used mock data. The original R12 routes under `/api/starting-prompts`, `/api/lobby/join`, and `/api/lobbies/[lobbyId]/breakout-rooms` are preserved with Supabase implementations. **Not included**: `/creating-stories`, `/teacher-review`, `/starting-prompts` (standalone page), `/api/stories/*`, `/api/images/*`, imported UI/sidebar/drawing assets.

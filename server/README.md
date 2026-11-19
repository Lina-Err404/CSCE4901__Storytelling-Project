# Storytelling Server Modules

The API uses Supabase Auth for bearer-token verification and a server-only Supabase service-role key for database operations. `src/supabase.js` loads the repository-root `.env` and fails fast if the server URL or service-role key is missing.

## Wiring

The API is mounted at the root by `src/server.js`:

```text
POST /classes
POST /classes/:id/roster
POST /lobbies
POST /lobbies/join
```

Teacher and student API routes verify Supabase access tokens. Teachers must have `role: "teacher"` in trusted `app_metadata` or in their `public.profiles` row. Use `npm run grant-teacher -- <SUPABASE_AUTH_USER_UUID>` from this directory to assign the teacher role with the service key.

Apply the migrations in the repository's `supabase/migrations/` directory before running `npm run dev:api` or the test suite. Set `JWT_SECRET` to a secret of at least 32 characters. `npm test` runs isolated unit tests and requires no emulator or database.

## Data Model

- `classes` and `class_roster` store teacher-owned classes and imported student names.
- `lobbies` uses a six-character unique join code and stores lobby state and limits.
- `lobby_participants` stores seats and revocation status.
- RPC functions in `202611160001_r13_supabase_backend.sql` perform multi-table and concurrent updates atomically.

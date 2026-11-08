# R12 Express API and Socket.IO

This server implements the **original R12** class roster, lobby creation/joining, student monitoring, and lobby status features. It uses Supabase Auth and the team's existing tables (`profiles`, `classes`, `class_students`, `lobbies`, `lobby_participants`, `breakout_rooms`, `breakout_participants`). No Firebase emulator is used.

Set the variables described in the root README in the root `.env`. Start both servers with `npm run dev` from the repository root, or run `npm run dev:api` from the `server` directory.

HTTP routes live behind Next.js `/api/backend/*` (rewrite to `http://127.0.0.1:4000/*`). `GET http://localhost:4000/health` checks the Express process. The separate Next.js routes handle starting prompts, breakout assignments, and account roles.

Authorization checks the user's Supabase Auth access token and the authoritative `public.profiles.role` column. Only trusted administrators should run `node server/scripts/grant-teacher.js <AUTH_USER_UUID>` from the repository root; the script requires the server-only service key.

See `../supabase/migrations/202611070003_r12_only_existing_schema_bridge.sql` for the existing-schema SQL functions used by the R12 feature. **Review constraints and apply only to a development database first.**

# CSCE4901
Storytelling project

## Local development

Copy `.env.example` to `.env` and configure the Supabase project URL, anon key, and server-only service-role key. Apply the SQL files in `supabase/migrations/` to that project before starting the application.

Run `npm run dev` to start the Next.js app and Express API. The app is available at `http://localhost:3000`; the API health endpoint is `http://localhost:4000/health`. Development mode accepts the local identity headers and must never be enabled in production.

The teacher dashboard creates a default class when needed. Import a roster CSV with the header `studentId,name`, then create a lobby to generate a join code. Server-side class/lobby changes use Supabase RPCs; teacher review records are stored in the `stories` table.

Run the API tests with `npm test --prefix server`. They use an isolated in-memory Supabase-store test double and do not require an emulator or live database.

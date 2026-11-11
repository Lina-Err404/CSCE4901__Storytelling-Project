# CSCE4901
Storytelling project

## Local development

Run `npm run dev` to start the Next.js app, Express API with Socket.IO, and the Firestore emulator. The app is available at `http://localhost:3000`; the API health endpoint is `http://localhost:4000/health`. The Firestore emulator requires Java and listens on port 8080.

The teacher dashboard creates a default class when needed. Import a roster CSV with the header `studentId,name`, then create a lobby to generate a join code. The local server currently uses the `x-teacher-id` development stub; it is not authentication and must be replaced before deployment. Production API startup requires a `JWT_SECRET` of at least 32 characters and Firebase Application Default Credentials.

## R13 Supabase lobby

The Firebase dashboard and its existing class, breakout, and story features remain on the main app and API. The parallel R13 Supabase lobby is available at `/supabase-lobbies` and uses Supabase Auth and Postgres; its routes are isolated under `/supabase` on the API and use a separate Socket.IO namespace. Firebase and Supabase access tokens are not interchangeable.

Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in the repository-root `.env`. The service-role key is server-only and must never use a `NEXT_PUBLIC_` prefix. Supabase teacher accounts must be provisioned with `profiles.role = 'teacher'`; self-registered accounts receive the student role.

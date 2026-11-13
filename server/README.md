# Storytelling Server Modules

The existing class, lobby, and socket features use Firebase Admin. `src/firebase.js` loads the repository-root `.env` with dotenv and initializes Application Default Credentials using `GOOGLE_APPLICATION_CREDENTIALS`.

## Wiring

The R13 API is mounted at `/api` by `src/server.js`:

```js
POST /api/lobbies                  { "classId": "..." }
POST /api/lobbies/:code/join       Authorization: Bearer <Firebase ID token>
```

Both endpoints verify Firebase ID tokens; host creation additionally requires the `role: "teacher"` custom claim. Assign that claim to a provisioned account with `npm run grant-teacher -- <FIREBASE_UID>` from this directory. The Firebase Auth emulator is used during local development; no credentials are logged.

Run the API with `npm run dev:api` and the Firestore tests with `npm test` from this directory. The root `npm run dev` starts the app and emulators with local Firestore import/export persistence under the ignored `.firebase-data/` directory. To print scratch-case results against your configured Firebase project or emulator, run `node scratch.js`; that file is git-ignored and removes its temporary records.

## Data Model

- `classes/{classId}` retains existing class fields and has `studentIds` for roster enrollment.
- `classes/{classId}/roster/{studentId}` remains the current roster display-name source.
- `Lobbies/{code}` uses the required case-sensitive collection and stores the lobby's existing fields plus `hostId`, `classId`, `participantIds`, and `createdAt`.

## Known Gaps

- The root `firestore.rules` denies direct client reads and writes; service access is through the Admin-backed API.
- Existing lowercase lobby modules remain for the earlier prototype; the R13 route is mounted from `lobbyRoutes.js` and uses `Lobbies/{code}`.

## Story API

Story routes verify Supabase Auth bearer tokens. Firebase Auth remains in use for other API routes. The authenticated Supabase Auth user ID must equal the corresponding `public.profiles.id`; the profile must have the `student` role. Segment assignment and breakout-room checks continue to use that profile UUID.

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the repository-root `.env`. Keep the service-role key server-only. The browser uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Apply `supabase/migrations/20261106133900_r39_story_firebase_link.sql` for the story segment `updated_at` column and trigger; its `firebase_uid` field is no longer used by story authentication.

Story routes require an active `lobby_participants` row and a matching `breakout_participants` row for the story's room.

Routes mounted on the API server (available to the web app through the `/api` rewrite in `next.config.ts`):

- `GET /stories/:storyId` (`/api/stories/:storyId` from the web app) returns ordered sections and any saved drawing data for an authorized breakout-room participant.
- `PUT /story-segments/:segmentId` (`/api/story-segments/:segmentId` from the web app) saves writing progress for the assigned student.
- `PUT /story-segments/:segmentId/drawing` (`/api/story-segments/:segmentId/drawing` from the web app) saves version-1 drawing JSON for the assigned student.

Students can read the story sections but can update only segments assigned to their mapped profile. The API validates writing length and drawing shape/size, and returns persisted values after successful writes.
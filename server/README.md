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

## R39 Story API

R39 adds Supabase-backed story reads and student saves without changing Firebase authentication or the existing Firestore features. The authenticated Firebase UID is looked up in `public.profiles.firebase_uid`; all segment assignment and breakout-room checks use the matched Supabase profile UUID.

Set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the repository-root `.env`. Keep the service-role key server-only. Apply `supabase/migrations/20261106133900_r39_story_firebase_link.sql` to add the Firebase UID mapping and segment save timestamp, then link each student's Firebase UID to the existing profile UUID using a trusted database administrator:

```sql
UPDATE public.profiles
SET firebase_uid = '<Firebase Auth UID>'
WHERE id = '<existing Supabase profile UUID>';
```

The mapping must be unique and populated before the student can access a story. Existing segment `student_id` values must refer to the corresponding `profiles.id`. Story routes additionally require an active `lobby_participants` row and a matching `breakout_participants` row for the story's room.

Routes mounted on the API server (available to the web app through the `/api` rewrite in `next.config.ts`):

- `GET /stories/:storyId` (`/api/stories/:storyId` from the web app) returns ordered sections and any saved drawing data for an authorized breakout-room participant.
- `PUT /story-segments/:segmentId` (`/api/story-segments/:segmentId` from the web app) saves writing progress for the assigned student.
- `PUT /story-segments/:segmentId/drawing` (`/api/story-segments/:segmentId/drawing` from the web app) saves version-1 drawing JSON for the assigned student.

Students can read the story sections but can update only segments assigned to their mapped profile. The API validates writing length and drawing shape/size, and returns persisted values after successful writes.
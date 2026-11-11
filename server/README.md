# Storytelling Server Modules

The API uses Firebase Admin only. `src/firebase.js` loads the repository-root `.env` with dotenv and initializes Application Default Credentials using `GOOGLE_APPLICATION_CREDENTIALS`.

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

## Supabase R13 coexistence

Firebase remains the default backend for the existing app features and API routes. The separate R13 Supabase implementation is mounted under `/supabase` and accepts Supabase Auth access tokens; the web UI is at `/supabase-lobbies` and calls it through the `/api` rewrite. Supabase Socket.IO clients connect to the `/supabase` namespace, leaving the Firebase-backed default namespace unchanged.

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` in the repository-root `.env`. The browser only uses the URL and anon key; keep the service-role key server-only. If Supabase is not configured, `/supabase/*` returns 503 while Firebase routes continue to run. Provision teacher roles through the Supabase dashboard; new Supabase accounts default to students.
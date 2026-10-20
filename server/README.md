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
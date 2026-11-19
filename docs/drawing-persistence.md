# Personal drawing persistence (R39 Phase 5C.6)

The default Creating Stories route uses the existing Firebase authentication session.
Each UID owns one personal `drawing` page; `storyId` is null until assignment integration.
There is no production student selector or cross-user access. The legacy layout and
exported reference/demo shell remain available but do not gain permanent demo-ID storage.

`GET` and `PUT /api/personal-story` verify Firebase ID tokens with the existing
server-only Admin configuration. Development identity headers are not accepted.
The UID is taken from the verified token, never from a URL or client-supplied owner.
Teachers can access their own personal page; this endpoint grants no access to students' pages.

Text stays in `items/{uid}.name`. Drawing schema version 1 and an optimistic revision
are stored at `items/{uid}/drawingPages/drawing`. A transaction writes both records
atomically; no partial success is reported. Existing text-only fields are preserved by merge.
No SQL migration, Firestore index, or permissive client-rule change is required.
The checked-in deny-all client rules remain intact; all access uses the authenticated API.
Existing demo text under `items/student-*` is not automatically assigned to real users.

Configure the existing `NEXT_PUBLIC_FIREBASE_*` settings and the server Admin project/
credentials described in `lib/firebaseAdmin.ts`. Keep service credentials server-only.
For local development, `npm run dev` runs the app and Firebase emulators with local
import/export persistence under `.firebase-data`. Production must disable emulator
settings and use its provisioned Firebase project and Admin credentials.

The saved structured history includes freehand, erasing, shapes, stamp asset references,
background changes, clear actions, and the undo/redo cursor. Loading validates identity,
schema, geometry and public asset references before editing is enabled. Failed loads
offer retry and cannot overwrite the database with an initial empty drawing.

Save status reflects both writing and drawing. Edits during a save remain dirty when
that save finishes. Mode changes retain local edits; browser unloading warns when work
is dirty or saving. A page changed in another tab is rejected with HTTP 409: local edits
remain in memory, and the user must reconcile/reload rather than overwrite newer data.
Signing out ends that user's editing session; save before signing out elsewhere.

Limits: drawing JSON 512,000 UTF-8 bytes, 10,000 actions, 100,000 points; text 100,000
characters; combined request 800,000 bytes (enforced during streaming). Exceeding a limit
fails visibly without truncating operations. Firestore may also reject a document at its
own storage limit. Saves are explicit, not continuous autosaves.

Validation used mocked failure/race tests and real disposable Auth/Firestore emulator
accounts: atomic save, all drawing elements, history, owner isolation, stale revisions,
browser refresh with identical pixels, and responsive redraw. Production database
credentials/data were not used for those tests.

# Storytelling Server Modules

These CommonJS modules provide class roster management, host-lobby routes, and Socket.io student authentication. The application bootstrap owns Express, the HTTP server, Socket.io, Firebase Admin initialization, CORS, and environment loading.

## Wiring

Pass the initialized Firestore `db`, Firebase Admin namespace, teacher-auth middleware, JWT secret, and a function that returns the Socket.io server into the factories:

```js
const { createClassesRouter, createLobbyRouter, createSocketAuth, requireTeacher } = require('./server/src');
app.use(createClassesRouter({ db, admin, requireTeacher }));
app.use(createLobbyRouter({ db, admin, requireTeacher, jwtSecret: process.env.JWT_SECRET, getIo: () => io }));
io.use(createSocketAuth({ db, jwtSecret: process.env.JWT_SECRET }));
```

`createLobbyRouter` requires a `JWT_SECRET` of at least 32 characters. The test command starts the Firestore emulator and sets `FIRESTORE_EMULATOR_HOST`; the test helper refuses to run without that variable and initializes Firebase Admin with project ID `demo-storytelling`, without credentials. Production Firestore credentials and environment loading are owned by the application bootstrap.

Run the server package's test script from this directory with `npm test`.

## Data Model

- `classes/{classId}` stores the owning `teacherId`, `name`, and `createdAt`.
- `classes/{classId}/roster/{studentId}` stores each student's `displayName`.
- `lobbies/{lobbyId}` stores its teacher, class, join code, status, game settings, and creation time.
- `lobbyCodes/{code}` maps an active code to a lobby and is removed when that lobby closes.
- `lobbies/{lobbyId}/students/{studentId}` stores the roster display name, join time, and kick state.

## Known Gaps

- Teacher authentication is currently the `x-teacher-id` header stub; it is not authentication and must be replaced by the owning teammate's implementation.
- Removing a student from a class roster prevents future joins but does not revoke an existing lobby seat or an already-issued token.
- There is no CORS configuration, production server entry point, or deploy configuration in this package.
- No Firestore security rules are included; access control in these modules assumes requests pass through the hosting server.
- The join-code endpoint uses in-memory rate-limit state, which is not shared across multiple server instances.
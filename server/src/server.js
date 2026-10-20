const express = require('express');
const http = require('http');
const admin = require('firebase-admin');
const { Server } = require('socket.io');
const {
  createClassesRouter,
  createLobbyRouter,
  createSocketAuth,
  requireTeacher,
} = require('./');

const port = Number(process.env.PORT || 4000);
const projectId = process.env.GCLOUD_PROJECT || 'demo-storytelling';
const jwtSecret = process.env.JWT_SECRET;

if (process.env.NODE_ENV === 'production' && (!jwtSecret || jwtSecret.length < 32)) {
  throw new Error('Set JWT_SECRET to a value of at least 32 characters');
}

if (
  process.env.NODE_ENV !== 'production' &&
  process.env.USE_FIRESTORE_EMULATOR !== 'false'
) {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
}

const firebaseApp = admin.apps.find((app) => app.name === '[DEFAULT]')
  || admin.initializeApp({ projectId });
const db = admin.firestore(firebaseApp);
const app = express();
const server = http.createServer(app);
let io;

app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use(createClassesRouter({ db, admin, requireTeacher }));
app.use(createLobbyRouter({ db, admin, requireTeacher, jwtSecret, getIo: () => io }));
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((error, req, res, next) => {
  console.error(error);
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: 'Internal server error' });
});

io = new Server(server, {
  cors: { origin: process.env.WEB_ORIGIN || 'http://localhost:3000' },
});
io.use(createSocketAuth({ db, jwtSecret }));

server.listen(port, '0.0.0.0', () => {
  console.log(`Storytelling API and Socket.IO listening on http://localhost:${port}`);
});
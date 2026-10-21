const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

if (
  process.env.NODE_ENV !== 'production' &&
  process.env.USE_FIRESTORE_EMULATOR !== 'false'
) {
  process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
}
if (
  process.env.NODE_ENV !== 'production' &&
  process.env.USE_AUTH_EMULATOR !== 'false'
) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
}

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { admin, db } = require('./firebase');
const { createRequireStudent, createRequireTeacher } = require('./auth');
const {
  createClassesRouter,
  createLobbyRouter,
  createSocketAuth,
} = require('./');

const port = Number(process.env.PORT || 4000);

const requireTeacher = createRequireTeacher(admin);
const requireStudent = createRequireStudent(admin);
const app = express();
const server = http.createServer(app);
let io;

app.use(express.json());
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use(createClassesRouter({ db, admin, requireTeacher, getIo: () => io }));
app.use(createLobbyRouter({
  db,
  admin,
  requireTeacher,
  requireStudent,
  jwtSecret: process.env.JWT_SECRET,
  getIo: () => io,
}));
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: 'Internal server error' });
});

io = new Server(server, {
  cors: { origin: process.env.WEB_ORIGIN || 'http://localhost:3000' },
});
io.use(createFirebaseSocketAuth(admin));

server.listen(port, '0.0.0.0', () => {
  console.log(`Storytelling API and Socket.IO listening on http://localhost:${port}`);
});
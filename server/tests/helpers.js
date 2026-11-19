const express = require('express');
const http = require('http');
const admin = require('firebase-admin');
const { Server } = require('socket.io');
const { createClassesRouter, createLobbyRouter, createSocketAuth } = require('../src');

const PROJECT_ID = 'demo-storytelling';
const JWT_SECRET = 'test-secret-that-is-at-least-thirty-two-characters-long';

function requireTeacher(req, res, next) {
  const uid = req.get('x-teacher-id');
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  req.user = { uid, role: 'teacher' };
  return next();
}

function requireStudent(req, res, next) {
  const uid = req.get('x-test-student-uid');
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  req.user = { uid, role: 'student' };
  return next();
}

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error('FIRESTORE_EMULATOR_HOST must be set by firebase emulators:exec');
}

const firebaseApp = admin.apps.find((app) => app.name === '[DEFAULT]')
  || admin.initializeApp({ projectId: PROJECT_ID });
const db = admin.firestore(firebaseApp);

async function clearFirestore() {
  const response = await fetch(
    `http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${PROJECT_ID}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  if (!response.ok) {
    throw new Error(`Could not clear Firestore emulator: ${response.status}`);
  }
}

async function seedClass({ classId = 'class-one', teacherId = 'teacher-one', name = 'Class One' } = {}) {
  await db.collection('classes').doc(classId).set({ teacherId, studentIds: [], name });
  return classId;
}

async function seedRoster(classId, students) {
  const batch = db.batch();
  for (const student of students) {
    batch.set(db.collection('classes').doc(classId).collection('roster').doc(student.studentId), {
      displayName: student.displayName,
    });
  }
  await batch.commit();
}

async function seedLobby({
  lobbyId = 'lobby-one',
  classId = 'class-one',
  teacherId = 'teacher-one',
  joinCode = 'ABC234',
  status = 'open',
} = {}) {
  await db.collection('lobbies').doc(lobbyId).set({
    teacherId,
    classId,
    joinCode,
    status,
    gameMode: 'divide',
    minWords: 0,
    maxWords: 100,
  });
  if (status !== 'closed') {
    await db.collection('lobbyCodes').doc(joinCode).set({ lobbyId });
  }
  return lobbyId;
}

async function startTestServer() {
  const app = express();
  app.use(express.json());

  let io;
  app.use(createClassesRouter({ db, admin, requireTeacher }));
  app.use(createLobbyRouter({ db, admin, requireTeacher, requireStudent, jwtSecret: JWT_SECRET, getIo: () => io }));

  const server = http.createServer(app);
  io = new Server(server);
  io.use(createSocketAuth({ db, jwtSecret: JWT_SECRET }));

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  return {
    app,
    db,
    io,
    server,
    url: `http://127.0.0.1:${address.port}`,
    async stop() {
      await new Promise((resolve) => io.close(resolve));
    },
  };
}

async function deleteFirebaseApp() {
  await firebaseApp.delete();
}

module.exports = {
  PROJECT_ID,
  JWT_SECRET,
  admin,
  db,
  clearFirestore,
  seedClass,
  seedRoster,
  seedLobby,
  startTestServer,
  deleteFirebaseApp,
};
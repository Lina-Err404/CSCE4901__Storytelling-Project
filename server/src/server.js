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
const { createTimerRouter } = require('./timerRoutes');
const { createRequireStudent, createRequireTeacher } = require('./auth');
const { supabase } = require('./supabase');
const {
  createRequireStudent: createSupabaseRequireStudent,
  createRequireTeacher: createSupabaseRequireTeacher,
  createRequireUser: createSupabaseRequireUser,
} = require('./supabaseAuth');
const { createClassesRouter: createSupabaseClassesRouter } = require('./supabaseClasses');
const { createLobbyRouter: createSupabaseLobbyRouter } = require('./supabaseLobby');
const { createSocketAuth: createSupabaseSocketAuth } = require('./supabaseSocketAuth');
const {
  createClassesRouter,
  createLobbyRouter,
  createSocketAuth,
  createStoryRouter,
} = require('./');
const { getSupabaseClient } = require('./supabase');

const port = Number(process.env.PORT || 4000);

const requireTeacher = createRequireTeacher(admin);
const requireStudent = createRequireStudent(admin);
const supabaseRequireTeacher = supabase && createSupabaseRequireTeacher(supabase);
const supabaseRequireStudent = supabase && createSupabaseRequireStudent(supabase);
const supabaseRequireUser = supabase && createSupabaseRequireUser(supabase);
const app = express();
const server = http.createServer(app);
let io;
let supabaseIo;

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


// R5: Time Limit routes
app.use(createTimerRouter({
  getIo: () => supabaseIo
}));


if (supabase) {
  app.get('/supabase/profile', supabaseRequireUser, (req, res) => res.json({
    id: req.user.uid,
    role: req.user.role,
    displayName: req.user.displayName,
  }));
  app.use('/supabase', createSupabaseClassesRouter({
    supabase,
    requireTeacher: supabaseRequireTeacher,
    getIo: () => supabaseIo,
  }));
  app.use('/supabase', createSupabaseLobbyRouter({
    supabase,
    requireTeacher: supabaseRequireTeacher,
    requireStudent: supabaseRequireStudent,
    jwtSecret: process.env.JWT_SECRET,
    getIo: () => supabaseIo,
  }));
} else {
  app.use('/supabase', (req, res) => res.status(503).json({
    error: 'Supabase lobby features are not configured',
  }));
}

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  console.error('API request failed:', error);
  return res.status(500).json({ error: 'Internal server error' });
});

io = new Server(server, {
  cors: { origin: process.env.WEB_ORIGIN || 'http://localhost:3000' },
});
io.use(createSocketAuth({ db, jwtSecret: process.env.JWT_SECRET }));
supabaseIo = io.of('/supabase');
if (supabase) {
  supabaseIo.use(createSupabaseSocketAuth({ supabase, jwtSecret: process.env.JWT_SECRET }));
} else {
  supabaseIo.use((socket, next) => next(new Error('Supabase lobby features are not configured')));
}

server.listen(port, '0.0.0.0', () => {
  console.log(`Storytelling API and Socket.IO listening on http://localhost:${port}`);
});
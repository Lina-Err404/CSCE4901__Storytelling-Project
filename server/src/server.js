const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env.local'),
});
require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
});

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { supabase } = require('./supabase');
const { createSupabaseStore } = require('./store');
const { createRequireStudent, createRequireTeacher } = require('./auth');
const {
  createClassesRouter,
  createLobbyRouter,
  createSocketAuth,
} = require('./');

const port = Number(process.env.PORT || 4000);
const db = createSupabaseStore(supabase);
const requireTeacher = createRequireTeacher(supabase);
const requireStudent = createRequireStudent(supabase);

const app = express();
const server = http.createServer(app);
let io;

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use(createClassesRouter({ db, requireTeacher, getIo: () => io }));
app.use(
    createLobbyRouter({
      db,
      requireTeacher,
      requireStudent,
      jwtSecret: process.env.JWT_SECRET,
      getIo: () => io,
    })
);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  return res.status(500).json({ error: 'Internal server error' });
});

io = new Server(server, {
  cors: { origin: process.env.WEB_ORIGIN || 'http://localhost:3000' },
});
io.use(createSocketAuth({ db, jwtSecret: process.env.JWT_SECRET }));

server.listen(port, '0.0.0.0', () => {
  console.log(`Storytelling API and Socket.IO listening on http://localhost:${port}`);
});
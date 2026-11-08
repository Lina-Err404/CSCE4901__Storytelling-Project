const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { initializeSupabase } = require('./supabase');
const { createRequireStudent, createRequireTeacher } = require('./auth');
const { createClassesRouter } = require('./classes');
const { createLobbyRouter } = require('./lobby');
const { createSocketAuth } = require('./socketAuth');

const { db, verifier } = initializeSupabase();
const jwtSecret = process.env.JWT_SECRET;
if (typeof jwtSecret !== 'string' || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must have at least 32 characters');
}
const requireTeacher = createRequireTeacher(verifier, db);
const requireStudent = createRequireStudent(verifier, db);
const app = express();
const server = http.createServer(app);
let io;
app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.use(createClassesRouter({ db, requireTeacher, getIo: () => io }));
app.use(createLobbyRouter({ db, requireTeacher, requireStudent, jwtSecret, getIo: () => io }));
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((error, req, res, next) => {
  console.error('API error:', error);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: 'Internal server error' });
});
io = new Server(server, { cors: { origin: process.env.WEB_ORIGIN || 'http://localhost:3000' } });
io.use(createSocketAuth({ db, jwtSecret }));
io.on('connection', (socket) => {
  socket.emit('lobby:status', { lobbyId: socket.data.lobbyId, status: socket.data.lobbyStatus });
});
server.listen(Number(process.env.PORT || 4000), '0.0.0.0', () => {
  console.log(`Storytelling API listening on port ${Number(process.env.PORT || 4000)}`);
});

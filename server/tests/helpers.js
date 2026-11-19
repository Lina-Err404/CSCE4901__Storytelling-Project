const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { createClassesRouter, createLobbyRouter, createSocketAuth } = require('../src');

const JWT_SECRET = 'test-secret-that-is-at-least-thirty-two-characters-long';

function createMemoryStore() {
  const classes = new Map();
  const rosters = new Map();
  const lobbies = new Map();
  const codes = new Map();
  const participants = new Map();
  const profileNames = new Map();
  let classCounter = 0;
  let lobbyCounter = 0;

  function failure(message, code = 'P0001') {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  return {
    async createClass({ teacherId, name }) {
      const classId = `class-${++classCounter}`;
      const row = { classId, teacherId, name, activeLobbyId: null };
      classes.set(classId, row);
      rosters.set(classId, new Map());
      return { ...row };
    },
    async listClasses(teacherId) {
      return [...classes.values()]
        .filter((row) => row.teacherId === teacherId)
        .map((row) => ({ ...row }));
    },
    async getClass(classId) {
      const row = classes.get(classId);
      return row ? { ...row } : null;
    },
    async listRoster(classId) {
      return [...(rosters.get(classId)?.values() || [])].map((row) => ({ ...row }));
    },
    async upsertRoster(classId, students) {
      if (!rosters.has(classId)) throw failure('Class not found', 'P0002');
      const roster = rosters.get(classId);
      students.forEach((student) => roster.set(student.studentId, { ...student }));
      return students.length;
    },
    async deleteRosterStudent(classId, studentId) {
      const roster = rosters.get(classId);
      if (!roster?.delete(studentId)) return null;
      const classData = classes.get(classId);
      const lobbyId = classData?.activeLobbyId;
      const seat = lobbyId && participants.get(lobbyId)?.get(studentId);
      const lobby = lobbyId && lobbies.get(lobbyId);
      if (seat && lobby && ['open', 'locked'].includes(lobby.status)) {
        seat.status = 'kicked';
        return lobbyId;
      }
      return null;
    },
    async listLobbies(classId) {
      return [...lobbies.values()]
        .filter((lobby) => lobby.classId === classId && lobby.status !== 'closed')
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((lobby) => ({ ...lobby }));
    },
    async getLobby(lobbyId) {
      const lobby = lobbies.get(lobbyId);
      return lobby ? { ...lobby } : null;
    },
    async createLobby({ teacherId, classId, joinCode, gameMode, minWords, maxWords, maxPlayers = 500 }) {
      const schoolClass = classes.get(classId);
      if (!schoolClass || schoolClass.teacherId !== teacherId) {
        throw failure('Class not found for this teacher', '42501');
      }
      if ([...lobbies.values()].some((row) => row.classId === classId && row.status !== 'closed')) {
        return { activeLobbyId: schoolClass.activeLobbyId };
      }
      if (codes.has(joinCode)) throw failure('Join code already exists', '23505');
      const lobbyId = `lobby-${++lobbyCounter}`;
      const lobby = {
        lobbyId,
        classId,
        teacherId,
        joinCode,
        status: 'open',
        gameMode,
        minWords,
        maxWords,
        maxPlayers,
        playerCount: 0,
        createdAt: Date.now(),
      };
      lobbies.set(lobbyId, lobby);
      codes.set(joinCode, lobbyId);
      schoolClass.activeLobbyId = lobbyId;
      participants.set(lobbyId, new Map());
      return { lobbyId };
    },
    async getLobbyByCode(joinCode) {
      const lobbyId = codes.get(joinCode);
      const lobby = lobbyId && lobbies.get(lobbyId);
      return lobby ? { ...lobby } : null;
    },
    async joinLobby({ lobbyId, studentId, displayName }) {
      const lobby = lobbies.get(lobbyId);
      if (!lobby || lobby.status !== 'open') throw failure('Lobby unavailable', 'P0002');
      const seats = participants.get(lobbyId);
      const seat = seats.get(studentId);
      if (seat?.status === 'kicked' || seat?.status === 'removed') {
        throw failure('Student seat unavailable', '42501');
      }
      if (!seat && lobby.playerCount >= lobby.maxPlayers) throw failure('Lobby is full', 'P0001');
      if (!seat) lobby.playerCount += 1;
      seats.set(studentId, {
        studentId,
        displayName,
        status: 'joined',
      });
      return { playerCount: lobby.playerCount, alreadyJoined: Boolean(seat) };
    },
    async getProfileDisplayName(studentId) {
      return profileNames.get(studentId) || null;
    },
    async updateLobbyStatus(lobbyId, status) {
      const lobby = lobbies.get(lobbyId);
      if (!lobby) throw failure('Lobby not found', 'P0002');
      lobby.status = status;
      if (status === 'closed') {
        codes.delete(lobby.joinCode);
        const schoolClass = classes.get(lobby.classId);
        if (schoolClass?.activeLobbyId === lobbyId) schoolClass.activeLobbyId = null;
      }
    },
    async listLobbyStudents(lobbyId) {
      return [...(participants.get(lobbyId)?.values() || [])]
        .filter((seat) => !['kicked', 'removed'].includes(seat.status))
        .map(({ studentId, displayName }) => ({ studentId, displayName }));
    },
    async kickLobbyStudent(lobbyId, studentId) {
      const seats = participants.get(lobbyId);
      if (!seats) throw failure('Lobby not found', 'P0002');
      const seat = seats.get(studentId);
      seats.set(studentId, { studentId, displayName: seat?.displayName || 'Student', status: 'kicked' });
    },
    async getLobbySeat(lobbyId, studentId) {
      const seat = participants.get(lobbyId)?.get(studentId);
      return seat ? { ...seat } : null;
    },
    async clear() {
      classes.clear();
      rosters.clear();
      lobbies.clear();
      codes.clear();
      participants.clear();
      profileNames.clear();
      classCounter = 0;
      lobbyCounter = 0;
    },
    async seedClass({ classId, teacherId, name }) {
      const id = classId || `class-${++classCounter}`;
      classes.set(id, { classId: id, teacherId, name, activeLobbyId: null });
      rosters.set(id, new Map());
      return id;
    },
    async seedLobby({ lobbyId, classId, teacherId, joinCode, status, gameMode, minWords, maxWords }) {
      const lobby = {
        lobbyId,
        classId,
        teacherId,
        joinCode,
        status,
        gameMode: gameMode || 'divide',
        minWords: minWords ?? 0,
        maxWords: maxWords ?? 100,
        maxPlayers: 500,
        playerCount: 0,
        createdAt: Date.now(),
      };
      lobbies.set(lobbyId, lobby);
      participants.set(lobbyId, new Map());
      if (status !== 'closed') codes.set(joinCode, lobbyId);
      const schoolClass = classes.get(classId);
      if (schoolClass && status !== 'closed') schoolClass.activeLobbyId = lobbyId;
      return lobbyId;
    },
    async seedStudent(classId, student) {
      if (!rosters.has(classId)) rosters.set(classId, new Map());
      rosters.get(classId).set(student.studentId, { ...student });
    },
    async setStudentSeat(lobbyId, studentId, seat) {
      if (!participants.has(lobbyId)) participants.set(lobbyId, new Map());
      participants.get(lobbyId).set(studentId, { studentId, ...seat, status: seat.kicked ? 'kicked' : 'joined' });
    },
    async setLobbyStatus(lobbyId, status) {
      const lobby = lobbies.get(lobbyId);
      if (lobby) lobby.status = status;
    },
    async getSeat(lobbyId, studentId) {
      const seat = participants.get(lobbyId)?.get(studentId);
      return seat ? { ...seat } : null;
    },
    async listSeats(lobbyId) {
      return [...(participants.get(lobbyId)?.values() || [])].map((seat) => ({ ...seat }));
    },
    async getCodeLobbyId(code) {
      return codes.get(code) || null;
    },
    async setCode(code, lobbyId) {
      codes.set(code, lobbyId);
    },
    async setProfileName(studentId, displayName) {
      profileNames.set(studentId, displayName);
    },
  };
}

const db = createMemoryStore();

async function clearDatabase() {
  await db.clear();
}

async function seedClass({ classId = 'class-one', teacherId = 'teacher-one', name = 'Class One' } = {}) {
  return db.seedClass({ classId, teacherId, name });
}

async function seedRoster(classId, students) {
  await Promise.all(students.map((student) => db.seedStudent(classId, student)));
}

async function seedLobby({
  lobbyId = 'lobby-one',
  classId = 'class-one',
  teacherId = 'teacher-one',
  joinCode = 'ABC234',
  status = 'open',
  gameMode = 'divide',
  minWords = 0,
  maxWords = 100,
} = {}) {
  return db.seedLobby({ lobbyId, classId, teacherId, joinCode, status, gameMode, minWords, maxWords });
}

async function startTestServer() {
  const app = express();
  app.use(express.json());

  let io;
  const requireTeacher = (req, res, next) => {
    const uid = req.get('x-teacher-id');
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    req.user = { uid, role: 'teacher' };
    return next();
  };
  const requireStudent = (req, res, next) => {
    const uid = req.get('x-test-student-uid');
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    req.user = { uid, role: 'student' };
    return next();
  };

  app.use(createClassesRouter({ db, requireTeacher, getIo: () => io }));
  app.use(createLobbyRouter({
    db,
    requireTeacher,
    requireStudent,
    jwtSecret: JWT_SECRET,
    getIo: () => io,
  }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    return res.status(500).json({ error: 'Internal server error' });
  });

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

module.exports = {
  JWT_SECRET,
  db,
  clearDatabase,
  seedClass,
  seedRoster,
  seedLobby,
  startTestServer,
  createMemoryStore,
};

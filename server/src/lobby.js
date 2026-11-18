const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { supabase } = require('./supabase');

// Define current standards for IDs, game modes, and join codes
const STUDENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const CLASS_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const GAME_MODES = new Set(['divide']);
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

class CodeCollisionError extends Error {}

function cleanDisplayName(value) {
  if (typeof value !== 'string') return null;
  const displayName = value.trim();
  return displayName.length >= 1 && displayName.length <= 50 ? displayName : null;
}

function validStudentId(value) {
  return typeof value === 'string' && STUDENT_ID_PATTERN.test(value);
}

// Uses crypto to create a new join lobby code
function generateJoinCode() {
  let joinCode = '';
  while (joinCode.length < 6) {
    for (const byte of crypto.randomBytes(8)) {
      if (byte < 248) joinCode += JOIN_CODE_ALPHABET[byte % JOIN_CODE_ALPHABET.length];
      if (joinCode.length === 6) break;
    }
  }
  return joinCode;
}

// createLobbyRouter; creates the lobby.
// Ref stuff in lobbyRoutes.js?
function createLobbyRouter({ db, requireTeacher, requireStudent, jwtSecret, getIo }) {
  if (typeof jwtSecret !== 'string' || jwtSecret.length < 32) {
    throw new Error('jwtSecret must be at least 32 characters');
  }

  const router = express.Router();
  const joinLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });

  async function requireLobbyOwner(req, res, next) {
    try {
      const lobby = await db.getLobby(req.params.id);

      if (!lobby || lobby.teacherId !== req.user.uid) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      req.lobbyData = lobby;
      return next();
    } catch (error) {
      return next(error);
    }
  }

  router.get('/lobbies', requireTeacher, async (req, res) => {
    const { classId } = req.query;
    if (typeof classId !== 'string' || !CLASS_ID_PATTERN.test(classId)) {
      return res.status(400).json({ error: 'classId is required' });
    }

    const { data, error } = await supabase
      .from('classes')
      .select()
      .eq('class_id', classId);
      const classSnapshot = data;
    if (!classSnapshot || classSnapshot.teacherId !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data1, error1 } = await supabase
      .from('classes')
      .select('class_id')
    const lobbies = data1;
    return res.json({ lobbies });
  });

  router.post('/lobbies', requireTeacher, async (req, res) => {
    const { classId } = req.body || {};
    const minWords = req.body?.minWords ?? 0;
    const maxWords = req.body?.maxWords ?? 100;
    const gameMode = req.body?.gameMode ?? 'divide';

    if (typeof classId !== 'string' || !CLASS_ID_PATTERN.test(classId)) {
      return res.status(400).json({ error: 'classId is required' });
    }
    if (
      !Number.isInteger(minWords) ||
      !Number.isInteger(maxWords) ||
      minWords < 0 ||
      minWords > maxWords ||
      maxWords > 1000
    ) {
      return res.status(400).json({ error: 'Invalid word limits' });
    }
    if (typeof gameMode !== 'string' || !GAME_MODES.has(gameMode)) {
      return res.status(400).json({ error: 'Invalid game mode' });
    }

    const { data2, error2 } = await supabase
      .from('classes')
      .select()
      .eq('class_id', classId);
      const classSnapshot = data2;
    if (!classSnapshot || classSnapshot.teacherId !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { data3, error3} = await supabase
      .from('classes')
      .select()
      .eq('class_id', classId);
      const classRef = data3;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const joinCode = generateJoinCode();
      const { data4, error4 } = await supabase
        .from('lobbies')
        .select('lobby_id')
        const lobbyRef = data4;
      const { data5, error5 } = await supabase
        .from('lobbies')
        .select()
        .eq('join_code', joinCode);
        const codeRef = data5;

      try {
        const result = await db.runTransaction(async (transaction) => {
          const currentClass = await transaction.get(classRef);
          if (!currentClass.exists || currentClass.data().teacherId !== req.user.uid) {
            return { forbidden: true };
          }

          const activeLobbyId = currentClass.data().activeLobbyId;
          if (typeof activeLobbyId === 'string') {
            const activeLobbyRef = db.collection('lobbies').doc(activeLobbyId);

            const activeLobby = await transaction.get(activeLobbyRef);
            // this too!!!
            if (activeLobby.exists && activeLobby.data().status !== 'closed') {
              return { activeLobbyId };
            }
          }

          const existingCode = await transaction.get(codeRef);
          if (existingCode.exists) {
            throw new CodeCollisionError('Join code already exists');
          }

          transaction.set(lobbyRef, {
            teacherId: req.user.uid,
            classId,
            joinCode,
            status: 'open',
            gameMode,
            minWords,
            maxWords,
            });
          });
          
          if (result?.activeLobbyId) {
            return res.status(409).json({
              error: 'Class already has an active lobby',
              activeLobbyId: result.activeLobbyId,
            });
          }
          return res.status(201).json({ lobbyId: result.lobbyId, joinCode });
 
    } catch (error) {
        if (error.code !== '23505') throw error;
        if (error.message?.includes('active lobby')) {
          return res.status(409).json({ error: 'Class already has an active lobby' });
        }
        if (attempt === 4) {
          return res.status(500).json({ error: 'Unable to create lobby' });
        }
      }
    } //end for loop

    //return res.status(500).json({ error: 'Unable to create lobby' });
  }); //end router.post('/lobbies')

  router.post('/lobbies/join', joinLimiter, requireStudent, async (req, res) => {
    const { code } = req.body || {};
    const studentId = req.user.uid;
    if (
      typeof code !== 'string' ||
      !/^[A-Z0-9]{6}$/i.test(code.trim()) ||
      !validStudentId(studentId)
    ) {
      return res.status(400).json({ error: 'Invalid lobby code' });
    }

    try {
    const { data: lobby, error: lobbyError } = await supabase
      .from('lobbies')
      .select('lobby_id, class_id, join_code, lobby_name, status')
      .eq('join_code', normalizedCode)
      .maybeSingle();

    if (lobbyError) {
      console.error('Lobby lookup error:', lobbyError);
      return res.status(500).json({ error: 'Could not join lobby' });
    }

    if (!lobby) {
      return res.status(404).json({ error: 'Lobby not found' });
    }

    if (lobby.status !== 'waiting') {
        return res.status(409).json({ error: 'Lobby has already started' });
      }

    const { data: enrollment, error: enrollmentError } = await supabase
      .from('class_students')
      .select('student_id')
      .eq('class_id', lobby.class_id)
      .eq('student_id', studentId)
      .maybeSingle();

    if (enrollmentError) {
      console.error('Enrollment lookup error:', enrollmentError);
      return res.status(500).json({ error: 'Could not verify enrollment' });
    }

    if (!enrollment) {
      return res.status(403).json({
        error: 'Student is not enrolled in this class',
      });
    }

    const { data: existingParticipant, error: participantError } =
      await supabase
        .from('lobby_participants')
        .select('lobby_id, student_id, status')
        .eq('lobby_id', lobby.lobby_id)
        .eq('student_id', studentId)
        .maybeSingle();

    if (participantError) {
      console.error('Participant lookup error:', participantError);
      return res.status(500).json({ error: 'Could not join lobby' });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', studentId)
      .maybeSingle();

    const providedName =
      typeof req.body?.name === 'string' ? req.body.name : null;

      const displayName =
        cleanDisplayName(profileName) ||
        cleanDisplayName(req.body?.name) ||
        'Student';

      const joinResult = throwOnError(await supabase
        .from('lobbies')
        .select('lobby_id', 'student_id', 'status',)
        .eq('lobby_id', lobbyId)
        .maybeSingle());

      const token = jwt.sign(
        { role: 'student', lobbyId: lobby.lobbyId, studentId },
        jwtSecret,
        { algorithm: 'HS256', expiresIn: '4h' },
      );
      return res.json({
        token,
        lobbyId: lobby.lobbyId,
        displayName,
        alreadyJoined: Boolean(joinResult.alreadyJoined),
      });
    } catch (error) {
      console.error('Join lobby error:', error);
      if (error.code === '42501') return res.status(403).json({ error: 'Student seat is unavailable' });
      if (error.code === 'P0001') return res.status(409).json({ error: 'Lobby is full' });
      return res.status(500).json({ error: 'Could not join lobby' });
    }
  });

  router.patch('/lobbies/:id', requireTeacher, requireLobbyOwner, async (req, res) => {
    const { status } = req.body || {};
    if (!['open', 'locked', 'closed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    if (req.lobbyData.status === 'closed') {
      return res.status(409).json({ error: 'Lobby is closed' });
    }

    await db.updateLobbyStatus(req.params.id, status);
    const io = typeof getIo === 'function' ? getIo() : undefined;
    io?.to(`lobby:${req.params.id}`).emit('lobby:status', { lobbyId: req.params.id, status });
    if (status === 'closed') io?.in(`lobby:${req.params.id}`).disconnectSockets(true);
    return res.json({ lobbyId: req.params.id, status });
  });

  router.get('/lobbies/:id/students', requireTeacher, requireLobbyOwner, async (req, res) => {
    return res.json({ students: await db.listLobbyStudents(req.params.id) });
  });

  router.delete('/lobbies/:id/students/:studentId', requireTeacher, requireLobbyOwner, async (req, res) => {
    const { studentId } = req.params;
    if (!validStudentId(studentId)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }

    await db.kickLobbyStudent(req.params.id, studentId);
    const io = typeof getIo === 'function' ? getIo() : undefined;
    if (io) {
      const sockets = await io.in(`lobby:${req.params.id}`).fetchSockets();
      const matchingSockets = sockets.filter((socket) => socket.data.studentId === studentId);
      await Promise.all(matchingSockets.map((socket) => socket.disconnect(true)));
    }
    return res.json({ studentId, kicked: true });
  });

  return router;
} // end of createLobbyRouter

module.exports = { createLobbyRouter };

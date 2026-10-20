const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const STUDENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const CLASS_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const GAME_MODES = new Set(['divide']);
const JOIN_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const JOIN_FAILURE = { error: 'Could not join' };

class CodeCollisionError extends Error {}

function cleanDisplayName(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const displayName = value.trim();
  return displayName.length >= 1 && displayName.length <= 50 ? displayName : null;
}

function validStudentId(value) {
  return typeof value === 'string' && STUDENT_ID_PATTERN.test(value);
}

function generateJoinCode() {
  let joinCode = '';
  while (joinCode.length < 6) {
    for (const byte of crypto.randomBytes(8)) {
      if (byte < 248) {
        joinCode += JOIN_CODE_ALPHABET[byte % JOIN_CODE_ALPHABET.length];
      }
      if (joinCode.length === 6) {
        break;
      }
    }
  }
  return joinCode;
}

function createLobbyRouter({ db, admin, requireTeacher, requireStudent, jwtSecret, getIo }) {
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
      const lobbyRef = db.collection('lobbies').doc(req.params.id);
      const lobbySnapshot = await lobbyRef.get();
      if (!lobbySnapshot.exists || lobbySnapshot.data().teacherId !== req.user.uid) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      req.lobbyRef = lobbyRef;
      req.lobbyData = lobbySnapshot.data();
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

    const classSnapshot = await db.collection('classes').doc(classId).get();
    if (!classSnapshot.exists || classSnapshot.data().teacherId !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const snapshot = await db.collection('lobbies')
      .where('teacherId', '==', req.user.uid)
      .get();
    return res.json({
      lobbies: snapshot.docs
        .map((doc) => ({ lobbyId: doc.id, ...doc.data() }))
        .filter((lobby) => lobby.classId === classId && lobby.status !== 'closed')
        .sort((first, second) => {
          const firstCreated = first.createdAt?.toMillis?.() || 0;
          const secondCreated = second.createdAt?.toMillis?.() || 0;
          return secondCreated - firstCreated;
        }),
    });
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

    const classRef = db.collection('classes').doc(classId);
    const classSnapshot = await classRef.get();
    if (!classSnapshot.exists || classSnapshot.data().teacherId !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const joinCode = generateJoinCode();
      const lobbyRef = db.collection('lobbies').doc();
      const codeRef = db.collection('lobbyCodes').doc(joinCode);

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
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          transaction.set(codeRef, { lobbyId: lobbyRef.id });
            transaction.update(classRef, { activeLobbyId: lobbyRef.id });
            return { lobbyId: lobbyRef.id };
        });

          if (result.forbidden) return res.status(403).json({ error: 'Forbidden' });
          if (result.activeLobbyId) {
            return res.status(409).json({ error: 'Class already has an active lobby', ...result });
          }

        return res.status(201).json({ lobbyId: lobbyRef.id, joinCode });
      } catch (error) {
        if (!(error instanceof CodeCollisionError)) {
          throw error;
        }
      }
    }

    return res.status(500).json({ error: 'Unable to create lobby' });
  });

  router.post('/lobbies/join', joinLimiter, requireStudent, async (req, res) => {
    const { code } = req.body || {};
    const studentId = req.user.uid;
    if (
      typeof code !== 'string' ||
      !/^[A-HJ-NP-Z2-9]{6}$/i.test(code.trim()) ||
      !validStudentId(studentId)
    ) {
      return res.status(401).json(JOIN_FAILURE);
    }

    try {
      const codeSnapshot = await db.collection('lobbyCodes').doc(code.trim().toUpperCase()).get();
      if (!codeSnapshot.exists) {
        return res.status(401).json(JOIN_FAILURE);
      }

      const lobbyId = codeSnapshot.data().lobbyId;
      if (typeof lobbyId !== 'string' || lobbyId.length === 0) {
        return res.status(401).json(JOIN_FAILURE);
      }

      const lobbyRef = db.collection('lobbies').doc(lobbyId);
      const joinResult = await db.runTransaction(async (transaction) => {
        const lobbySnapshot = await transaction.get(lobbyRef);
        if (!lobbySnapshot.exists || lobbySnapshot.data().status !== 'open') return null;

        const seatRef = lobbyRef.collection('students').doc(studentId);
        const seatSnapshot = await transaction.get(seatRef);
        if (seatSnapshot.data()?.kicked === true) return null;

        const providedName = typeof req.body?.name === 'string' ? req.body.name : null;
        const fallbackName = cleanDisplayName(providedName) || cleanDisplayName(studentId) || 'Student';
        if (!fallbackName) return null;

        transaction.set(seatRef, {
          displayName: fallbackName,
          joinedAt: admin.firestore.FieldValue.serverTimestamp(),
          kicked: false,
        }, { merge: true });
        return { displayName: fallbackName };
      });

      if (!joinResult) return res.status(401).json(JOIN_FAILURE);

      const token = jwt.sign(
        { role: 'student', lobbyId, studentId },
        jwtSecret,
        { algorithm: 'HS256', expiresIn: '4h' },
      );
      return res.json({ token, lobbyId, displayName: joinResult.displayName });
    } catch (error) {
      return res.status(500).json({ error: 'Internal server error' });
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

    const batch = db.batch();
    batch.update(req.lobbyRef, { status });
    if (status === 'closed') {
      batch.delete(db.collection('lobbyCodes').doc(req.lobbyData.joinCode));
      const classRef = db.collection('classes').doc(req.lobbyData.classId);
      const classSnapshot = await classRef.get();
      if (classSnapshot.data()?.activeLobbyId === req.params.id) {
        batch.update(classRef, { activeLobbyId: null });
      }
    }
    await batch.commit();

    const io = typeof getIo === 'function' ? getIo() : undefined;
    io?.to(`lobby:${req.params.id}`).emit('lobby:status', { lobbyId: req.params.id, status });
    if (status === 'closed') {
      io?.in(`lobby:${req.params.id}`).disconnectSockets(true);
    }

    return res.json({ lobbyId: req.params.id, status });
  });

  router.get('/lobbies/:id/students', requireTeacher, requireLobbyOwner, async (req, res) => {
    const snapshot = await req.lobbyRef.collection('students').get();
    return res.json({
      students: snapshot.docs
        .filter((doc) => doc.data().kicked !== true)
        .map((doc) => ({ studentId: doc.id, ...doc.data() })),
    });
  });

  router.delete('/lobbies/:id/students/:studentId', requireTeacher, requireLobbyOwner, async (req, res) => {
    const { studentId } = req.params;
    if (!validStudentId(studentId)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }

    await req.lobbyRef.collection('students').doc(studentId).set({ kicked: true }, { merge: true });

    const io = typeof getIo === 'function' ? getIo() : undefined;
    if (io) {
      const sockets = await io.in(`lobby:${req.params.id}`).fetchSockets();
      const matchingSockets = sockets.filter((socket) => socket.data.studentId === studentId);
      await Promise.all(matchingSockets.map((socket) => socket.disconnect(true)));
    }

    return res.json({ studentId, kicked: true });
  });

  return router;
}

module.exports = { createLobbyRouter };
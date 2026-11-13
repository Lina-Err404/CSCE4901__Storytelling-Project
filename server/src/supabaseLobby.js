const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_PATTERN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
const ACTIVE_STATUSES = ['waiting', 'active', 'open', 'locked'];

function throwOnError(result) {
  if (result.error) throw result.error;
  return result.data;
}

function createJoinCode() {
  let code = '';
  while (code.length < 6) {
    for (const byte of crypto.randomBytes(8)) {
      if (byte < 224) code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      if (code.length === 6) break;
    }
  }
  return code;
}

function databaseStatus(status) {
  if (status === 'open') return 'waiting';
  if (status === 'locked') return 'active';
  return status;
}

function clientStatus(status) {
  if (status === 'waiting') return 'open';
  if (status === 'active') return 'locked';
  return status;
}

function createLobbyRouter({ supabase, requireTeacher, requireStudent, jwtSecret, getIo }) {
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
    if (!UUID_PATTERN.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid lobbyId' });
    }

    try {
      const lobby = throwOnError(await supabase
        .from('lobbies')
        .select('lobby_id, class_id, join_code, status')
        .eq('lobby_id', req.params.id)
        .maybeSingle());
      if (!lobby) return res.status(403).json({ error: 'Forbidden' });

      const schoolClass = throwOnError(await supabase
        .from('classes')
        .select('teacher_id')
        .eq('class_id', lobby.class_id)
        .maybeSingle());
      if (!schoolClass || schoolClass.teacher_id !== req.user.uid) {
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
    if (typeof classId !== 'string' || !UUID_PATTERN.test(classId)) {
      return res.status(400).json({ error: 'classId is required' });
    }

    const schoolClass = throwOnError(await supabase
      .from('classes')
      .select('teacher_id')
      .eq('class_id', classId)
      .maybeSingle());
    if (!schoolClass || schoolClass.teacher_id !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const lobbies = throwOnError(await supabase
      .from('lobbies')
      .select('lobby_id, join_code, status, created_at')
      .eq('class_id', classId)
      .neq('status', 'closed')
      .order('created_at', { ascending: false }));
    return res.json({
      lobbies: lobbies.map((lobby) => ({
        lobbyId: lobby.lobby_id,
        joinCode: lobby.join_code,
        status: clientStatus(lobby.status),
        createdAt: lobby.created_at,
      })),
    });
  });

  router.post('/lobbies', requireTeacher, async (req, res) => {
    const { classId } = req.body || {};
    if (typeof classId !== 'string' || !UUID_PATTERN.test(classId)) {
      return res.status(400).json({ error: 'classId is required' });
    }

    const schoolClass = throwOnError(await supabase
      .from('classes')
      .select('class_id, teacher_id, class_name')
      .eq('class_id', classId)
      .maybeSingle());
    if (!schoolClass || schoolClass.teacher_id !== req.user.uid) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const currentLobbies = throwOnError(await supabase
      .from('lobbies')
      .select('lobby_id')
      .eq('class_id', classId)
      .in('status', ACTIVE_STATUSES)
      .limit(1));
    if (currentLobbies.length) {
      return res.status(409).json({
        error: 'Class already has an active lobby',
        lobbyId: currentLobbies[0].lobby_id,
      });
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const joinCode = createJoinCode();
      const existingCode = throwOnError(await supabase
        .from('lobbies')
        .select('lobby_id')
        .eq('join_code', joinCode)
        .maybeSingle());
      if (existingCode) continue;

      const result = await supabase
        .from('lobbies')
        .insert({
          class_id: classId,
          join_code: joinCode,
          lobby_name: `${schoolClass.class_name} Lobby`,
          status: 'waiting',
        })
        .select('lobby_id')
        .single();

      if (!result.error) {
        return res.status(201).json({ lobbyId: result.data.lobby_id, joinCode });
      }
      if (result.error.code !== '23505') throw result.error;
    }

    return res.status(409).json({ error: 'Unable to allocate a unique lobby code' });
  });

  router.post('/lobbies/join', joinLimiter, requireStudent, async (req, res) => {
    const rawCode = req.body?.code;
    if (
      typeof rawCode !== 'string' ||
      !CODE_PATTERN.test(rawCode.trim().toUpperCase()) ||
      !UUID_PATTERN.test(req.user.uid)
    ) {
      return res.status(401).json({ error: 'Could not join' });
    }
    const code = rawCode.trim().toUpperCase();

    try {
      const lobby = throwOnError(await supabase
        .from('lobbies')
        .select('lobby_id, class_id, status')
        .eq('join_code', code)
        .maybeSingle());
      if (!lobby || !['waiting', 'open'].includes(lobby.status)) {
        return res.status(401).json({ error: 'Could not join' });
      }

      const enrollment = throwOnError(await supabase
        .from('class_students')
        .select('student_id')
        .eq('class_id', lobby.class_id)
        .eq('student_id', req.user.uid)
        .maybeSingle());
      if (!enrollment) return res.status(401).json({ error: 'Could not join' });

      const previous = throwOnError(await supabase
        .from('lobby_participants')
        .select('status')
        .eq('lobby_id', lobby.lobby_id)
        .eq('student_id', req.user.uid)
        .maybeSingle());
      if (previous?.status === 'kicked') {
        return res.status(401).json({ error: 'Could not join' });
      }

      const participantResult = await supabase
        .from('lobby_participants')
        .upsert(
          { lobby_id: lobby.lobby_id, student_id: req.user.uid, status: 'active' },
          { onConflict: 'lobby_id,student_id' },
        );
      throwOnError(participantResult);

      const profile = throwOnError(await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', req.user.uid)
        .single());
      const token = jwt.sign(
        { role: 'student', lobbyId: lobby.lobby_id, studentId: req.user.uid },
        jwtSecret,
        { algorithm: 'HS256', expiresIn: '4h' },
      );
      return res.json({
        token,
        lobbyId: lobby.lobby_id,
        displayName: profile.display_name,
      });
    } catch (error) {
      if (error.status) return res.status(error.status).json({ error: error.message });
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

    const storedStatus = databaseStatus(status);
    throwOnError(await supabase
      .from('lobbies')
      .update({ status: storedStatus })
      .eq('lobby_id', req.lobbyData.lobby_id));

    const io = typeof getIo === 'function' ? getIo() : undefined;
    io?.to(`lobby:${req.lobbyData.lobby_id}`).emit('lobby:status', {
      lobbyId: req.lobbyData.lobby_id,
      status,
    });
    if (status === 'closed') {
      io?.in(`lobby:${req.lobbyData.lobby_id}`).disconnectSockets(true);
    }

    return res.json({ lobbyId: req.lobbyData.lobby_id, status });
  });

  router.get('/lobbies/:id/students', requireTeacher, requireLobbyOwner, async (req, res) => {
    const participants = throwOnError(await supabase
      .from('lobby_participants')
      .select('student_id')
      .eq('lobby_id', req.lobbyData.lobby_id)
      .eq('status', 'active'));
    const studentIds = participants.map(({ student_id }) => student_id);
    if (!studentIds.length) return res.json({ students: [] });

    const profiles = throwOnError(await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', studentIds)
      .order('display_name'));
    return res.json({
      students: profiles.map(({ id, display_name }) => ({ studentId: id, displayName: display_name })),
    });
  });

  router.delete('/lobbies/:id/students/:studentId', requireTeacher, requireLobbyOwner, async (req, res) => {
    const { studentId } = req.params;
    if (!UUID_PATTERN.test(studentId)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }

    throwOnError(await supabase
      .from('lobby_participants')
      .update({ status: 'kicked' })
      .eq('lobby_id', req.lobbyData.lobby_id)
      .eq('student_id', studentId)
      .eq('status', 'active'));

    const io = typeof getIo === 'function' ? getIo() : undefined;
    if (io) {
      const sockets = await io.in(`lobby:${req.lobbyData.lobby_id}`).fetchSockets();
      const matchingSockets = sockets.filter((socket) => socket.data.studentId === studentId);
      await Promise.all(matchingSockets.map((socket) => socket.disconnect(true)));
    }

    return res.json({ studentId, kicked: true });
  });

  return router;
}

module.exports = {
  clientStatus,
  createLobbyRouter,
  databaseStatus,
};

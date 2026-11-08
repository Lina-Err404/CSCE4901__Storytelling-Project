const { generateJoinCode } = require('./joinCode');
const express = require('express');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const { toApiStatus } = require('./status');
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function check(error) { if (error) throw error; }
function createLobbyRouter({ db, requireTeacher, requireStudent, jwtSecret, getIo }) {
  const router = express.Router();
  const joinLimiter = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });
  async function requireLobbyOwner(req, res, next) {
    try {
      const { data, error } = await db.from('lobbies').select('lobby_id,class_id,status')
        .eq('lobby_id', req.params.id).maybeSingle();
      check(error);
      if (!data) return res.status(404).json({ error: 'Lobby not found' });
      const { data: c, error: ce } = await db.from('classes').select('teacher_id')
        .eq('class_id', data.class_id).maybeSingle();
      check(ce);
      if (!c || c.teacher_id !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });
      req.lobby = data;
      next();
    } catch (error) { next(error); }
  }
  router.get('/lobbies', requireTeacher, async (req, res) => {
    const { classId } = req.query;
    if (typeof classId !== 'string' || !UUID.test(classId)) return res.status(400).json({ error: 'classId is required' });
    const { data: c, error: ce } = await db.from('classes').select('teacher_id').eq('class_id', classId).maybeSingle();
    check(ce);
    if (!c || c.teacher_id !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });
    const { data, error } = await db.from('lobbies').select('lobby_id,join_code,status,created_at')
      .eq('class_id', classId).neq('status', 'closed').order('created_at', { ascending: false });
    check(error);
    return res.json({ lobbies: (data || []).map((l) => ({
      lobbyId: l.lobby_id, joinCode: l.join_code, status: toApiStatus(l.status), createdAt: l.created_at,
    })) });
  });
  router.post('/lobbies', requireTeacher, async (req, res) => {
    const { classId } = req.body || {};
    const minWords = req.body?.minWords ?? 0;
    const maxWords = req.body?.maxWords ?? 100;
    if (typeof classId !== 'string' || !UUID.test(classId)) return res.status(400).json({ error: 'classId required' });
    if (!Number.isInteger(minWords) || !Number.isInteger(maxWords) || minWords < 0 ||
      minWords > maxWords || maxWords > 1000 || (req.body?.gameMode ?? 'divide') !== 'divide') {
      return res.status(400).json({ error: 'Invalid lobby settings' });
    }
    for (let i = 0; i < 5; i++) {
      const { data, error } = await db.rpc('r12_create_lobby', {
        p_class_id: classId, p_teacher_id: req.user.uid, p_join_code: generateJoinCode(),
        p_game_mode: 'divide', p_min_words: minWords, p_max_words: maxWords,
      });
      if (!error) return res.status(201).json({ lobbyId: data.lobby_id, joinCode: data.join_code });
      if (error.code === '23505') continue;
      if (error.message?.includes('active lobby')) return res.status(409).json({ error: 'Class already has an active lobby' });
      if (error.message?.includes('not found for this teacher')) return res.status(403).json({ error: 'Forbidden' });
      throw error;
    }
    return res.status(500).json({ error: 'Unable to create a unique join code' });
  });
  router.post('/lobbies/join', joinLimiter, requireStudent, async (req, res) => {
    const requestedCode = req.body?.lobbyCode ?? req.body?.code;
    const code = typeof requestedCode === 'string' ? requestedCode.trim().toUpperCase() : '';
    if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code) || req.user.role !== 'student') {
      return res.status(401).json({ error: 'Could not join' });
    }
    const { data, error } = await db.rpc('r12_join_lobby', { p_code: code, p_student_id: req.user.uid });
    if (error) {
      if (error.code === 'P0001' || error.code === '23505') return res.status(401).json({ error: 'Could not join' });
      throw error;
    }
    const token = jwt.sign({ role: 'student', lobbyId: data.lobbyId, studentId: req.user.uid },
      jwtSecret, { algorithm: 'HS256', expiresIn: '4h' });
    return res.json({
      success: true,
      code,
      playerCount: data.playerCount,
      alreadyJoined: data.alreadyJoined,
      token,
      lobbyId: data.lobbyId,
      displayName: data.displayName,
      status: toApiStatus(data.status),
    });
  });
  router.patch('/lobbies/:id', requireTeacher, requireLobbyOwner, async (req, res) => {
    const { status } = req.body || {};
    if (!['open', 'locked', 'closed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const { error } = await db.rpc('r12_set_lobby_status', {
      p_lobby_id: req.params.id, p_teacher_id: req.user.uid, p_status: status,
    });
    if (error) {
      if (error.code === 'P0001') return res.status(409).json({ error: error.message });
      throw error;
    }
    const io = getIo?.();
    io?.to(`lobby:${req.params.id}`).emit('lobby:status', { lobbyId: req.params.id, status });
    if (status === 'closed') io?.in(`lobby:${req.params.id}`).disconnectSockets(true);
    return res.json({ lobbyId: req.params.id, status });
  });
  router.get('/lobbies/:id/students', requireTeacher, requireLobbyOwner, async (req, res) => {
    const { data, error } = await db.from('lobby_participants').select('student_id')
      .eq('lobby_id', req.params.id).eq('status', 'active');
    check(error);
    const ids = (data || []).map((s) => s.student_id);
    const { data: profiles, error: pe } = ids.length ? await db.from('profiles')
      .select('id,display_name').in('id', ids) : { data: [], error: null };
    check(pe);
    const names = new Map((profiles || []).map((p) => [p.id, p.display_name]));
    return res.json({ students: ids.map((studentId) => ({
      studentId, rosterStudentId: studentId, displayName: names.get(studentId) || 'Student',
    })) });
  });
  router.delete('/lobbies/:id/students/:studentId', requireTeacher, requireLobbyOwner, async (req, res) => {
    const studentId = req.params.studentId;
    if (!UUID.test(studentId)) return res.status(400).json({ error: 'Invalid studentId' });
    const { error } = await db.rpc('r12_kick_lobby_student', {
      p_lobby_id: req.params.id, p_teacher_id: req.user.uid, p_student_id: studentId,
    });
    check(error);
    const io = getIo?.();
    if (io) {
      const sockets = await io.in(`lobby:${req.params.id}`).fetchSockets();
      await Promise.all(sockets.filter((socket) => socket.data.studentId === studentId)
        .map((socket) => socket.disconnect(true)));
    }
    return res.json({ studentId, kicked: true });
  });
  return router;
}
module.exports = { createLobbyRouter, generateJoinCode, toApiStatus };

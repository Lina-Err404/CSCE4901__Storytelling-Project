const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 1024 * 1024 } });
function check(error) { if (error) throw error; }
function cleanName(input) {
  const name = typeof input === 'string' ? input.trim() : '';
  return name.length >= 1 && name.length <= 50 ? name : null;
}
async function userDirectory(db) {
  // Existing class_students.student_id is an Auth UUID. CSV school IDs are not stored;
  // rows must resolve to a registered Supabase Auth account (by UUID or email).
  const byId = new Map();
  const byEmail = new Map();
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    check(error);
    const users = data.users || [];
    users.forEach((user) => {
      byId.set(user.id.toLowerCase(), user);
      if (user.email) byEmail.set(user.email.toLowerCase(), user);
    });
    if (users.length < 1000) break;
  }
  return { byId, byEmail };
}
async function withNames(db, ids) {
  if (!ids.length) return [];
  const { data, error } = await db.from('profiles').select('id,display_name').in('id', ids);
  check(error);
  const names = new Map((data || []).map((p) => [p.id, p.display_name]));
  return ids.map((id) => ({ studentId: id, displayName: names.get(id) || 'Student' }));
}
function createClassesRouter({ db, requireTeacher, getIo }) {
  const router = express.Router();
  async function requireClassOwner(req, res, next) {
    try {
      const { data, error } = await db.from('classes').select('class_id,teacher_id')
        .eq('class_id', req.params.id).maybeSingle();
      check(error);
      if (!data || data.teacher_id !== req.user.uid) return res.status(403).json({ error: 'Forbidden' });
      req.schoolClass = data;
      next();
    } catch (error) { next(error); }
  }
  const receiveRoster = (req, res, next) => upload.single('file')(req, res, (error) => {
    if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400)
      .json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'File too large' : 'Invalid upload' });
    next();
  });
  router.post('/classes', requireTeacher, async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (name.length < 1 || name.length > 80) return res.status(400).json({ error: 'Name must be 1-80 characters' });
    const { data, error } = await db.from('classes').insert({ teacher_id: req.user.uid, class_name: name })
      .select('class_id,class_name').single();
    check(error);
    return res.status(201).json({ classId: data.class_id, name: data.class_name });
  });
  router.get('/classes', requireTeacher, async (_req, res) => {
    const { data, error } = await db.from('classes').select('class_id,class_name')
      .eq('teacher_id', _req.user.uid).order('class_name');
    check(error);
    return res.json({ classes: (data || []).map((c) => ({ classId: c.class_id, name: c.class_name })) });
  });
  router.post('/classes/:id/roster', requireTeacher, requireClassOwner, receiveRoster, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'CSV file is required' });
    let records;
    try { records = parse(req.file.buffer, { bom: true, skip_empty_lines: true, relax_column_count: false }); }
    catch { return res.status(400).json({ error: 'Invalid CSV' }); }
    const header = records[0]?.map((field) => String(field).trim().toLowerCase());
    if (!header || header[0] !== 'studentid' || header[1] !== 'name' ||
      !(header.length === 2 || (header.length === 3 && header[2] === 'email'))) {
      return res.status(400).json({ error: 'Expected studentId,name[,email]' });
    }
    const rows = records.slice(1);
    if (rows.length > 500) return res.status(400).json({ error: 'Maximum 500 rows' });
    const { byId, byEmail } = await userDirectory(db);
    const seen = new Set();
    const accepted = [];
    const rejected = [];
    for (let i = 0; i < rows.length; i++) {
      const [rawId, rawName, rawEmail] = rows[i];
      const studentId = String(rawId || '').trim();
      const displayName = cleanName(rawName);
      const email = String(rawEmail || '').trim().toLowerCase();
      const user = (UUID.test(studentId) && byId.get(studentId.toLowerCase())) || (email && byEmail.get(email));
      const reason = !displayName ? 'Invalid name (1-50 characters)' :
        !user ? 'Student must register in Supabase Auth first; supply Auth UUID or registered email' :
        seen.has(user.id) ? 'Duplicate student' : null;
      if (reason) { rejected.push({ row: i + 2, reason }); continue; }
      seen.add(user.id);
      accepted.push({ id: user.id, name: displayName });
    }
    for (const user of accepted) {
      // Preserve any existing profile role/name; create only when absent.
      const { error: profileError } = await db.from('profiles').upsert(
        { id: user.id, display_name: user.name, role: 'student' },
        { onConflict: 'id', ignoreDuplicates: true });
      check(profileError);
    }
    for (let i = 0; i < accepted.length; i += 200) {
      const chunk = accepted.slice(i, i + 200).map((student) =>
        ({ class_id: req.params.id, student_id: student.id }));
      const { error } = await db.from('class_students').upsert(chunk,
        { onConflict: 'class_id,student_id', ignoreDuplicates: true });
      check(error);
    }
    return res.json({ imported: accepted.length, rejected });
  });
  router.put('/classes/:id/roster/:studentId', requireTeacher, requireClassOwner, async (req, res) => {
    const studentId = req.params.studentId;
    const displayName = cleanName(req.body?.name);
    if (!UUID.test(studentId) || !displayName) return res.status(400).json({ error: 'Invalid studentId or name' });
    const { data: membership, error: memberError } = await db.from('class_students')
      .select('student_id').eq('class_id', req.params.id).eq('student_id', studentId).maybeSingle();
    check(memberError);
    if (!membership) return res.status(404).json({ error: 'Student not in this class' });
    const { error } = await db.from('profiles').update({ display_name: displayName }).eq('id', studentId);
    check(error);
    return res.json({ studentId, displayName });
  });
  router.get('/classes/:id/roster', requireTeacher, requireClassOwner, async (req, res) => {
    const { data, error } = await db.from('class_students').select('student_id').eq('class_id', req.params.id);
    check(error);
    const students = await withNames(db, (data || []).map((s) => s.student_id));
    students.sort((a,b) => a.displayName.localeCompare(b.displayName));
    return res.json({ students });
  });
  router.delete('/classes/:id/roster/:studentId', requireTeacher, requireClassOwner, async (req, res) => {
    const studentId = req.params.studentId;
    if (!UUID.test(studentId)) return res.status(400).json({ error: 'Invalid studentId' });
    const { data: lobbyId, error } = await db.rpc('r12_remove_roster_student', {
      p_class_id: req.params.id, p_teacher_id: req.user.uid, p_student_id: studentId,
    });
    check(error);
    const io = getIo?.();
    if (io && lobbyId) {
      const sockets = await io.in(`lobby:${lobbyId}`).fetchSockets();
      await Promise.all(sockets.filter((socket) => socket.data.studentId === studentId)
        .map((socket) => socket.disconnect(true)));
    }
    return res.json({ deleted: true });
  });
  return router;
}
module.exports = { createClassesRouter };

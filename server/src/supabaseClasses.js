const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_FILE_SIZE = 1024 * 1024;
const MAX_ROWS = 500;

function cleanDisplayName(value) {
  if (typeof value !== 'string') return null;
  const displayName = value.trim();
  return displayName.length >= 1 && displayName.length <= 50 ? displayName : null;
}

function validStudentId(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function throwOnError(result) {
  if (result.error) throw result.error;
  return result.data;
}

function createClassesRouter({ supabase, requireTeacher, getIo }) {
  const router = express.Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
  });

  async function requireClassOwner(req, res, next) {
    if (!UUID_PATTERN.test(req.params.id)) {
      return res.status(400).json({ error: 'Invalid classId' });
    }

    try {
      const result = await supabase
        .from('classes')
        .select('class_id, teacher_id, class_name')
        .eq('class_id', req.params.id)
        .maybeSingle();
      const schoolClass = throwOnError(result);
      if (!schoolClass || schoolClass.teacher_id !== req.user.uid) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      req.classData = schoolClass;
      return next();
    } catch (error) {
      return next(error);
    }
  }

  function receiveRosterFile(req, res, next) {
    upload.single('file')(req, res, (error) => {
      if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large' });
      }
      if (error) return res.status(400).json({ error: 'Invalid upload' });
      return next();
    });
  }

  async function saveRosterRows(classId, rows) {
    if (!rows.length) return { accepted: [], missing: [] };
    const profileIds = [...new Set(rows.map(({ studentId }) => studentId))];
    const profiles = throwOnError(await supabase
      .from('profiles')
      .select('id')
      .in('id', profileIds));
    const existingIds = new Set(profiles.map(({ id }) => id));
    const accepted = rows.filter(({ studentId }) => existingIds.has(studentId));
    const missing = rows.filter(({ studentId }) => !existingIds.has(studentId));

    await Promise.all(
      accepted.map(({ studentId, displayName }) =>
        supabase
          .from('profiles')
          .update({ display_name: displayName })
          .eq('id', studentId)
          .then(throwOnError),
      ),
    );

    if (accepted.length) {
      throwOnError(await supabase
        .from('class_students')
        .upsert(
          accepted.map(({ studentId }) => ({ class_id: classId, student_id: studentId })),
          { onConflict: 'class_id,student_id', ignoreDuplicates: true },
        ));
    }

    return { accepted, missing };
  }

  router.post('/classes', requireTeacher, async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (name.length < 1 || name.length > 80) {
      return res.status(400).json({ error: 'Name must be 1-80 characters' });
    }

    const schoolClass = throwOnError(await supabase
      .from('classes')
      .insert({ teacher_id: req.user.uid, class_name: name })
      .select('class_id, class_name')
      .single());
    return res.status(201).json({ classId: schoolClass.class_id, name: schoolClass.class_name });
  });

  router.get('/classes', requireTeacher, async (req, res) => {
    const classes = throwOnError(await supabase
      .from('classes')
      .select('class_id, class_name')
      .eq('teacher_id', req.user.uid)
      .order('class_name'));
    return res.json({
      classes: classes.map(({ class_id, class_name }) => ({ classId: class_id, name: class_name })),
    });
  });

  router.post('/classes/:id/roster', requireTeacher, requireClassOwner, receiveRosterFile, async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'CSV file is required' });

    let records;
    try {
      records = parse(req.file.buffer, {
        bom: true,
        skip_empty_lines: true,
        relax_column_count: false,
      });
    } catch {
      return res.status(400).json({ error: 'Invalid CSV' });
    }

    const header = records[0]?.map((field) => String(field).trim().toLowerCase());
    if (!header || header.length !== 2 || header[0] !== 'studentid' || header[1] !== 'name') {
      return res.status(400).json({ error: 'CSV header must be studentId,name' });
    }

    const sourceRows = records.slice(1);
    if (sourceRows.length > MAX_ROWS) {
      return res.status(400).json({ error: 'Maximum 500 rows' });
    }

    const seenIds = new Set();
    const validRows = [];
    const rejected = [];

    sourceRows.forEach((record, index) => {
      const row = index + 2;
      const studentId = record[0]?.trim();
      const displayName = cleanDisplayName(record[1]);

      if (!validStudentId(studentId)) {
        rejected.push({ row, reason: 'studentId must be a Supabase user UUID' });
      } else if (seenIds.has(studentId)) {
        rejected.push({ row, reason: 'Duplicate studentId' });
      } else if (!displayName) {
        rejected.push({ row, reason: 'Name must be 1-50 characters' });
      } else {
        seenIds.add(studentId);
        validRows.push({ studentId, displayName, row });
      }
    });

    const { accepted, missing } = await saveRosterRows(req.classData.class_id, validRows);
    missing.forEach(({ row }) => rejected.push({ row, reason: 'Supabase profile not found' }));
    return res.json({ imported: accepted.length, rejected });
  });

  router.put('/classes/:id/roster/:studentId', requireTeacher, requireClassOwner, async (req, res) => {
    const { studentId } = req.params;
    if (!validStudentId(studentId)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }

    const displayName = cleanDisplayName(req.body?.name);
    if (!displayName) {
      return res.status(400).json({ error: 'Name must be 1-50 characters' });
    }

    const profile = throwOnError(await supabase
      .from('profiles')
      .select('id')
      .eq('id', studentId)
      .maybeSingle());
    if (!profile) return res.status(404).json({ error: 'Student profile not found' });

    throwOnError(await supabase
      .from('profiles')
      .update({ display_name: displayName })
      .eq('id', studentId));
    throwOnError(await supabase
      .from('class_students')
      .upsert(
        { class_id: req.classData.class_id, student_id: studentId },
        { onConflict: 'class_id,student_id', ignoreDuplicates: true },
      ));
    return res.json({ studentId, displayName });
  });

  router.get('/classes/:id/roster', requireTeacher, requireClassOwner, async (req, res) => {
    const enrollments = throwOnError(await supabase
      .from('class_students')
      .select('student_id')
      .eq('class_id', req.classData.class_id));
    const studentIds = enrollments.map(({ student_id }) => student_id);
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

  router.delete('/classes/:id/roster/:studentId', requireTeacher, requireClassOwner, async (req, res) => {
    const { studentId } = req.params;
    if (!validStudentId(studentId)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }

    const schoolLobbies = throwOnError(await supabase
      .from('lobbies')
      .select('lobby_id')
      .eq('class_id', req.classData.class_id)
      .in('status', ['waiting', 'active', 'open', 'locked']));
    const lobbyIds = schoolLobbies.map(({ lobby_id }) => lobby_id);

    throwOnError(await supabase
      .from('class_students')
      .delete()
      .eq('class_id', req.classData.class_id)
      .eq('student_id', studentId));

    if (lobbyIds.length) {
      throwOnError(await supabase
        .from('lobby_participants')
        .update({ status: 'kicked' })
        .in('lobby_id', lobbyIds)
        .eq('student_id', studentId)
        .eq('status', 'active'));
    }

    const io = typeof getIo === 'function' ? getIo() : undefined;
    if (io && lobbyIds.length) {
      const rooms = lobbyIds.map((id) => `lobby:${id}`);
      const sockets = await io.in(rooms).fetchSockets();
      const matchingSockets = sockets.filter((socket) => socket.data.studentId === studentId);
      await Promise.all(matchingSockets.map((socket) => socket.disconnect(true)));
    }
    return res.json({ deleted: true });
  });

  return router;
}

module.exports = { createClassesRouter, validStudentId };

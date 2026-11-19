const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');

const STUDENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const MAX_FILE_SIZE = 1024 * 1024;
const MAX_ROWS = 500;
const BATCH_SIZE = 400;

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

function createClassesRouter({ db, requireTeacher, getIo }) {
  const router = express.Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
  });

  async function requireClassOwner(req, res, next) {
    try {
      const classData = await db.getClass(req.params.id);
      if (!classData || classData.teacherId !== req.user.uid) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      req.classData = classData;
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
      if (error) {
        return res.status(400).json({ error: 'Invalid upload' });
      }
      return next();
    });
  }

  router.post('/classes', requireTeacher, async (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (name.length < 1 || name.length > 80) {
      return res.status(400).json({ error: 'Name must be 1-80 characters' });
    }

    const schoolClass = await db.createClass({ teacherId: req.user.uid, name });
    return res.status(201).json({ classId: schoolClass.classId, name: schoolClass.name });
  });

  router.get('/classes', requireTeacher, async (req, res) => {
    return res.json({ classes: await db.listClasses(req.user.uid) });
  });

  router.post('/classes/:id/roster', requireTeacher, requireClassOwner, receiveRosterFile, async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required' });
    }

    let records;
    try {
      records = parse(req.file.buffer, {
        bom: true,
        skip_empty_lines: true,
        relax_column_count: false,
      });
    } catch (error) {
      return res.status(400).json({ error: 'Invalid CSV' });
    }

    const header = records[0]?.map((field) => String(field).trim().toLowerCase());
    if (!header || header.length !== 2 || header[0] !== 'studentid' || header[1] !== 'name') {
      return res.status(400).json({ error: 'CSV header must be studentId,name' });
    }

    const rows = records.slice(1);
    if (rows.length > MAX_ROWS) {
      return res.status(400).json({ error: 'Maximum 500 rows' });
    }

    const seenIds = new Set();
    const accepted = [];
    const rejected = [];

    rows.forEach((record, index) => {
      const row = index + 2;
      const studentId = record[0];
      const displayName = cleanDisplayName(record[1]);

      if (!validStudentId(studentId)) {
        rejected.push({ row, reason: 'Invalid studentId' });
        return;
      }
      if (seenIds.has(studentId)) {
        rejected.push({ row, reason: 'Duplicate studentId' });
        return;
      }
      seenIds.add(studentId);

      if (!displayName) {
        rejected.push({ row, reason: 'Name must be 1-50 characters' });
        return;
      }
      accepted.push({ studentId, displayName });
    });

    for (let offset = 0; offset < accepted.length; offset += BATCH_SIZE) {
      await db.upsertRoster(req.params.id, accepted.slice(offset, offset + BATCH_SIZE));
    }

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

    await db.upsertRoster(req.params.id, [{ studentId, displayName }]);
    return res.json({ studentId, displayName });
  });

  router.get('/classes/:id/roster', requireTeacher, requireClassOwner, async (req, res) => {
    return res.json({ students: await db.listRoster(req.params.id) });
  });

  router.delete('/classes/:id/roster/:studentId', requireTeacher, requireClassOwner, async (req, res) => {
    const { studentId } = req.params;
    if (!validStudentId(studentId)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }

    const activeLobbyId = await db.deleteRosterStudent(req.params.id, studentId);

    const io = typeof getIo === 'function' ? getIo() : undefined;
    if (io && activeLobbyId) {
      const sockets = await io.in(`lobby:${activeLobbyId}`).fetchSockets();
      const matchingSockets = sockets.filter((socket) => socket.data.studentId === studentId);
      await Promise.all(matchingSockets.map((socket) => socket.disconnect(true)));
    }
    return res.json({ deleted: true });
  });

  return router;
}

module.exports = { createClassesRouter };
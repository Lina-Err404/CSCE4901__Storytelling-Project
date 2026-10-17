const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');

const STUDENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
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

function createClassesRouter({ db, admin, requireTeacher }) {
  const router = express.Router();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE },
  });

  async function requireClassOwner(req, res, next) {
    try {
      const classRef = db.collection('classes').doc(req.params.id);
      const classSnapshot = await classRef.get();
      if (!classSnapshot.exists || classSnapshot.data().teacherId !== req.user.uid) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      req.classRef = classRef;
      req.classData = classSnapshot.data();
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

    const classRef = await db.collection('classes').add({
      teacherId: req.user.uid,
      name,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return res.status(201).json({ classId: classRef.id, name });
  });

  router.get('/classes', requireTeacher, async (req, res) => {
    const snapshot = await db.collection('classes').where('teacherId', '==', req.user.uid).get();
    return res.json({
      classes: snapshot.docs.map((doc) => ({ classId: doc.id, ...doc.data() })),
    });
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
      const batch = db.batch();
      accepted.slice(offset, offset + BATCH_SIZE).forEach(({ studentId, displayName }) => {
        const studentRef = req.classRef.collection('roster').doc(studentId);
        batch.set(studentRef, { displayName }, { merge: true });
      });
      await batch.commit();
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

    await req.classRef.collection('roster').doc(studentId).set({ displayName });
    return res.json({ studentId, displayName });
  });

  router.get('/classes/:id/roster', requireTeacher, requireClassOwner, async (req, res) => {
    const snapshot = await req.classRef.collection('roster').get();
    return res.json({
      students: snapshot.docs.map((doc) => ({ studentId: doc.id, ...doc.data() })),
    });
  });

  router.delete('/classes/:id/roster/:studentId', requireTeacher, requireClassOwner, async (req, res) => {
    const { studentId } = req.params;
    if (!validStudentId(studentId)) {
      return res.status(400).json({ error: 'Invalid studentId' });
    }

    await req.classRef.collection('roster').doc(studentId).delete();
    return res.json({ deleted: true });
  });

  return router;
}

module.exports = { createClassesRouter };
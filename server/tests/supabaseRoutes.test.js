const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { createClassesRouter } = require('../src/supabaseClasses');
const { createLobbyRouter } = require('../src/supabaseLobby');
const { createSupabaseMock } = require('./supabaseMock');

const TEACHER_ID = '00000000-0000-4000-8000-000000000001';
const STUDENT_ID = '00000000-0000-4000-8000-000000000002';
const CLASS_ID = '00000000-0000-4000-8000-000000000003';
const JWT_SECRET = 'test-secret-that-is-long-enough-for-the-lobby-token';

function identity(role) {
  return (req, res, next) => {
    req.user = { uid: req.get('x-user-id') || TEACHER_ID, role };
    next();
  };
}

function createApp(supabase) {
  const app = express();
  app.use(express.json());
  app.use('/supabase', createClassesRouter({
    supabase,
    requireTeacher: identity('teacher'),
  }));
  app.use('/supabase', createLobbyRouter({
    supabase,
    requireTeacher: identity('teacher'),
    requireStudent: identity('student'),
    jwtSecret: JWT_SECRET,
  }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    return res.status(500).json({ error: error.message });
  });
  return app;
}

function seededSupabase() {
  return createSupabaseMock({
    profiles: [
      { id: TEACHER_ID, role: 'teacher', display_name: 'Teacher' },
      { id: STUDENT_ID, role: 'student', display_name: 'Student' },
    ],
    classes: [{ class_id: CLASS_ID, teacher_id: TEACHER_ID, class_name: 'Room 1' }],
    class_students: [{ class_id: CLASS_ID, student_id: STUDENT_ID }],
  });
}

describe('Supabase-backed class and lobby routes', () => {
  test('creates a class with the Supabase table column names', async () => {
    const supabase = seededSupabase();
    const response = await request(createApp(supabase))
      .post('/supabase/classes')
      .send({ name: 'New Class' });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe('New Class');
    expect(supabase.tables.classes.at(-1)).toMatchObject({
      teacher_id: TEACHER_ID,
      class_name: 'New Class',
    });
  });

  test('imports UUID roster records and uses profiles as the roster-name source', async () => {
    const supabase = seededSupabase();
    const response = await request(createApp(supabase))
      .post(`/supabase/classes/${CLASS_ID}/roster`)
      .attach('file', Buffer.from(`studentId,name\n${STUDENT_ID},Ada Lovelace\n`), 'roster.csv');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ imported: 1, rejected: [] });
    expect(supabase.tables.class_students).toContainEqual({
      class_id: CLASS_ID,
      student_id: STUDENT_ID,
    });
    expect(supabase.tables.profiles.find(({ id }) => id === STUDENT_ID).display_name).toBe('Ada Lovelace');
  });

  test('creates a lobby using the new schema and maps states for the existing API', async () => {
    const supabase = seededSupabase();
    const app = createApp(supabase);
    const created = await request(app)
      .post('/supabase/lobbies')
      .send({ classId: CLASS_ID });

    expect(created.status).toBe(201);
    const lobby = supabase.tables.lobbies[0];
    expect(lobby).toMatchObject({
      class_id: CLASS_ID,
      lobby_name: 'Room 1 Lobby',
      status: 'waiting',
    });

    const listed = await request(app).get(`/supabase/lobbies?classId=${CLASS_ID}`);
    expect(listed.body.lobbies[0]).toMatchObject({
      lobbyId: lobby.lobby_id,
      joinCode: lobby.join_code,
      status: 'open',
    });

    const started = await request(app)
      .patch(`/supabase/lobbies/${lobby.lobby_id}`)
      .send({ status: 'locked' });
    expect(started.status).toBe(200);
    expect(lobby.status).toBe('active');
  });

  test('enrolls a student in a lobby and records the participant row', async () => {
    const supabase = seededSupabase();
    const lobbyId = '00000000-0000-4000-8000-000000000004';
    supabase.tables.lobbies = [{
      lobby_id: lobbyId,
      class_id: CLASS_ID,
      join_code: 'ABC234',
      lobby_name: 'Room 1 Lobby',
      status: 'waiting',
    }];

    const response = await request(createApp(supabase))
      .post('/supabase/lobbies/join')
      .set('x-user-id', STUDENT_ID)
      .send({ code: 'ABC234' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ lobbyId, displayName: 'Student' });
    expect(jwt.verify(response.body.token, JWT_SECRET)).toMatchObject({
      role: 'student',
      lobbyId,
      studentId: STUDENT_ID,
    });
    expect(supabase.tables.lobby_participants).toContainEqual({
      lobby_id: lobbyId,
      student_id: STUDENT_ID,
      status: 'active',
    });

    const refreshed = await request(createApp(supabase))
      .get(`/supabase/lobbies/${lobbyId}/students`);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.students).toEqual([
      { studentId: STUDENT_ID, displayName: 'Student' },
    ]);
  });

  test('rejects a validly formatted but unknown lobby code', async () => {
    const supabase = seededSupabase();
    const response = await request(createApp(supabase))
      .post('/supabase/lobbies/join')
      .set('x-user-id', STUDENT_ID)
      .send({ code: 'ZZZZZZ' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Could not join');
    expect(supabase.tables.lobby_participants || []).toHaveLength(0);
  });

  test('rejects a student who is not enrolled in the lobby class', async () => {
    const supabase = seededSupabase();
    const lobbyId = '00000000-0000-4000-8000-000000000004';
    const outsiderId = '00000000-0000-4000-8000-000000000005';
    supabase.tables.lobbies = [{
      lobby_id: lobbyId,
      class_id: CLASS_ID,
      join_code: 'ABC234',
      lobby_name: 'Room 1 Lobby',
      status: 'waiting',
    }];

    const response = await request(createApp(supabase))
      .post('/supabase/lobbies/join')
      .set('x-user-id', outsiderId)
      .send({ code: 'ABC234' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Could not join');
    expect(supabase.tables.lobby_participants || []).toHaveLength(0);
  });
});

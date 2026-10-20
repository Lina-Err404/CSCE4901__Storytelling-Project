const jwt = require('jsonwebtoken');
const request = require('supertest');
const {
  db,
  JWT_SECRET,
  clearFirestore,
  seedClass,
  seedRoster,
  seedLobby,
  startTestServer,
  deleteFirebaseApp,
} = require('./helpers');
const { createLobbyRouter } = require('../src/lobby');
const requireTeacher = (req, res, next) => next();

let testServer;
let classId;

beforeAll(async () => {
  testServer = await startTestServer();
});

beforeEach(async () => {
  await clearFirestore();
  classId = await seedClass();
});

afterAll(async () => {
  await testServer.stop();
  await deleteFirebaseApp();
});

function teacherRequest(method, path, teacherId = 'teacher-one') {
  return request(testServer.app)[method](path).set('x-teacher-id', teacherId);
}

async function createLobby(overrides = {}) {
  return teacherRequest('post', '/lobbies').send({ classId, ...overrides });
}

async function join(code = 'ABC234', studentId = 'student-one') {
  return request(testServer.app)
    .post('/lobbies/join')
    .set('x-test-student-uid', studentId)
    .send({ code, studentId, name: 'Typed Name' });
}

describe('lobby routes', () => {
  test('creates one open lobby per class and permits a new one after close', async () => {
    const first = await createLobby();
    const second = await createLobby();

    expect(first.status).toBe(201);
    expect(first.body.joinCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(second.status).toBe(409);
    expect(second.body).toMatchObject({ error: 'Class already has an active lobby' });

    await teacherRequest('patch', `/lobbies/${first.body.lobbyId}`).send({ status: 'closed' });
    const reopened = await createLobby();
    expect(reopened.status).toBe(201);
    expect(reopened.body.joinCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    expect(reopened.body.joinCode).not.toBe(first.body.joinCode);
  });

  test('returns 403 when creating a lobby for a class owned by another teacher', async () => {
    await seedClass({ classId: 'other-class', teacherId: 'teacher-two' });
    const response = await createLobby({ classId: 'other-class' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Forbidden' });
  });

  test.each([
    { minWords: -1, maxWords: 10 },
    { minWords: 11, maxWords: 10 },
    { minWords: 0, maxWords: 1001 },
    { minWords: 1.5, maxWords: 10 },
  ])('rejects invalid word limits with 400: %j', async (limits) => {
    const response = await createLobby(limits);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid word limits' });
  });

  test('factory rejects a missing or short JWT secret', () => {
    expect(() => createLobbyRouter({
      db,
      admin: {},
      requireTeacher,
      jwtSecret: 'too-short',
      getIo: () => undefined,
    })).toThrow('jwtSecret must be at least 32 characters');
  });

  test('joins a rostered student using the roster display name and returns a verifiable token', async () => {
    await seedLobby();
    await seedRoster(classId, [{ studentId: 'student-one', displayName: 'Roster Name' }]);
    const response = await join();

    expect(response.status).toBe(200);
    expect(response.body.displayName).toBe('Roster Name');
    expect(response.body.lobbyId).toBe('lobby-one');
    expect(jwt.verify(response.body.token, JWT_SECRET, { algorithms: ['HS256'] })).toMatchObject({
      role: 'student',
      lobbyId: 'lobby-one',
      studentId: 'student-one',
    });
    const seat = await db.collection('lobbies').doc('lobby-one').collection('students').doc('student-one').get();
    expect(seat.data()).toMatchObject({ displayName: 'Roster Name', kicked: false });
  });

  test('rejects missing student authentication even when the body claims a roster ID', async () => {
    await seedLobby();
    await seedRoster(classId, [{ studentId: 'student-one', displayName: 'Roster Name' }]);

    const response = await request(testServer.app)
      .post('/lobbies/join')
      .send({ code: 'ABC234', studentId: 'student-one', name: 'Claimed Name' });

    expect(response.status).toBe(401);
  });

  test('ignores a body student ID that differs from the authenticated UID', async () => {
    await seedLobby();
    await seedRoster(classId, [{ studentId: 'student-one', displayName: 'Roster Name' }]);

    const response = await request(testServer.app)
      .post('/lobbies/join')
      .set('x-test-student-uid', 'unrostered-user')
      .send({ code: 'ABC234', studentId: 'student-one', name: 'Claimed Name' });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Could not join' });
  });

  test.each([
    ['wrong code', async () => {}],
    ['code references a nonexistent lobby', async () => {
      await db.collection('lobbyCodes').doc('ABC234').set({ lobbyId: 'missing-lobby' });
    }],
    ['student not on roster', async () => {}],
    ['student rostered only in another class', async () => {
      await seedClass({ classId: 'other-class', teacherId: 'teacher-one' });
      await seedRoster('other-class', [{ studentId: 'student-one', displayName: 'Other Class' }]);
    }],
    ['malformed student ID', async () => {}],
    ['locked lobby', async () => {}],
    ['closed lobby', async () => {}],
    ['kicked student', async () => {
      await seedRoster(classId, [{ studentId: 'student-one', displayName: 'Roster Name' }]);
      await db.collection('lobbies').doc('lobby-one').collection('students').doc('student-one').set({ kicked: true });
    }],
  ])('returns the identical generic failure for %s', async (reason, prepare) => {
    const status = reason === 'locked lobby' ? 'locked' : reason === 'closed lobby' ? 'closed' : 'open';
    await seedLobby({ status });
    if (status === 'closed') {
      await db.collection('lobbyCodes').doc('ABC234').set({ lobbyId: 'lobby-one' });
    }
    await prepare();

    const code = reason === 'wrong code' ? 'ZZZZZZ' : 'ABC234';
    const studentId = reason === 'malformed student ID' ? 'a/b' : 'student-one';
    const response = await join(code, studentId);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Could not join' });
  });

  test('rejoining upserts one seat instead of creating duplicates', async () => {
    await seedLobby();
    await seedRoster(classId, [{ studentId: 'student-one', displayName: 'Roster Name' }]);

    const responses = await Promise.all([join(), join()]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const seats = await db.collection('lobbies').doc('lobby-one').collection('students').get();
    expect(seats.size).toBe(1);
  });

  test('returns 403 for non-owner patch, kick, and list requests', async () => {
    await seedLobby();
    const responses = await Promise.all([
      teacherRequest('patch', '/lobbies/lobby-one', 'teacher-two').send({ status: 'locked' }),
      teacherRequest('delete', '/lobbies/lobby-one/students/student-one', 'teacher-two'),
      teacherRequest('get', '/lobbies/lobby-one/students', 'teacher-two'),
    ]);

    for (const response of responses) {
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Forbidden' });
    }
  });

  test('closing removes the join-code document and cannot be repeated', async () => {
    await seedLobby();
    const response = await teacherRequest('patch', '/lobbies/lobby-one').send({ status: 'closed' });

    expect(response.status).toBe(200);
    expect((await db.collection('lobbyCodes').doc('ABC234').get()).exists).toBe(false);
    const repeated = await teacherRequest('patch', '/lobbies/lobby-one').send({ status: 'open' });
    expect(repeated.status).toBe(409);
    expect(repeated.body).toEqual({ error: 'Lobby is closed' });
  });

  test('lists only non-kicked students', async () => {
    await seedLobby();
    await db.collection('lobbies').doc('lobby-one').collection('students').doc('active').set({ displayName: 'Active', kicked: false });
    await db.collection('lobbies').doc('lobby-one').collection('students').doc('removed').set({ displayName: 'Removed', kicked: true });
    const response = await teacherRequest('get', '/lobbies/lobby-one/students');

    expect(response.status).toBe(200);
    expect(response.body.students.map((student) => student.studentId)).toEqual(['active']);
  });

  test('a student removed from the roster cannot newly join', async () => {
    await seedLobby();
    await seedRoster(classId, [{ studentId: 'student-one', displayName: 'Roster Name' }]);
    await db.collection('classes').doc(classId).collection('roster').doc('student-one').delete();

    const response = await join();
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Could not join' });
  });
});
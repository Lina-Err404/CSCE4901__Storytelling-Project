const request = require('supertest');
const {
  db,
  clearFirestore,
  seedClass,
  seedLobby,
  startTestServer,
  deleteFirebaseApp,
} = require('./helpers');

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

describe('class roster routes', () => {
  test('imports valid CSV and upserts roster entries', async () => {
    const response = await teacherRequest('post', `/classes/${classId}/roster`)
      .attach('file', Buffer.from('\uFEFFStudentId, Name\ns-1, Ada\ns-2, Grace\n'), 'roster.csv');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ imported: 2, rejected: [] });
    const roster = await db.collection('classes').doc(classId).collection('roster').get();
    expect((await db.collection('classes').doc(classId).get()).data().studentIds).toEqual(['s-1', 's-2']);
    expect(roster.docs.map((doc) => [doc.id, doc.data().displayName])).toEqual([
      ['s-1', 'Ada'],
      ['s-2', 'Grace'],
    ]);
  });

  test('rejects a wrong CSV header with 400', async () => {
    const response = await teacherRequest('post', `/classes/${classId}/roster`)
      .attach('file', Buffer.from('id,display name\ns-1,Ada\n'), 'roster.csv');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'CSV header must be studentId,name' });
  });

  test('reports duplicate IDs and path-injection IDs as rejected rows', async () => {
    const response = await teacherRequest('post', `/classes/${classId}/roster`)
      .attach('file', Buffer.from('studentId,name\ns-1,Ada\ns-1,Duplicate\na/b,Invalid\n'), 'roster.csv');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      imported: 1,
      rejected: [
        { row: 3, reason: 'Duplicate studentId' },
        { row: 4, reason: 'Invalid studentId' },
      ],
    });
    expect((await db.collection('classes').doc(classId).collection('roster').get()).size).toBe(1);
  });

  test('rejects 501 data rows with 400', async () => {
    const csv = `studentId,name\n${Array.from({ length: 501 }, (_, i) => `student-${i},Student ${i}`).join('\n')}`;
    const response = await teacherRequest('post', `/classes/${classId}/roster`)
      .attach('file', Buffer.from(csv), 'roster.csv');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Maximum 500 rows' });
  });

  test('rejects an upload larger than 1 MB with 413', async () => {
    const response = await teacherRequest('post', `/classes/${classId}/roster`)
      .attach('file', Buffer.alloc(1024 * 1024 + 1, 'x'), 'roster.csv');

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: 'File too large' });
  });

  test('returns 403 for non-owners on every class-id route', async () => {
    const routes = [
      () => teacherRequest('post', `/classes/${classId}/roster`, 'teacher-two')
        .attach('file', Buffer.from('studentId,name\ns-1,Ada\n'), 'roster.csv'),
      () => teacherRequest('put', `/classes/${classId}/roster/s-1`, 'teacher-two').send({ name: 'Ada' }),
      () => teacherRequest('get', `/classes/${classId}/roster`, 'teacher-two'),
      () => teacherRequest('delete', `/classes/${classId}/roster/s-1`, 'teacher-two'),
    ];

    for (const run of routes) {
      const response = await run();
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Forbidden' });
    }
  });

  test('removing a roster entry revokes the student seat in the active lobby', async () => {
    await teacherRequest('put', `/classes/${classId}/roster/student-one`)
      .send({ name: 'Roster Student' });
    await seedLobby({ classId });
    await db.collection('classes').doc(classId).update({ activeLobbyId: 'lobby-one' });
    const seatRef = db.collection('lobbies').doc('lobby-one').collection('students').doc('student-one');
    await seatRef.set({ displayName: 'Roster Student', kicked: false });
    expect((await db.collection('classes').doc(classId).get()).data().activeLobbyId).toBe('lobby-one');
    expect((await db.collection('lobbies').doc('lobby-one').get()).data().status).toBe('open');
    expect((await seatRef.get()).data().kicked).toBe(false);

    const response = await teacherRequest('delete', `/classes/${classId}/roster/student-one`);

    expect(response.status).toBe(200);
    expect((await seatRef.get()).data().kicked).toBe(true);
    expect((await db.collection('classes').doc(classId).collection('roster').doc('student-one').get()).exists).toBe(false);
    expect((await db.collection('classes').doc(classId).get()).data().studentIds).not.toContain('student-one');
  });
});
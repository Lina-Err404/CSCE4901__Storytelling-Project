const jwt = require('jsonwebtoken');
const { io: createClient } = require('socket.io-client');
const request = require('supertest');
const {
  JWT_SECRET,
  clearFirestore,
  seedClass,
  seedRoster,
  seedLobby,
  startTestServer,
  deleteFirebaseApp,
  db,
} = require('./helpers');

let testServer;

beforeAll(async () => {
  testServer = await startTestServer();
});

beforeEach(async () => {
  await clearFirestore();
  await seedClass();
  await seedLobby();
  await seedRoster('class-one', [{ studentId: 'student-one', displayName: 'Roster Name' }]);
  await db.collection('lobbies').doc('lobby-one').collection('students').doc('student-one').set({
    displayName: 'Roster Name',
    kicked: false,
  });
});

afterAll(async () => {
  await testServer.stop();
  await deleteFirebaseApp();
});

function token(secret = JWT_SECRET, options = {}) {
  return jwt.sign({ role: 'student', lobbyId: 'lobby-one', studentId: 'student-one' }, secret, options);
}

function connect(tokenValue, auth = tokenValue === undefined ? {} : { token: tokenValue }) {
  return createClient(testServer.url, {
    auth,
    transports: ['websocket'],
    reconnection: false,
    timeout: 3000,
  });
}

function rejectedConnection(client) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.close();
      reject(new Error('Socket connection did not fail'));
    }, 4000);
    client.once('connect', () => {
      clearTimeout(timeout);
      client.close();
      reject(new Error('Socket connection unexpectedly succeeded'));
    });
    client.once('connect_error', (error) => {
      clearTimeout(timeout);
      client.close();
      resolve(error);
    });
  });
}

describe('Socket.io authentication', () => {
  test('accepts a valid token, sets trusted socket data, and joins its token lobby room', async () => {
    const client = connect(token());
    await new Promise((resolve, reject) => {
      client.once('connect', resolve);
      client.once('connect_error', reject);
    });

    const sockets = await testServer.io.in('lobby:lobby-one').fetchSockets();
    expect(sockets).toHaveLength(1);
    expect(sockets[0].data).toEqual({
      role: 'student',
      lobbyId: 'lobby-one',
      studentId: 'student-one',
    });
    client.close();
  });

  test.each([
    ['missing', undefined],
    ['malformed', 'not-a-jwt'],
    ['expired', () => token(JWT_SECRET, { expiresIn: -1 })],
    ['wrong-secret', () => token('a-different-secret-that-is-also-long-enough')],
    ['none-algorithm', () => jwt.sign(
      { role: 'student', lobbyId: 'lobby-one', studentId: 'student-one' },
      null,
      { algorithm: 'none' },
    )],
  ])('rejects a %s token with only the generic error', async (label, value) => {
    const suppliedToken = typeof value === 'function' ? value() : value;
    const error = await rejectedConnection(connect(suppliedToken));
    expect(error.message).toBe('unauthorized');
  });

  test('rejects a token after its seat is kicked', async () => {
    await db.collection('lobbies').doc('lobby-one').collection('students').doc('student-one').update({ kicked: true });
    const error = await rejectedConnection(connect(token()));

    expect(error.message).toBe('unauthorized');
  });

  test('rejects a token after the lobby closes', async () => {
    await db.collection('lobbies').doc('lobby-one').update({ status: 'closed' });
    const error = await rejectedConnection(connect(token()));

    expect(error.message).toBe('unauthorized');
  });

  test('a teacher kick disconnects the live student socket', async () => {
    const client = connect(token());
    await new Promise((resolve, reject) => {
      client.once('connect', resolve);
      client.once('connect_error', reject);
    });
    const disconnected = new Promise((resolve) => client.once('disconnect', resolve));
    const response = await request(testServer.app)
      .delete('/lobbies/lobby-one/students/student-one')
      .set('x-teacher-id', 'teacher-one');

    expect(response.status).toBe(200);
    expect(await disconnected).toBe('io server disconnect');
    client.close();
  });
});
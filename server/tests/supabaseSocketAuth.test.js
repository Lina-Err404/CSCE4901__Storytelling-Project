const jwt = require('jsonwebtoken');
const { createSocketAuth } = require('../src/supabaseSocketAuth');

const SECRET = 'a-test-secret-long-enough-to-satisfy-the-minimum';
const LOBBY_ID = '00000000-0000-4000-8000-000000000001';
const STUDENT_ID = '00000000-0000-4000-8000-000000000002';

function createSupabase(status = 'waiting', participantStatus = 'active') {
  let relation;
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    maybeSingle: jest.fn(async () => ({
      data: relation === 'lobbies' ? { status } : { status: participantStatus },
      error: null,
    })),
  };
  return {
    from: jest.fn((table) => {
      relation = table;
      return query;
    }),
  };
}

function createSocket(token) {
  return {
    handshake: { auth: token ? { token } : {} },
    data: {},
    join: jest.fn(),
  };
}

describe('Socket.IO participant authorization', () => {
  test('verifies a valid seat and joins its lobby room', async () => {
    const supabase = createSupabase();
    const socket = createSocket(jwt.sign({
      role: 'student',
      lobbyId: LOBBY_ID,
      studentId: STUDENT_ID,
    }, SECRET));
    const next = jest.fn();

    await createSocketAuth({ supabase, jwtSecret: SECRET })(socket, next);

    expect(socket.data).toEqual({ role: 'student', lobbyId: LOBBY_ID, studentId: STUDENT_ID });
    expect(socket.join).toHaveBeenCalledWith(`lobby:${LOBBY_ID}`);
    expect(next).toHaveBeenCalledWith();
  });

  test('rejects a revoked seat', async () => {
    const socket = createSocket(jwt.sign({
      role: 'student',
      lobbyId: LOBBY_ID,
      studentId: STUDENT_ID,
    }, SECRET));
    const next = jest.fn();

    await createSocketAuth({
      supabase: createSupabase('waiting', 'kicked'),
      jwtSecret: SECRET,
    })(socket, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'unauthorized' }));
  });

  test('rejects missing credentials', async () => {
    const next = jest.fn();
    await createSocketAuth({ supabase: createSupabase(), jwtSecret: SECRET })(createSocket(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'unauthorized' }));
  });
});

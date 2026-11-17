const express = require('express');
const request = require('supertest');
const {
  createSupabaseSocketAuth,
  createRequireStudent,
  createRequireTeacher,
} = require('../src/auth');

function createApp(middleware) {
  const app = express();
  app.get('/identity', middleware, (req, res) => res.json({ user: req.user }));
  return app;
}

function createSupabaseMock({ user, profile, authError } = {}) {
  const getUser = jest.fn().mockResolvedValue({
    data: { user: user || null },
    error: authError || null,
  });
  const maybeSingle = jest.fn().mockResolvedValue({ data: profile || null, error: null });
  const client = {
    auth: { getUser },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({ maybeSingle })),
      })),
    })),
  };
  return { client, getUser, maybeSingle };
}

describe('Supabase authentication middleware', () => {
  test('rejects missing bearer credentials without trusting identity headers', async () => {
    const { client, getUser } = createSupabaseMock();
    const app = createApp(createRequireTeacher(client));

    const response = await request(app)
      .get('/identity')
      .set('x-teacher-id', 'claimed-teacher');

    expect(response.status).toBe(401);
    expect(getUser).not.toHaveBeenCalled();
  });

  test('rejects invalid access tokens', async () => {
    const { client } = createSupabaseMock({ authError: new Error('Invalid token') });
    const app = createApp(createRequireTeacher(client));

    const response = await request(app)
      .get('/identity')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
  });

  test('requires the verified teacher role and uses the verified user ID', async () => {
    const { client, getUser } = createSupabaseMock({
      user: { id: 'verified-teacher', app_metadata: { role: 'teacher' } },
    });
    const app = createApp(createRequireTeacher(client));

    const response = await request(app)
      .get('/identity')
      .set('Authorization', 'Bearer valid-token')
      .set('x-teacher-id', 'different-teacher');

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({ uid: 'verified-teacher', role: 'teacher' });
    expect(getUser).toHaveBeenCalledWith('valid-token');
  });

  test('does not trust user-editable metadata to grant teacher access', async () => {
    const { client } = createSupabaseMock({
      user: { id: 'student-user', user_metadata: { role: 'teacher' } },
      profile: { role: 'student' },
    });
    const app = createApp(createRequireTeacher(client));

    const response = await request(app)
      .get('/identity')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(403);
  });

  test('loads the teacher role from the Supabase profile', async () => {
    const { client } = createSupabaseMock({
      user: { id: 'verified-teacher', app_metadata: {} },
      profile: { role: 'teacher' },
    });
    const app = createApp(createRequireTeacher(client));

    const response = await request(app)
      .get('/identity')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({ uid: 'verified-teacher', role: 'teacher' });
  });

  test('student middleware accepts an authenticated user without an assigned role', async () => {
    const { client } = createSupabaseMock({ user: { id: 'student-user', app_metadata: {} } });
    const app = createApp(createRequireStudent(client));

    const response = await request(app)
      .get('/identity')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({ uid: 'student-user', role: null });
  });

  test('student middleware rejects a teacher account', async () => {
    const { client } = createSupabaseMock({
      user: { id: 'teacher-user', app_metadata: { role: 'teacher' } },
    });
    const app = createApp(createRequireStudent(client));

    const response = await request(app)
      .get('/identity')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(403);
  });

  test('Socket.IO auth verifies the access token and stores trusted identity', async () => {
    const { client, getUser } = createSupabaseMock({
      user: { id: 'verified-student', app_metadata: { role: 'student' } },
    });
    const middleware = createSupabaseSocketAuth(client);
    const socket = { handshake: { auth: { token: 'socket-access-token' } }, data: {} };
    const next = jest.fn();

    await middleware(socket, next);

    expect(getUser).toHaveBeenCalledWith('socket-access-token');
    expect(socket.data).toEqual({ uid: 'verified-student', role: 'student' });
    expect(next).toHaveBeenCalledWith();
  });

  test('Socket.IO auth rejects a missing access token', async () => {
    const { client, getUser } = createSupabaseMock();
    const middleware = createSupabaseSocketAuth(client);
    const socket = { handshake: { auth: {} }, data: {} };
    const next = jest.fn();

    await middleware(socket, next);

    expect(getUser).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'unauthorized' }));
  });
});

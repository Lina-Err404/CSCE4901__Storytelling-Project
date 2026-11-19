const express = require('express');
const request = require('supertest');
const { createFirebaseSocketAuth, createRequireStudent, createRequireTeacher } = require('../src/auth');

function createApp(middleware) {
  const app = express();
  app.get('/identity', middleware, (req, res) => res.json({ user: req.user }));
  return app;
}

describe('Firebase authentication middleware', () => {
  test('rejects missing bearer credentials without trusting identity headers', async () => {
    const verifyIdToken = jest.fn();
    const app = createApp(createRequireTeacher({ auth: () => ({ verifyIdToken }) }));

    const response = await request(app)
      .get('/identity')
      .set('x-teacher-id', 'claimed-teacher');

    expect(response.status).toBe(401);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  test('rejects invalid ID tokens', async () => {
    const verifyIdToken = jest.fn().mockRejectedValue(new Error('Invalid token'));
    const app = createApp(createRequireTeacher({ auth: () => ({ verifyIdToken }) }));

    const response = await request(app)
      .get('/identity')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
  });

  test('requires the verified teacher role and uses the verified UID', async () => {
    const verifyIdToken = jest.fn().mockResolvedValue({ uid: 'verified-teacher', role: 'teacher' });
    const app = createApp(createRequireTeacher({ auth: () => ({ verifyIdToken }) }));

    const response = await request(app)
      .get('/identity')
      .set('Authorization', 'Bearer valid-token')
      .set('x-teacher-id', 'different-teacher');

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({ uid: 'verified-teacher', role: 'teacher' });
    expect(verifyIdToken).toHaveBeenCalledWith('valid-token');
  });

  test('rejects valid Firebase users without the teacher custom claim', async () => {
    const verifyIdToken = jest.fn().mockResolvedValue({ uid: 'student-user', role: 'student' });
    const app = createApp(createRequireTeacher({ auth: () => ({ verifyIdToken }) }));

    const response = await request(app)
      .get('/identity')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(403);
  });

  test('student middleware accepts an authenticated Firebase UID', async () => {
    const verifyIdToken = jest.fn().mockResolvedValue({ uid: 'student-user' });
    const app = createApp(createRequireStudent({ auth: () => ({ verifyIdToken }) }));

    const response = await request(app)
      .get('/identity')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({ uid: 'student-user', role: null });
  });

  test('student middleware rejects a teacher account', async () => {
    const verifyIdToken = jest.fn().mockResolvedValue({ uid: 'teacher-user', role: 'teacher' });
    const app = createApp(createRequireStudent({ auth: () => ({ verifyIdToken }) }));

    const response = await request(app)
      .get('/identity')
      .set('Authorization', 'Bearer valid-token');

    expect(response.status).toBe(403);
  });

  test('Socket.IO auth verifies handshake.auth.token and stores verified identity', async () => {
    const verifyIdToken = jest.fn().mockResolvedValue({ uid: 'verified-student', role: 'student' });
    const middleware = createFirebaseSocketAuth({ auth: () => ({ verifyIdToken }) });
    const socket = { handshake: { auth: { token: 'socket-id-token' } }, data: {} };
    const next = jest.fn();

    await middleware(socket, next);

    expect(verifyIdToken).toHaveBeenCalledWith('socket-id-token');
    expect(socket.data).toEqual({ uid: 'verified-student', role: 'student' });
    expect(next).toHaveBeenCalledWith();
  });

  test('Socket.IO auth rejects a missing or invalid ID token', async () => {
    const verifyIdToken = jest.fn().mockRejectedValue(new Error('Invalid token'));
    const middleware = createFirebaseSocketAuth({ auth: () => ({ verifyIdToken }) });
    const socket = { handshake: { auth: {} }, data: {} };
    const next = jest.fn();

    await middleware(socket, next);

    expect(verifyIdToken).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'unauthorized' }));
  });
});
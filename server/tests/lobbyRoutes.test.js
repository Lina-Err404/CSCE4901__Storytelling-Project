const express = require('express');
const request = require('supertest');
const { createLobbyRoutes } = require('../src/lobbyRoutes');

function identity(role) {
  return (req, res, next) => {
    req.user = { uid: 'verified-user', role };
    return next();
  };
}

function createApp(service) {
  const app = express();
  app.use(express.json());
  app.use('/api', createLobbyRoutes({
    requireTeacher: identity('teacher'),
    requireStudent: identity('student'),
    ...service,
  }));
  return app;
}

describe('R13 lobby API routes', () => {
  test('POST /api/lobbies passes the verified teacher UID and classId', async () => {
    const createLobby = jest.fn().mockResolvedValue('C3D4EF');
    const response = await request(createApp({ createLobby }))
      .post('/api/lobbies')
      .send({ classId: 'class-1', teacherId: 'body-spoof' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ code: 'C3D4EF' });
    expect(createLobby).toHaveBeenCalledWith('verified-user', 'class-1');
  });

  test('POST /api/lobbies/:code/join passes only the verified student UID', async () => {
    const joinLobby = jest.fn().mockResolvedValue({ code: 'C3D4EF', playerCount: 1, alreadyJoined: false });
    const response = await request(createApp({ joinLobby }))
      .post('/api/lobbies/C3D4EF/join')
      .send({ studentId: 'body-spoof' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ code: 'C3D4EF', playerCount: 1, alreadyJoined: false });
    expect(joinLobby).toHaveBeenCalledWith('verified-user', 'C3D4EF');
  });

  test('serializes service errors using their status and message', async () => {
    const joinLobby = jest.fn().mockRejectedValue(Object.assign(new Error('not enrolled'), { status: 403 }));
    const response = await request(createApp({ joinLobby })).post('/api/lobbies/C3D4EF/join');

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'not enrolled' });
  });
});
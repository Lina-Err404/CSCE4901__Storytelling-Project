const express = require('express');
const request = require('supertest');
const { createRequireSupabaseStudent } = require('../src/supabaseAuth');

function createApp(getSupabase) {
  const app = express();
  app.get('/identity', createRequireSupabaseStudent({ getSupabase }), (req, res) => (
    res.json({ uid: req.user.uid })
  ));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    return res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}

describe('Supabase story authentication', () => {
  test('verifies a bearer token with Supabase Auth and uses its user ID', async () => {
    const getUser = jest.fn().mockResolvedValue({
      data: { user: { id: '00000000-0000-4000-8000-000000000001' } },
      error: null,
    });
    const app = createApp(() => ({ auth: { getUser } }));
    const response = await request(app)
      .get('/identity')
      .set('Authorization', 'Bearer supabase-access-token');

    expect(response.status).toBe(200);
    expect(response.body.uid).toBe('00000000-0000-4000-8000-000000000001');
    expect(getUser).toHaveBeenCalledWith('supabase-access-token');
  });

  test('rejects missing and invalid bearer tokens', async () => {
    const getUser = jest.fn().mockResolvedValue({
      data: { user: null },
      error: { status: 401 },
    });
    const app = createApp(() => ({ auth: { getUser } }));

    expect((await request(app).get('/identity')).status).toBe(401);
    expect(getUser).not.toHaveBeenCalled();

    const invalid = await request(app)
      .get('/identity')
      .set('Authorization', 'Bearer invalid-token');
    expect(invalid.status).toBe(401);
  });

  test('passes Supabase Auth service errors to the API error handler', async () => {
    const getUser = jest.fn().mockResolvedValue({
      data: { user: null },
      error: { status: 503 },
    });
    const app = createApp(() => ({ auth: { getUser } }));
    const response = await request(app)
      .get('/identity')
      .set('Authorization', 'Bearer supabase-access-token');

    expect(response.status).toBe(500);
  });
});

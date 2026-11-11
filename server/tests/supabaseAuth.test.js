const express = require('express');
const request = require('supertest');
const {
  createRequireStudent,
  createRequireTeacher,
  createRequireUser,
} = require('../src/supabaseAuth');

function createSupabase({ user, profile, profileError, profileInitiallyMissing = false } = {}) {
  let profileRead = 0;
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    maybeSingle: jest.fn().mockImplementation(() => {
      profileRead += 1;
      return Promise.resolve({
        data: profileInitiallyMissing && profileRead === 1 ? null : profile ?? null,
        error: profileError ?? null,
      });
    }),
    upsert: jest.fn(() => query),
    single: jest.fn().mockResolvedValue({ data: profile, error: profileError ?? null }),
  };
  return {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: user ?? { id: '00000000-0000-4000-8000-000000000001', email: 'student@example.com' } },
        error: null,
      }),
    },
    from: jest.fn(() => query),
    query,
  };
}

function createApp(middleware) {
  const app = express();
  app.get('/identity', middleware, (req, res) => res.json({ user: req.user }));
  return app;
}

describe('Supabase authentication middleware', () => {
  test('rejects missing bearer credentials', async () => {
    const supabase = createSupabase();
    const response = await request(createApp(createRequireTeacher(supabase))).get('/identity');

    expect(response.status).toBe(401);
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
  });

  test('uses the verified Supabase user and profile role', async () => {
    const supabase = createSupabase({
      profile: { role: 'teacher', display_name: 'Teacher' },
    });
    const response = await request(createApp(createRequireTeacher(supabase)))
      .get('/identity')
      .set('Authorization', 'Bearer verified-access-token');

    expect(response.status).toBe(200);
    expect(response.body.user).toEqual({
      uid: '00000000-0000-4000-8000-000000000001',
      role: 'teacher',
      displayName: 'Teacher',
    });
    expect(supabase.auth.getUser).toHaveBeenCalledWith('verified-access-token');
  });

  test('prevents students from using teacher routes', async () => {
    const supabase = createSupabase({
      profile: { role: 'student', display_name: 'Student' },
    });
    const response = await request(createApp(createRequireTeacher(supabase)))
      .get('/identity')
      .set('Authorization', 'Bearer student-token');

    expect(response.status).toBe(403);
  });

  test('creates a missing profile with the student default role', async () => {
    const supabase = createSupabase({
      user: {
        id: '00000000-0000-4000-8000-000000000002',
        email: 'new.student@example.com',
        user_metadata: { display_name: 'New Student' },
      },
      profile: { role: 'student', display_name: 'New Student' },
      profileInitiallyMissing: true,
    });
    const response = await request(createApp(createRequireStudent(supabase)))
      .get('/identity')
      .set('Authorization', 'Bearer new-user-token');

    expect(response.status).toBe(200);
    expect(supabase.query.upsert).toHaveBeenCalledWith(
      {
        id: '00000000-0000-4000-8000-000000000002',
        display_name: 'New Student',
        role: 'student',
      },
      { onConflict: 'id', ignoreDuplicates: true },
    );
  });

  test('the general profile route permits both valid roles', async () => {
    const supabase = createSupabase({
      profile: { role: 'student', display_name: 'Student' },
    });
    const response = await request(createApp(createRequireUser(supabase)))
      .get('/identity')
      .set('Authorization', 'Bearer student-token');

    expect(response.status).toBe(200);
  });
});


const request = require('supertest');
const express = require('express');
const { createReactionsRouter, VALID_REACTIONS } = require('../src/reactionsRoutes');

describe('R6/R7 Reactions API', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    // Fake authentication for testing
    const requireStudent = (req, res, next) => {
      req.user = {
        uid: 'student-123',
        role: 'student',
      };
      next();
    };

    const supabase = {
      from: jest.fn(),
    };

    app.use('/reactions', createReactionsRouter({
      supabase,
      requireStudent,
    }));
  });

  test('supports all 18 valid reactions', () => {
    expect(VALID_REACTIONS.size).toBe(18);
    expect(VALID_REACTIONS.has('heart')).toBe(true);
    expect(VALID_REACTIONS.has('fire')).toBe(true);
    expect(VALID_REACTIONS.has('invalid')).toBe(false);
  });

  test('GET rejects an invalid segment ID', async () => {
    const response = await request(app)
      .get('/reactions?segmentId=invalid');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Valid segmentId is required');
  });

  test('POST rejects a different student ID', async () => {
    const response = await request(app)
      .post('/reactions')
      .send({
        segmentId: 'invalid',
        studentId: 'another-student',
        reactionType: 'heart',
      });

    expect(response.status).toBe(403);
  });

  test('POST rejects an invalid reaction type', async () => {
    const response = await request(app)
      .post('/reactions')
      .send({
        segmentId: '123e4567-e89b-42d3-a456-426614174000',
        studentId: 'student-123',
        reactionType: 'not-a-reaction',
      });

    expect(response.status).toBe(400);
  });


  test('GET returns reaction counts for a segment', async () => {
    const segmentId = '123e4567-e89b-42d3-a456-426614174000';

    const supabase = {
      from: jest.fn((table) => {
        if (table === 'story_segments') {
          const query = {
            select: jest.fn(() => query),
            eq: jest.fn(() => query),
            maybeSingle: jest.fn(async () => ({
              data: {
                segment_id: segmentId,
                story_id: 'story-123',
              },
              error: null,
            })),
          };
          return query;
        }

        if (table === 'stories') {
          const query = {
            select: jest.fn(() => query),
            eq: jest.fn(() => query),
            maybeSingle: jest.fn(async () => ({
              data: { class_id: 'class-123' },
              error: null,
            })),
          };
          return query;
        }

        if (table === 'class_students') {
          const query = {
            select: jest.fn(() => query),
            eq: jest.fn(() => query),
            maybeSingle: jest.fn(async () => ({
              data: { student_id: 'student-123' },
              error: null,
            })),
          };
          return query;
        }

        if (table === 'segment_reactions') {
          const query = {
            select: jest.fn(() => query),
            eq: jest.fn(() => Promise.resolve({
              data: [
                { student_id: 'student-1', reaction_type: 'heart' },
                { student_id: 'student-2', reaction_type: 'heart' },
                { student_id: 'student-3', reaction_type: 'fire' },
              ],
              error: null,
            })),
          };
          return query;
        }
      }),
    };

    const testApp = express();
    testApp.use(express.json());
    testApp.use('/reactions', createReactionsRouter({
      supabase,
      requireStudent: (req, res, next) => {
        req.user = { uid: 'student-123', role: 'student' };
        next();
      },
    }));

    const response = await request(testApp)
      .get(`/reactions?segmentId=${segmentId}`);

    expect(response.status).toBe(200);
    expect(response.body.counts).toEqual({
      heart: 2,
      fire: 1,
    });
    expect(response.body.reactions).toHaveLength(3);
  });



  test('POST saves, changes, and removes a reaction', async () => {
    const segmentId = '123e4567-e89b-42d3-a456-426614174000';
    const studentId = '223e4567-e89b-42d3-a456-426614174000';
    const saved = new Map();

    const supabase = {
      from: jest.fn((table) => {
        const filters = {};

        const query = {
          select: jest.fn(() => query),
          eq: jest.fn((column, value) => {
            filters[column] = value;
            return query;
          }),
          maybeSingle: jest.fn(async () => {
            if (table === 'story_segments') {
              return {
                data: {
                  segment_id: segmentId,
                  story_id: 'story-123',
                  student_id: 'different-author',
                },
                error: null,
              };
            }
            if (table === 'stories') {
              return { data: { class_id: 'class-123' }, error: null };
            }
            if (table === 'class_students') {
              return { data: { student_id: studentId }, error: null };
            }
            return { data: null, error: null };
          }),
          upsert: jest.fn(async (row) => {
            saved.set(row.student_id, row.reaction_type);
            return { error: null };
          }),
          delete: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(async () => {
                saved.delete(studentId);
                return { error: null };
              }),
            })),
          })),
        };

        return query;
      }),
    };

    const testApp = express();
    testApp.use(express.json());
    testApp.use('/reactions', createReactionsRouter({
      supabase,
      requireStudent: (req, res, next) => {
        req.user = { uid: studentId, role: 'student' };
        next();
      },
    }));

    const sendReaction = (reactionType) =>
      request(testApp)
        .post('/reactions')
        .send({ segmentId, studentId, reactionType });

    const added = await sendReaction('heart');
    expect(added.status).toBe(200);
    expect(saved.get(studentId)).toBe('heart');

    const changed = await sendReaction('fire');
    expect(changed.status).toBe(200);
    expect(saved.get(studentId)).toBe('fire');
    expect(saved.size).toBe(1);

    const removed = await sendReaction(null);
    expect(removed.status).toBe(200);
    expect(saved.has(studentId)).toBe(false);
  });



  test('POST blocks students from reacting to their own segment', async () => {
    const studentId = '123e4567-e89b-42d3-a456-426614174000';
    const segmentId = '223e4567-e89b-42d3-a456-426614174000';

    const supabase = {
      from: jest.fn((table) => {
        const query = {
          select: jest.fn(() => query),
          eq: jest.fn(() => query),
          maybeSingle: jest.fn(async () => {
            if (table === 'story_segments') {
              return {
                data: { segment_id: segmentId, story_id: 'story-123', student_id: studentId },
                error: null,
              };
            }
            if (table === 'stories') {
              return { data: { class_id: 'class-123' }, error: null };
            }
            if (table === 'class_students') {
              return { data: { student_id: studentId }, error: null };
            }
          }),
        };
        return query;
      }),
    };

    const app = express();
    app.use(express.json());
    app.use('/reactions', createReactionsRouter({
      supabase,
      requireStudent: (req, res, next) => {
        req.user = { uid: studentId, role: 'student' };
        next();
      },
    }));

    const response = await request(app)
      .post('/reactions')
      .send({ segmentId, studentId, reactionType: 'heart' });

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('Cannot react to your own segment');
  });

  test('GET blocks students who are not in the story class', async () => {
    const segmentId = '123e4567-e89b-42d3-a456-426614174000';

    const supabase = {
      from: jest.fn((table) => {
        const query = {
          select: jest.fn(() => query),
          eq: jest.fn(() => query),
          maybeSingle: jest.fn(async () => {
            if (table === 'story_segments') {
              return { data: { segment_id: segmentId, story_id: 'story-123' }, error: null };
            }
            if (table === 'stories') {
              return { data: { class_id: 'class-123' }, error: null };
            }
            if (table === 'class_students') {
              return { data: null, error: null };
            }
          }),
        };
        return query;
      }),
    };

    const app = express();
    app.use(express.json());
    app.use('/reactions', createReactionsRouter({
      supabase,
      requireStudent: (req, res, next) => {
        req.user = { uid: 'student-outside-class', role: 'student' };
        next();
      },
    }));

    const response = await request(app)
      .get(`/reactions?segmentId=${segmentId}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toBe('You do not have access to this story');
  });


});

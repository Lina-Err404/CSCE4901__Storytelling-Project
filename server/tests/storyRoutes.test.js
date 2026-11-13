const express = require('express');
const request = require('supertest');
const { createStoryRouter } = require('../src/storyRoutes');

const STUDENT_PROFILE_ID = '00000000-0000-4000-8000-000000000001';
const OTHER_PROFILE_ID = '00000000-0000-4000-8000-000000000002';
const TEACHER_PROFILE_ID = '00000000-0000-4000-8000-000000000008';
const UNLINKED_USER_ID = '00000000-0000-4000-8000-000000000009';
const STORY_ID = '00000000-0000-4000-8000-000000000003';
const ROOM_ID = '00000000-0000-4000-8000-000000000004';
const LOBBY_ID = '00000000-0000-4000-8000-000000000005';
const SEGMENT_ID = '00000000-0000-4000-8000-000000000006';
const OTHER_SEGMENT_ID = '00000000-0000-4000-8000-000000000007';

function createSupabaseMock(seed) {
  const tables = structuredClone(seed);

  class Query {
    constructor(table) {
      this.table = table;
      this.operation = 'select';
      this.filters = [];
      this.ordering = null;
      this.values = null;
      this.conflictColumn = null;
    }

    select() {
      return this;
    }

    eq(column, value) {
      this.filters.push((row) => row[column] === value);
      return this;
    }

    in(column, values) {
      this.filters.push((row) => values.includes(row[column]));
      return this;
    }

    order(column, { ascending }) {
      this.ordering = { column, ascending };
      return this;
    }

    update(values) {
      this.operation = 'update';
      this.values = values;
      return this;
    }

    upsert(values, { onConflict }) {
      this.operation = 'upsert';
      this.values = values;
      this.conflictColumn = onConflict;
      return this;
    }

    async execute() {
      const rows = tables[this.table] || (tables[this.table] = []);
      let matching = rows.filter((row) => this.filters.every((filter) => filter(row)));

      if (this.operation === 'update') {
        matching.forEach((row) => Object.assign(row, this.values));
      } else if (this.operation === 'upsert') {
        const existing = rows.find((row) => row[this.conflictColumn] === this.values[this.conflictColumn]);
        if (existing) {
          Object.assign(existing, this.values);
          matching = [existing];
        } else {
          rows.push(this.values);
          matching = [this.values];
        }
      }

      if (this.ordering) {
        const { column, ascending } = this.ordering;
        matching = [...matching].sort((a, b) => (
          ascending ? a[column] - b[column] : b[column] - a[column]
        ));
      }

      return { data: matching, error: null };
    }

    then(resolve, reject) {
      return this.execute().then(resolve, reject);
    }

    async maybeSingle() {
      const { data, error } = await this.execute();
      return { data: data[0] || null, error };
    }

    async single() {
      const { data, error } = await this.execute();
      return { data: data[0] || null, error };
    }
  }

  return {
    tables,
    from(table) {
      return new Query(table);
    },
  };
}

function seedData() {
  return {
    profiles: [
      { id: STUDENT_PROFILE_ID, role: 'student' },
      { id: OTHER_PROFILE_ID, role: 'student' },
      { id: TEACHER_PROFILE_ID, role: 'teacher' },
    ],
    stories: [{
      story_id: STORY_ID,
      room_id: ROOM_ID,
      title: 'The Lost Key',
      description: 'A shared story',
      status: 'in_progress',
    }],
    breakout_rooms: [{ room_id: ROOM_ID, lobby_id: LOBBY_ID }],
    lobby_participants: [
      { lobby_id: LOBBY_ID, student_id: STUDENT_PROFILE_ID, status: 'active' },
      { lobby_id: LOBBY_ID, student_id: OTHER_PROFILE_ID, status: 'active' },
    ],
    breakout_participants: [
      { lobby_id: LOBBY_ID, room_id: ROOM_ID, student_id: STUDENT_PROFILE_ID },
      { lobby_id: LOBBY_ID, room_id: ROOM_ID, student_id: OTHER_PROFILE_ID },
    ],
    story_segments: [
      {
        segment_id: SEGMENT_ID,
        story_id: STORY_ID,
        student_id: STUDENT_PROFILE_ID,
        section: 'rising_action',
        section_order: 1,
        segment_title: 'The discovery',
        writing_content: 'A draft',
        writing_document: { version: 1, runs: [{ text: 'A draft', marks: {} }] },
        text_box_size: { widthPercent: 86, heightPercent: 77 },
        updated_at: '2026-11-06T12:00:00.000Z',
      },
      {
        segment_id: OTHER_SEGMENT_ID,
        story_id: STORY_ID,
        student_id: OTHER_PROFILE_ID,
        section: 'falling_action',
        section_order: 2,
        segment_title: 'The return',
        writing_content: '',
        writing_document: { version: 1, runs: [] },
        text_box_size: { widthPercent: 86, heightPercent: 77 },
        updated_at: '2026-11-06T12:00:00.000Z',
      },
    ],
    segment_drawings: [{
      segment_id: SEGMENT_ID,
      drawing_data: { version: 1, shapes: [{ type: 'circle' }] },
    }],
  };
}

function createApp(supabase) {
  const app = express();
  app.use(express.json());
  app.use(createStoryRouter({
    getSupabase: () => supabase,
    requireSupabaseStudent(req, res, next) {
      req.user = { uid: req.get('x-supabase-uid') || STUDENT_PROFILE_ID };
      return next();
    },
  }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    return res.status(500).json({ error: 'Internal server error' });
  });
  return app;
}

describe('Supabase-backed story routes', () => {
  test('returns story sections ordered by section_order with drawing data', async () => {
    const supabase = createSupabaseMock(seedData());
    const response = await request(createApp(supabase)).get(`/stories/${STORY_ID}`);

    expect(response.status).toBe(200);
    expect(response.body.story).toMatchObject({ storyId: STORY_ID, title: 'The Lost Key' });
    expect(response.body.segments.map(({ section }) => section)).toEqual([
      'rising_action',
      'falling_action',
    ]);
    expect(response.body.segments[0]).toMatchObject({
      segmentId: SEGMENT_ID,
      studentId: STUDENT_PROFILE_ID,
      writingContent: 'A draft',
      writingDocument: { version: 1, runs: [{ text: 'A draft', marks: {} }] },
      textBoxSize: { widthPercent: 86, heightPercent: 77 },
      drawingData: { version: 1, shapes: [{ type: 'circle' }] },
      assignedToYou: true,
    });
    expect(response.body.segments[1].assignedToYou).toBe(false);
  });

  test('saves and reloads writing for the assigned student only', async () => {
    const supabase = createSupabaseMock(seedData());
    const app = createApp(supabase);
    const saved = await request(app)
      .put(`/story-segments/${SEGMENT_ID}`)
      .send({ writingContent: 'New progress', studentId: OTHER_PROFILE_ID });

    expect(saved.status).toBe(200);
    expect(saved.body.writingContent).toBe('New progress');

    const reloaded = await request(app).get(`/stories/${STORY_ID}`);
    expect(reloaded.body.segments[0].writingContent).toBe('New progress');

    const forbidden = await request(app)
      .put(`/story-segments/${OTHER_SEGMENT_ID}`)
      .send({ writingContent: 'Attempt to edit another section' });
    expect(forbidden.status).toBe(403);
    expect(supabase.tables.story_segments[1].writing_content).toBe('');
  });

  test('saves and reloads rich-text formatting and textbox dimensions', async () => {
    const supabase = createSupabaseMock(seedData());
    const app = createApp(supabase);
    const writingDocument = {
      version: 1,
      runs: [
        { text: 'Styled ', marks: { bold: true, fontFamily: 'Georgia', fontSize: 18 } },
        { text: 'phrase', marks: { italic: true, underline: true } },
      ],
    };
    const textBoxSize = { widthPercent: 72, heightPercent: 64 };

    const saved = await request(app)
      .put(`/story-segments/${SEGMENT_ID}`)
      .send({ writingDocument, textBoxSize });

    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({
      writingContent: 'Styled phrase',
      writingDocument,
      textBoxSize,
    });

    const reloaded = await request(app).get(`/stories/${STORY_ID}`);
    expect(reloaded.body.segments[0]).toMatchObject({ writingDocument, textBoxSize });
    expect(supabase.tables.story_segments[0]).toMatchObject({
      writing_content: 'Styled phrase',
      writing_document: writingDocument,
      text_box_size: textBoxSize,
    });
  });

  test('rejects invalid rich text and textbox dimensions', async () => {
    const app = createApp(createSupabaseMock(seedData()));
    const invalidDocuments = [
      { version: 2, runs: [] },
      { version: 1, runs: [{ text: 'x', marks: { fontSize: 100 } }] },
      { version: 1, runs: [{ text: 'x', marks: { fontFamily: 'expression(alert(1))' } }] },
      { version: 1, runs: [{ text: 'x', marks: { strike: true } }] },
    ];

    for (const writingDocument of invalidDocuments) {
      const response = await request(app)
        .put(`/story-segments/${SEGMENT_ID}`)
        .send({ writingDocument });
      expect(response.status).toBe(400);
    }

    const invalidSize = await request(app)
      .put(`/story-segments/${SEGMENT_ID}`)
      .send({ textBoxSize: { widthPercent: 120, heightPercent: 50 } });
    expect(invalidSize.status).toBe(400);
  });

  test('keeps legacy plain-text saves compatible with rich-text persistence', async () => {
    const supabase = createSupabaseMock(seedData());
    const response = await request(createApp(supabase))
      .put(`/story-segments/${SEGMENT_ID}`)
      .send({ writingContent: 'Plain text\ncontinues' });

    expect(response.status).toBe(200);
    expect(response.body.writingDocument).toEqual({
      version: 1,
      runs: [{ text: 'Plain text\ncontinues', marks: {} }],
    });
    expect(supabase.tables.story_segments[0].writing_content).toBe('Plain text\ncontinues');
  });

  test('rejects story reads for students outside the breakout room', async () => {
    const seed = seedData();
    seed.breakout_participants = seed.breakout_participants.filter(
      ({ student_id }) => student_id !== OTHER_PROFILE_ID,
    );
    const response = await request(createApp(createSupabaseMock(seed)))
      .get(`/stories/${STORY_ID}`)
      .set('x-supabase-uid', OTHER_PROFILE_ID);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Forbidden' });
  });

  test('saves drawing data for an assigned section and rejects invalid formats', async () => {
    const supabase = createSupabaseMock(seedData());
    const app = createApp(supabase);
    const drawingData = { version: 1, shapes: [{ type: 'line', points: [0, 0, 8, 8] }] };
    const saved = await request(app)
      .put(`/story-segments/${SEGMENT_ID}/drawing`)
      .send({ drawingData });

    expect(saved.status).toBe(200);
    expect(supabase.tables.segment_drawings[0].drawing_data).toEqual(drawingData);

    const invalid = await request(app)
      .put(`/story-segments/${SEGMENT_ID}/drawing`)
      .send({ drawingData: { version: 2, shapes: [] } });
    expect(invalid.status).toBe(400);
  });

  test('requires the Supabase Auth user ID to match a student profile ID', async () => {
    const response = await request(createApp(createSupabaseMock(seedData())))
      .get(`/stories/${STORY_ID}`)
      .set('x-supabase-uid', UNLINKED_USER_ID);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/not linked/i);
  });

  test('rejects Supabase Auth accounts linked to teacher profiles', async () => {
    const response = await request(createApp(createSupabaseMock(seedData())))
      .get(`/stories/${STORY_ID}`)
      .set('x-supabase-uid', TEACHER_PROFILE_ID);

    expect(response.status).toBe(403);
  });
});

const express = require('express');
const { getSupabaseClient } = require('./supabase');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_WRITING_LENGTH = 50000;
const MAX_WRITING_DOCUMENT_BYTES = 80 * 1024;
const MAX_WRITING_RUNS = 5000;
const MAX_DRAWING_BYTES = 80 * 1024;
const MAX_DRAWING_SHAPES = 500;
const DEFAULT_TEXT_BOX_SIZE = { widthPercent: 86, heightPercent: 77 };
const ALLOWED_FONT_FAMILIES = new Set([
  'Arial',
  'Arial Black',
  'Calibri',
  'Cambria',
  'Comic Sans MS',
  'Courier New',
  'Georgia',
  'Helvetica',
  'Impact',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
]);

function httpError(status, message) {
  return Object.assign(new Error(message), { status, expose: true });
}

async function getData(query) {
  const result = await query;
  if (result.error) throw result.error;
  return result.data;
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch((error) => {
      if (error.expose === true && Number.isInteger(error.status)) {
        return res.status(error.status).json({ error: error.message });
      }
      return next(error);
    });
  };
}

async function getStudentProfile(supabase, supabaseUserId) {
  const profile = await getData(supabase
    .from('profiles')
    .select('id, role')
    .eq('id', supabaseUserId)
    .maybeSingle());
  if (!profile) throw httpError(403, 'Supabase account is not linked to a story profile');
  if (profile.role !== 'student') throw httpError(403, 'Forbidden');
  return profile;
}

async function requireRoomMembership(supabase, storyId, studentId) {
  const story = await getData(supabase
    .from('stories')
    .select('story_id, room_id, title, description, status, created_at')
    .eq('story_id', storyId)
    .maybeSingle());
  if (!story) throw httpError(404, 'Story not found');

  const room = await getData(supabase
    .from('breakout_rooms')
    .select('room_id, lobby_id')
    .eq('room_id', story.room_id)
    .maybeSingle());
  if (!room) throw httpError(404, 'Story room not found');

  const participant = await getData(supabase
    .from('lobby_participants')
    .select('status')
    .eq('lobby_id', room.lobby_id)
    .eq('student_id', studentId)
    .maybeSingle());
  if (!participant || participant.status !== 'active') {
    throw httpError(403, 'Forbidden');
  }

  const roomParticipant = await getData(supabase
    .from('breakout_participants')
    .select('student_id')
    .eq('lobby_id', room.lobby_id)
    .eq('room_id', room.room_id)
    .eq('student_id', studentId)
    .maybeSingle());
  if (!roomParticipant) throw httpError(403, 'Forbidden');

  return story;
}

async function getOwnedSegment(supabase, segmentId, studentId) {
  const segment = await getData(supabase
    .from('story_segments')
    .select('segment_id, story_id, student_id')
    .eq('segment_id', segmentId)
    .maybeSingle());
  if (!segment) throw httpError(404, 'Story section not found');
  if (segment.student_id !== studentId) throw httpError(403, 'You can only edit your assigned section');

  const story = await requireRoomMembership(supabase, segment.story_id, studentId);
  return { segment, story };
}

function validDrawingData(drawingData) {
  if (
    !drawingData ||
    typeof drawingData !== 'object' ||
    Array.isArray(drawingData) ||
    drawingData.version !== 1 ||
    !Array.isArray(drawingData.shapes) ||
    drawingData.shapes.length > MAX_DRAWING_SHAPES ||
    drawingData.shapes.some((shape) => !shape || typeof shape !== 'object' || Array.isArray(shape))
  ) {
    return false;
  }

  return Buffer.byteLength(JSON.stringify(drawingData), 'utf8') <= MAX_DRAWING_BYTES;
}

function textFromWritingDocument(writingDocument) {
  return writingDocument.runs.map(({ text }) => text).join('');
}

function plainWritingDocument(text) {
  return {
    version: 1,
    runs: text ? [{ text, marks: {} }] : [],
  };
}

function validWritingDocument(writingDocument) {
  if (
    !writingDocument ||
    typeof writingDocument !== 'object' ||
    Array.isArray(writingDocument) ||
    writingDocument.version !== 1 ||
    !Array.isArray(writingDocument.runs) ||
    writingDocument.runs.length > MAX_WRITING_RUNS ||
    Object.keys(writingDocument).some((key) => !['version', 'runs'].includes(key))
  ) {
    return false;
  }

  let textLength = 0;
  for (const run of writingDocument.runs) {
    if (
      !run ||
      typeof run !== 'object' ||
      Array.isArray(run) ||
      Object.keys(run).some((key) => !['text', 'marks'].includes(key)) ||
      typeof run.text !== 'string' ||
      !run.marks ||
      typeof run.marks !== 'object' ||
      Array.isArray(run.marks) ||
      Object.keys(run.marks).some((key) => ![
        'bold',
        'italic',
        'underline',
        'fontFamily',
        'fontSize',
      ].includes(key))
    ) {
      return false;
    }

    textLength += run.text.length;
    if (textLength > MAX_WRITING_LENGTH) return false;

    const { bold, italic, underline, fontFamily, fontSize } = run.marks;
    if ([bold, italic, underline].some((value) => value !== undefined && typeof value !== 'boolean')) {
      return false;
    }
    if (fontFamily !== undefined && !ALLOWED_FONT_FAMILIES.has(fontFamily)) return false;
    if (
      fontSize !== undefined &&
      (!Number.isInteger(fontSize) || fontSize < 8 || fontSize > 72)
    ) {
      return false;
    }
  }

  return Buffer.byteLength(JSON.stringify(writingDocument), 'utf8') <= MAX_WRITING_DOCUMENT_BYTES;
}

function validTextBoxSize(textBoxSize) {
  return Boolean(
    textBoxSize &&
    typeof textBoxSize === 'object' &&
    !Array.isArray(textBoxSize) &&
    Object.keys(textBoxSize).length === 2 &&
    Number.isFinite(textBoxSize.widthPercent) &&
    Number.isFinite(textBoxSize.heightPercent) &&
    textBoxSize.widthPercent >= 10 &&
    textBoxSize.widthPercent <= 100 &&
    textBoxSize.heightPercent >= 10 &&
    textBoxSize.heightPercent <= 100
  );
}

function createStoryRouter({ requireSupabaseStudent, getSupabase = getSupabaseClient }) {
  const router = express.Router();

  router.get('/stories/:storyId', requireSupabaseStudent, asyncRoute(async (req, res) => {
    const { storyId } = req.params;
    if (!UUID_PATTERN.test(storyId)) throw httpError(400, 'Invalid storyId');

    const supabase = getSupabase();
    const profile = await getStudentProfile(supabase, req.user.uid);
    const story = await requireRoomMembership(supabase, storyId, profile.id);
    const segments = await getData(supabase
      .from('story_segments')
      .select('segment_id, section, section_order, segment_title, writing_content, writing_document, text_box_size, student_id, updated_at')
      .eq('story_id', storyId)
      .order('section_order', { ascending: true }));
    const segmentRows = segments || [];
    const drawings = segmentRows.length
      ? await getData(supabase
        .from('segment_drawings')
        .select('segment_id, drawing_data')
        .in('segment_id', segmentRows.map(({ segment_id }) => segment_id))
        )
      : [];
    const drawingsBySegment = new Map((drawings || []).map((drawing) => [drawing.segment_id, drawing.drawing_data]));

    return res.json({
      story: {
        storyId: story.story_id,
        title: story.title,
        description: story.description,
        status: story.status,
      },
      segments: segmentRows.map((segment) => ({
        segmentId: segment.segment_id,
        studentId: segment.student_id,
        section: segment.section,
        sectionOrder: segment.section_order,
        title: segment.segment_title,
        writingContent: segment.writing_content,
        writingDocument: segment.writing_document || plainWritingDocument(segment.writing_content || ''),
        textBoxSize: segment.text_box_size || DEFAULT_TEXT_BOX_SIZE,
        drawingData: drawingsBySegment.get(segment.segment_id) || null,
        assignedToYou: segment.student_id === profile.id,
        updatedAt: segment.updated_at,
      })),
    });
  }));

  router.put('/story-segments/:segmentId', requireSupabaseStudent, asyncRoute(async (req, res) => {
    const { segmentId } = req.params;
    const body = req.body;
    const hasWritingContent = body && Object.prototype.hasOwnProperty.call(body, 'writingContent');
    const hasWritingDocument = body && Object.prototype.hasOwnProperty.call(body, 'writingDocument');
    const hasTextBoxSize = body && Object.prototype.hasOwnProperty.call(body, 'textBoxSize');
    if (!UUID_PATTERN.test(segmentId)) throw httpError(400, 'Invalid segmentId');
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
      (!hasWritingContent && !hasWritingDocument && !hasTextBoxSize)) {
      throw httpError(400, 'Provide writingContent, writingDocument, or textBoxSize');
    }

    if (hasWritingContent && (
      typeof body.writingContent !== 'string' ||
      body.writingContent.length > MAX_WRITING_LENGTH
    )) {
      throw httpError(400, `writingContent must be a string of at most ${MAX_WRITING_LENGTH} characters`);
    }

    if (hasWritingDocument && !validWritingDocument(body.writingDocument)) {
      throw httpError(400, 'writingDocument must be version 1 with valid runs and marks, at most 50,000 text characters, and at most 80 KB');
    }

    if (hasTextBoxSize && !validTextBoxSize(body.textBoxSize)) {
      throw httpError(400, 'textBoxSize must contain widthPercent and heightPercent values from 10 to 100');
    }

    if (hasWritingDocument && hasWritingContent &&
      textFromWritingDocument(body.writingDocument) !== body.writingContent) {
      throw httpError(400, 'writingContent must match the text in writingDocument');
    }

    const updates = { updated_at: new Date().toISOString() };
    if (hasWritingDocument) {
      updates.writing_document = body.writingDocument;
      updates.writing_content = textFromWritingDocument(body.writingDocument);
    } else if (hasWritingContent) {
      updates.writing_content = body.writingContent;
      updates.writing_document = plainWritingDocument(body.writingContent);
    }
    if (hasTextBoxSize) updates.text_box_size = body.textBoxSize;

    const supabase = getSupabase();
    const profile = await getStudentProfile(supabase, req.user.uid);
    await getOwnedSegment(supabase, segmentId, profile.id);
    const saved = await getData(supabase
      .from('story_segments')
      .update(updates)
      .eq('segment_id', segmentId)
      .eq('student_id', profile.id)
      .select('segment_id, writing_content, writing_document, text_box_size, updated_at')
      .maybeSingle());
    if (!saved) throw httpError(409, 'Section assignment changed; reload the story');

    return res.json({
      segmentId: saved.segment_id,
      writingContent: saved.writing_content,
      writingDocument: saved.writing_document || plainWritingDocument(saved.writing_content || ''),
      textBoxSize: saved.text_box_size || DEFAULT_TEXT_BOX_SIZE,
      updatedAt: saved.updated_at,
    });
  }));

  router.put('/story-segments/:segmentId/drawing', requireSupabaseStudent, asyncRoute(async (req, res) => {
    const { segmentId } = req.params;
    const drawingData = req.body?.drawingData;
    if (!UUID_PATTERN.test(segmentId)) throw httpError(400, 'Invalid segmentId');
    if (!validDrawingData(drawingData)) {
      throw httpError(400, 'drawingData must contain version 1 and at most 500 shapes within 80 KB');
    }

    const supabase = getSupabase();
    const profile = await getStudentProfile(supabase, req.user.uid);
    await getOwnedSegment(supabase, segmentId, profile.id);
    const saved = await getData(supabase
      .from('segment_drawings')
      .upsert(
        { segment_id: segmentId, drawing_data: drawingData },
        { onConflict: 'segment_id' },
      )
      .select('segment_id, drawing_data')
      .single());

    return res.json({
      segmentId: saved.segment_id,
      drawingData: saved.drawing_data,
    });
  }));

  return router;
}

module.exports = { createStoryRouter };

const express = require('express');
const { getSupabaseClient } = require('./supabase');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_WRITING_LENGTH = 50000;
const MAX_DRAWING_BYTES = 80 * 1024;
const MAX_DRAWING_SHAPES = 500;

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

async function getStudentProfile(supabase, firebaseUid) {
  const profile = await getData(supabase
    .from('profiles')
    .select('id')
    .eq('firebase_uid', firebaseUid)
    .maybeSingle());
  if (!profile) throw httpError(403, 'Student account is not linked to a story profile');
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

function createStoryRouter({ requireStudent, getSupabase = getSupabaseClient }) {
  const router = express.Router();

  router.get('/stories/:storyId', requireStudent, asyncRoute(async (req, res) => {
    const { storyId } = req.params;
    if (!UUID_PATTERN.test(storyId)) throw httpError(400, 'Invalid storyId');

    const supabase = getSupabase();
    const profile = await getStudentProfile(supabase, req.user.uid);
    const story = await requireRoomMembership(supabase, storyId, profile.id);
    const segments = await getData(supabase
      .from('story_segments')
      .select('segment_id, section, section_order, segment_title, writing_content, student_id, updated_at')
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
        section: segment.section,
        sectionOrder: segment.section_order,
        title: segment.segment_title,
        writingContent: segment.writing_content,
        drawingData: drawingsBySegment.get(segment.segment_id) || null,
        assignedToYou: segment.student_id === profile.id,
        updatedAt: segment.updated_at,
      })),
    });
  }));

  router.put('/story-segments/:segmentId', requireStudent, asyncRoute(async (req, res) => {
    const { segmentId } = req.params;
    const writingContent = req.body?.writingContent;
    if (!UUID_PATTERN.test(segmentId)) throw httpError(400, 'Invalid segmentId');
    if (typeof writingContent !== 'string' || writingContent.length > MAX_WRITING_LENGTH) {
      throw httpError(400, `writingContent must be a string of at most ${MAX_WRITING_LENGTH} characters`);
    }

    const supabase = getSupabase();
    const profile = await getStudentProfile(supabase, req.user.uid);
    await getOwnedSegment(supabase, segmentId, profile.id);
    const saved = await getData(supabase
      .from('story_segments')
      .update({ writing_content: writingContent, updated_at: new Date().toISOString() })
      .eq('segment_id', segmentId)
      .eq('student_id', profile.id)
      .select('segment_id, writing_content, updated_at')
      .maybeSingle());
    if (!saved) throw httpError(409, 'Section assignment changed; reload the story');

    return res.json({
      segmentId: saved.segment_id,
      writingContent: saved.writing_content,
      updatedAt: saved.updated_at,
    });
  }));

  router.put('/story-segments/:segmentId/drawing', requireStudent, asyncRoute(async (req, res) => {
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

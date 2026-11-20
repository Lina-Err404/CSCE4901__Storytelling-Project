
const express = require('express');

const VALID_REACTIONS = new Set([
  'heart', 'fire', 'mindblown', 'sparkle',
  'thumbsup', 'laugh', 'party', 'star',
  'clap', 'thinking', 'rocket', 'idea',
  'sad', 'aww', 'suspense', 'plottwist',
  'wholesome', 'sobbing',
]);

function createReactionsRouter({ supabase, requireStudent }) {
  const router = express.Router();

  // All reaction requests require a logged-in student.
  router.use(requireStudent);


  // Check whether the student belongs to the story's class.
  async function studentCanAccessStory(studentId, storyId) {
    const { data: story, error: storyError } = await supabase
      .from('stories')
      .select('class_id')
      .eq('story_id', storyId)
      .maybeSingle();

    if (storyError) throw storyError;
    if (!story || !story.class_id) return false;

    const { data: membership, error: membershipError } = await supabase
      .from('class_students')
      .select('student_id')
      .eq('class_id', story.class_id)
      .eq('student_id', studentId)
      .maybeSingle();

    if (membershipError) throw membershipError;

    return Boolean(membership);
  }



  // R7: Get reactions for a story segment
  router.get('/', async (req, res) => {
    try {
      const { segmentId } = req.query;

      if (
        typeof segmentId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segmentId)
      ) {
        return res.status(400).json({
          error: 'Valid segmentId is required',
        });
      }

      // Find the story segment
      const { data: segment, error: segmentError } = await supabase
        .from('story_segments')
        .select('segment_id, story_id')
        .eq('segment_id', segmentId)
        .maybeSingle();

      if (segmentError) throw segmentError;

      if (!segment) {
        return res.status(404).json({
          error: 'Story segment not found',
        });
      }


      const allowed = await studentCanAccessStory(
        req.user.uid,
        segment.story_id
      );

      if (!allowed) {
        return res.status(403).json({
          error: 'You do not have access to this story',
        });
      }


      // Retrieve saved reactions
      const { data, error } = await supabase
        .from('segment_reactions')
        .select('student_id, reaction_type')
        .eq('segment_id', segmentId);

      if (error) throw error;

      const reactions = data || [];
      const counts = {};

      for (const reaction of reactions) {
        const type = reaction.reaction_type;
        counts[type] = (counts[type] || 0) + 1;
      }

      return res.json({
        counts,
        reactions,
      });
    } catch (error) {
      console.error('Error retrieving reactions:', error);
      return res.status(500).json({
        error: 'Failed to retrieve reactions',
      });
    }
  });



  // R6: Add, update, or remove a reaction
  router.post('/', async (req, res) => {
    try {
const { segmentId, studentId, reactionType } = req.body || {};
      // Student must be authenticated.
      // Never trust a student ID supplied by the browser.
      if (!req.user || req.user.uid !== studentId) {
        return res.status(403).json({
          error: 'Cannot modify another student reaction',
        });
      }

      if (
        typeof segmentId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(segmentId)
      ) {
        return res.status(400).json({
          error: 'Valid segmentId is required',
        });
      }

      if (reactionType !== null && !VALID_REACTIONS.has(reactionType)) {
        return res.status(400).json({
          error: 'Invalid reaction type',
        });
      }

      // Confirm that the segment exists.
      const { data: segment, error: segmentError } = await supabase
        .from('story_segments')
        .select('segment_id, story_id, student_id')
        .eq('segment_id', segmentId)
        .maybeSingle();

      if (segmentError) throw segmentError;

      if (!segment) {
        return res.status(404).json({
          error: 'Story segment not found',
        });
      }


      const allowed = await studentCanAccessStory(
        req.user.uid,
        segment.story_id
      );

      if (!allowed) {
        return res.status(403).json({
          error: 'You do not have access to this story',
        });
      }


      // A student should not react to their own segment.
      if (segment.student_id === req.user.uid) {
        return res.status(403).json({
          error: 'Cannot react to your own segment',
        });
      }

      if (reactionType === null) {
        // Remove an existing reaction.
        const { error } = await supabase
          .from('segment_reactions')
          .delete()
          .eq('segment_id', segmentId)
          .eq('student_id', req.user.uid);

        if (error) throw error;
      } else {
        // Insert or update the student's reaction.
        const { error } = await supabase
          .from('segment_reactions')
          .upsert(
            {
              segment_id: segmentId,
              student_id: req.user.uid,
              reaction_type: reactionType,
            },
            {
              onConflict: 'segment_id,student_id',
            }
          );

        if (error) throw error;
      }

      return res.json({ success: true });
    } catch (error) {
      console.error('Error saving reaction:', error);
      return res.status(500).json({
        error: 'Failed to save reaction',
      });
    }
  });


  return router;
}

module.exports = {
  createReactionsRouter,
  VALID_REACTIONS,
};

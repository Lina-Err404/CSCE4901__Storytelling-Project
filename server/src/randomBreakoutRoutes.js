const express = require('express');
const { createRandomBreakoutRooms } = require('./randomBreakoutRooms');

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function throwOnError(result) {
  if (result.error) throw result.error;
  return result.data;
}

function createRandomBreakoutRoutes({ supabase, requireTeacher }) {
  const router = express.Router();

  router.post(
    '/lobbies/:id/breakout-rooms/random',
    requireTeacher,
    async (req, res) => {
      try {
        const { id } = req.params;
        const { roomCount } = req.body || {};

        if (!UUID_PATTERN.test(id)) {
          return res.status(400).json({
            error: 'Invalid lobbyId',
          });
        }

        if (!Number.isInteger(roomCount) || roomCount < 1) {
          return res.status(400).json({
            error: 'roomCount must be a positive integer',
          });
        }

        // Get the lobby and its class.
        const lobby = throwOnError(
          await supabase
            .from('lobbies')
            .select('lobby_id, class_id')
            .eq('lobby_id', id)
            .maybeSingle()
        );

        if (!lobby) {
          return res.status(404).json({
            error: 'Lobby not found',
          });
        }

        // Make sure the logged-in teacher owns the class.
        const schoolClass = throwOnError(
          await supabase
            .from('classes')
            .select('teacher_id')
            .eq('class_id', lobby.class_id)
            .maybeSingle()
        );

        if (!schoolClass || schoolClass.teacher_id !== req.user.uid) {
          return res.status(403).json({
            error: 'Forbidden',
          });
        }

        // Get the students currently active in the lobby.
        const participants = throwOnError(
          await supabase
            .from('lobby_participants')
            .select('student_id')
            .eq('lobby_id', lobby.lobby_id)
            .eq('status', 'active')
        );

        const studentIds = participants.map(
          ({ student_id }) => student_id
        );

        const rooms = createRandomBreakoutRooms(
          studentIds,
          roomCount
        );

        return res.json({
          success: true,
          rooms,
        });
      } catch (error) {
        const status = Number.isInteger(error?.status)
          ? error.status
          : 500;

        return res.status(status).json({
          error:
            status >= 500
              ? 'Could not create random breakout rooms'
              : error.message,
        });
      }
    }
  );

  return router;
}

module.exports = { createRandomBreakoutRoutes };
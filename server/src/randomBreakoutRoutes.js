const express = require('express');
const { randomUUID } = require('crypto');
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

        if (studentIds.length < roomCount * 2) {
          return res.status(400).json({
            error: 'You need at least two students per room.',
          });
        }

        const generatedRooms = createRandomBreakoutRooms(
          studentIds,
          roomCount
        );

        // Supabase breakout_rooms.room_id is UUID,
        // so replace group1/group2 style IDs with UUIDs.
        const rooms = generatedRooms.map((room, index) => ({
          ...room,
          roomId: randomUUID(),
          roomName: room.roomName || `Room ${index + 1}`,
        }));

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
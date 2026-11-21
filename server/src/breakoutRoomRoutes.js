const express = require('express');

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function throwOnError(result) {
  if (result.error) throw result.error;
  return result.data;
}

function createBreakoutRoomRoutes({ supabase, requireTeacher }) {
  const router = express.Router();

  async function verifyLobbyOwner(lobbyId, teacherId) {
    if (!UUID_PATTERN.test(lobbyId)) {
      const error = new Error('Invalid lobbyId');
      error.status = 400;
      throw error;
    }

    const lobby = throwOnError(
      await supabase
        .from('lobbies')
        .select('lobby_id, class_id')
        .eq('lobby_id', lobbyId)
        .maybeSingle()
    );

    if (!lobby) {
      const error = new Error('Lobby not found');
      error.status = 404;
      throw error;
    }

    const schoolClass = throwOnError(
      await supabase
        .from('classes')
        .select('teacher_id')
        .eq('class_id', lobby.class_id)
        .maybeSingle()
    );

    if (!schoolClass || schoolClass.teacher_id !== teacherId) {
      const error = new Error('Forbidden');
      error.status = 403;
      throw error;
    }

    return lobby;
  }

  // Load previously saved breakout rooms.
  router.get(
    '/lobbies/:id/breakout-rooms',
    requireTeacher,
    async (req, res) => {
      try {
        await verifyLobbyOwner(req.params.id, req.user.uid);

        const rooms = throwOnError(
          await supabase
            .from('breakout_rooms')
            .select('room_id, room_name')
            .eq('lobby_id', req.params.id)
            .order('room_name')
        );

        const participants = throwOnError(
          await supabase
            .from('breakout_participants')
            .select('room_id, student_id')
            .eq('lobby_id', req.params.id)
        );

        return res.json({
          success: true,
          rooms: rooms.map((room) => ({
            roomId: room.room_id,
            roomName: room.room_name,
            studentIds: participants
              .filter(
                (participant) =>
                  participant.room_id === room.room_id
              )
              .map(
                (participant) => participant.student_id
              ),
          })),
        });
      } catch (error) {
        const status = Number.isInteger(error?.status)
          ? error.status
          : 500;

        return res.status(status).json({
          error:
            status >= 500
              ? 'Could not load breakout rooms'
              : error.message,
        });
      }
    }
  );

  // Save the teacher's finalized breakout-room assignments.
  router.post(
    '/lobbies/:id/breakout-rooms',
    requireTeacher,
    async (req, res) => {
      try {
        const lobbyId = req.params.id;
        const rooms = req.body?.rooms;

        await verifyLobbyOwner(
          lobbyId,
          req.user.uid
        );

        if (!Array.isArray(rooms)) {
          return res.status(400).json({
            error: 'rooms must be an array',
          });
        }

        const seenStudents = new Set();

        for (const room of rooms) {
          if (
            !UUID_PATTERN.test(room?.roomId) ||
            typeof room?.roomName !== 'string' ||
            !room.roomName.trim() ||
            !Array.isArray(room?.studentIds)
          ) {
            return res.status(400).json({
              error: 'Invalid breakout room',
            });
          }

          if (room.studentIds.length < 2) {
            return res.status(400).json({
              error:
                'Each breakout room must contain at least 2 students',
            });
          }

          for (const studentId of room.studentIds) {
            if (
              typeof studentId !== 'string' ||
              !UUID_PATTERN.test(studentId) ||
              seenStudents.has(studentId)
            ) {
              return res.status(400).json({
                error:
                  'Students may only be assigned to one room with a valid UUID',
              });
            }

            seenStudents.add(studentId);
          }
        }

        // Remove the old assignments first.
        throwOnError(
          await supabase
            .from('breakout_participants')
            .delete()
            .eq('lobby_id', lobbyId)
        );

        throwOnError(
          await supabase
            .from('breakout_rooms')
            .delete()
            .eq('lobby_id', lobbyId)
        );

        if (rooms.length > 0) {
          throwOnError(
            await supabase
              .from('breakout_rooms')
              .insert(
                rooms.map((room) => ({
                  room_id: room.roomId,
                  lobby_id: lobbyId,
                  room_name: room.roomName.trim(),
                }))
              )
          );

          const participantRows = rooms.flatMap(
            (room) =>
              room.studentIds.map((studentId) => ({
                lobby_id: lobbyId,
                room_id: room.roomId,
                student_id: studentId,
              }))
          );

          if (participantRows.length > 0) {
            throwOnError(
              await supabase
                .from('breakout_participants')
                .insert(participantRows)
            );
          }
        }

        return res.json({
          success: true,
          message: 'Breakout rooms saved successfully',
          rooms,
        });
      } catch (error) {
        const status = Number.isInteger(error?.status)
          ? error.status
          : 500;

        return res.status(status).json({
          error:
            status >= 500
              ? 'Could not save breakout rooms'
              : error.message,
        });
      }
    }
  );

  return router;
}

module.exports = {
  createBreakoutRoomRoutes,
};
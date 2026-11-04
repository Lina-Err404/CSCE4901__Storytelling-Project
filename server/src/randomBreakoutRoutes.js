const express = require('express');
const { createRandomBreakoutRooms } = require('./randomBreakoutRooms');

function createRandomBreakoutRoutes({ db, requireTeacher }) {
  const router = express.Router();

  router.post(
    '/lobbies/:lobbyId/breakout-rooms/random',
    requireTeacher,
    async (req, res) => {
      try {
        const { lobbyId } = req.params;
        const { roomCount } = req.body ?? {};

        if (!Number.isInteger(roomCount) || roomCount < 1) {
          return res.status(400).json({
            error: 'roomCount must be a positive integer',
          });
        }

        const lobbyRef = db.collection('Lobbies').doc(lobbyId);
        const lobbySnapshot = await lobbyRef.get();

        if (!lobbySnapshot.exists) {
          return res.status(404).json({
            error: 'Lobby not found',
          });
        }

        const lobby = lobbySnapshot.data();

        // Only the teacher who owns the lobby can randomize its groups.
        if (lobby.hostId !== req.user.uid) {
          return res.status(403).json({
            error: 'You do not have permission to manage this lobby',
          });
        }

        const participantIds = Array.isArray(lobby.participantIds)
          ? lobby.participantIds
          : [];

        const rooms = createRandomBreakoutRooms(
          participantIds,
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
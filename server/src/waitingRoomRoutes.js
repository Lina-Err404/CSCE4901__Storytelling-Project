const express = require('express');
const { createWaitingRoomService } = require('./waitingRoomService');

function createWaitingRoomRoutes({
  requireStudent,
  getGroupForStudent,
}) {
  const router = express.Router();

  const service = createWaitingRoomService({
    getGroupForStudent,
  });

  router.get(
    '/waiting-room',
    requireStudent,
    async (req, res) => {
      try {
        const result = await service.getWaitingRoom(
          req.user.uid
        );

        return res.json(result);
      } catch (error) {
        const status = Number.isInteger(error?.status)
          ? error.status
          : 500;

        return res.status(status).json({
          error:
            status >= 500
              ? 'Could not load waiting room'
              : error.message,
        });
      }
    }
  );

  return router;
}

module.exports = {
  createWaitingRoomRoutes,
};
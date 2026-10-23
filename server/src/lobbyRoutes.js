const express = require('express');
const { createLobby: defaultCreateLobby, joinLobby: defaultJoinLobby } = require('./lobbyService');

function createLobbyRoutes({ requireTeacher, requireStudent, createLobby = defaultCreateLobby, joinLobby = defaultJoinLobby }) {
  const router = express.Router();

  async function sendResult(res, operation) {
    try {
      return res.json(await operation());
    } catch (error) {
      const status = Number.isInteger(error?.status) ? error.status : 500;
      return res.status(status).json({
        error: status >= 500 ? 'Lobby operation failed' : error.message,
      });
    }
  }

  router.post('/lobbies', requireTeacher, (req, res) => sendResult(res, async () => ({
    code: await createLobby(req.user.uid, req.body?.classId),
  })));

  router.post('/lobbies/:code/join', requireStudent, (req, res) => sendResult(res, async () => ({
    ...(await joinLobby(req.user.uid, req.params.code)),
  })));

  return router;
}

module.exports = { createLobbyRoutes };
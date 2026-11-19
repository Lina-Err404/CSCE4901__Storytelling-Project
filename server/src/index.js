const { createClassesRouter } = require('./classes');
const { createLobbyRouter } = require('./lobby');
const { createSocketAuth } = require('./socketAuth');
const { createRequireStudent, createRequireTeacher } = require('./auth');
const { createLobbyService, createLobby, joinLobby } = require('./lobbyService');
const { createLobbyRoutes } = require('./lobbyRoutes');

module.exports = {
  createClassesRouter,
  createLobbyRouter,
  createSocketAuth,
  createRequireStudent,
  createRequireTeacher,
  createLobbyService,
  createLobby,
  joinLobby,
  createLobbyRoutes,
};
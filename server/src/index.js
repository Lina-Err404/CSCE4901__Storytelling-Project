const { createClassesRouter } = require('./classes');
const { createLobbyRouter } = require('./lobby');
const { createSocketAuth } = require('./socketAuth');
const { requireTeacher } = require('./stubs');

module.exports = {
  createClassesRouter,
  createLobbyRouter,
  createSocketAuth,
  requireTeacher,
};
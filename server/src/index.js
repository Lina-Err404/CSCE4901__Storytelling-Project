const { createClassesRouter } = require('./classes');
const { createLobbyRouter } = require('./lobby');
const { createSocketAuth } = require('./socketAuth');
const { createRequireStudent, createRequireTeacher } = require('./auth');
module.exports = { createClassesRouter, createLobbyRouter, createSocketAuth, createRequireStudent, createRequireTeacher };

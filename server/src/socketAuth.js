const jwt = require('jsonwebtoken');

const STUDENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function createSocketAuth({ db, jwtSecret }) {
  return async function socketAuth(socket, next) {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string') {
        throw new Error('Invalid token');
      }

      const claims = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
      if (
        claims.role !== 'student' ||
        typeof claims.lobbyId !== 'string' ||
        typeof claims.studentId !== 'string' ||
        !STUDENT_ID_PATTERN.test(claims.studentId)
      ) {
        throw new Error('Invalid claims');
      }

      const lobbyRef = db.collection('lobbies').doc(claims.lobbyId);
      const lobbySnapshot = await lobbyRef.get();
      if (!lobbySnapshot.exists || lobbySnapshot.data().status === 'closed') {
        throw new Error('Unavailable lobby');
      }

      const seatSnapshot = await lobbyRef.collection('students').doc(claims.studentId).get();
      if (!seatSnapshot.exists || seatSnapshot.data().kicked === true) {
        throw new Error('Unavailable seat');
      }

      socket.data = {
        role: claims.role,
        lobbyId: claims.lobbyId,
        studentId: claims.studentId,
      };
      await socket.join(`lobby:${claims.lobbyId}`);
      return next();
    } catch (error) {
      return next(new Error('unauthorized'));
    }
  };
}

module.exports = { createSocketAuth };
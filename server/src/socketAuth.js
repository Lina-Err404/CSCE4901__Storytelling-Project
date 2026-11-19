const jwt = require('jsonwebtoken');

const STUDENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

function createSocketAuth({ supabase, db, jwtSecret }) {
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

      if (supabase && typeof supabase.from === 'function') {
        const { data: lobby, error: lobbyError } = await supabase
            .from('lobbies')
            .select('lobby_id, status')
            .eq('lobby_id', claims.lobbyId)
            .maybeSingle();

        if (lobbyError || !lobby || lobby.status === 'closed' || lobby.status === 'ended') {
          throw new Error('Unavailable lobby');
        }

        const { data: participant, error: participantError } = await supabase
            .from('lobby_participants')
            .select('student_id, status')
            .eq('lobby_id', claims.lobbyId)
            .eq('student_id', claims.studentId)
            .maybeSingle();

        if (
            participantError ||
            !participant ||
            participant.status === 'kicked' ||
            participant.status === 'removed'
        ) {
          throw new Error('Unavailable seat');
        }
      } else if (db && typeof db.collection === 'function') {
        const lobbyRef = db.collection('lobbies').doc(claims.lobbyId);
        const lobbySnapshot = await lobbyRef.get();
        if (!lobbySnapshot.exists || lobbySnapshot.data().status === 'closed') {
          throw new Error('Unavailable lobby');
        }

        const seatSnapshot = await lobbyRef
            .collection('students')
            .doc(claims.studentId)
            .get();
        if (!seatSnapshot.exists || seatSnapshot.data().kicked === true) {
          throw new Error('Unavailable seat');
        }
      } else {
        throw new Error('No database configured');
      }

      socket.data = {
        role: claims.role,
        lobbyId: claims.lobbyId,
        studentId: claims.studentId,
      };
      await socket.join(`lobby:${claims.lobbyId}`);
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  };
}

module.exports = { createSocketAuth };
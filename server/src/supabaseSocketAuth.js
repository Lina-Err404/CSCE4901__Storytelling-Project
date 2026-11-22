const jwt = require('jsonwebtoken');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function createSocketAuth({ supabase, jwtSecret }) {
  return async function socketAuth(socket, next) {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string') throw new Error('Invalid token');

      const claims = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
      if (
        claims.role !== 'student' ||
        typeof claims.lobbyId !== 'string' ||
        typeof claims.studentId !== 'string' ||
        !UUID_PATTERN.test(claims.lobbyId) ||
        !UUID_PATTERN.test(claims.studentId)
      ) {
        throw new Error('Invalid claims');
      }

      const lobbyResult = await supabase
        .from('lobbies')
        .select('status')
        .eq('lobby_id', claims.lobbyId)
        .maybeSingle();
      if (lobbyResult.error) throw lobbyResult.error;
      if (!lobbyResult.data || lobbyResult.data.status === 'closed') {
        throw new Error('Unavailable lobby');
      }

      const participantResult = await supabase
        .from('lobby_participants')
        .select('status')
        .eq('lobby_id', claims.lobbyId)
        .eq('student_id', claims.studentId)
        .maybeSingle();
      if (participantResult.error) throw participantResult.error;
      if (!participantResult.data || participantResult.data.status !== 'active') {
        throw new Error('Unavailable participant');
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

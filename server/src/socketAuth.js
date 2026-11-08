const jwt = require('jsonwebtoken');
const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function createSocketAuth({ db, jwtSecret }) {
  return async function socketAuth(socket, next) {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string') throw new Error('Invalid token');
      const claims = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
      if (claims.role !== 'student' || !UUID_PATTERN.test(claims.lobbyId || '') ||
          !UUID_PATTERN.test(claims.studentId || '')) throw new Error('Invalid claims');

      const { data: lobby, error: lobbyError } = await db.from('lobbies')
        .select('status').eq('lobby_id', claims.lobbyId).maybeSingle();
      const { data: seat, error: seatError } = await db.from('lobby_participants')
        .select('status').eq('lobby_id', claims.lobbyId)
        .eq('student_id', claims.studentId).maybeSingle();
      if (lobbyError || seatError || !lobby || lobby.status === 'closed' || !seat || seat.status !== 'active') {
        throw new Error('Unavailable lobby or seat');
      }
      socket.data = { role: 'student', lobbyId: claims.lobbyId, studentId: claims.studentId, lobbyStatus: (lobby.status === 'waiting' ? 'open' : lobby.status === 'active' ? 'locked' : lobby.status) };
      await socket.join(`lobby:${claims.lobbyId}`);
      next();
    } catch { next(new Error('unauthorized')); }
  };
}
module.exports = { createSocketAuth };

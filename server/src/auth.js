function createFirebaseAuthMiddleware({ admin, requiredRole, allowedRoles }) {
  return async function authenticate(req, res, next) {
    const authorization = req.get('authorization');
    const match = typeof authorization === 'string'
      ? authorization.match(/^Bearer\s+([^\s]+)$/i)
      : null;

    if (!match) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let claims;
    try {
      claims = await admin.auth().verifyIdToken(match[1]);
    } catch {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (typeof claims.uid !== 'string' || claims.uid.length === 0) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (requiredRole && claims.role !== requiredRole) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (allowedRoles && !allowedRoles.includes(claims.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    req.user = { uid: claims.uid, role: claims.role || null };
    return next();
  };
}

function createRequireTeacher(admin) {
  return createFirebaseAuthMiddleware({ admin, requiredRole: 'teacher' });
}

function createRequireStudent(admin) {
  return createFirebaseAuthMiddleware({ admin, allowedRoles: [undefined, 'student'] });
}

function createFirebaseSocketAuth(admin) {
  return async function verifySocketToken(socket, next) {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || token.length === 0) {
      return next(new Error('unauthorized'));
    }

    try {
      const claims = await admin.auth().verifyIdToken(token);
      if (typeof claims.uid !== 'string' || claims.uid.length === 0) {
        return next(new Error('unauthorized'));
      }
      socket.data.uid = claims.uid;
      socket.data.role = claims.role || null;
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  };
}

module.exports = { createFirebaseSocketAuth, createRequireStudent, createRequireTeacher };
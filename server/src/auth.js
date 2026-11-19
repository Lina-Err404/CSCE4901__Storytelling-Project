async function verifyTokenAndRole(clientOrAdmin, token) {
  // 1. Supabase client path
  if (typeof clientOrAdmin?.auth?.getUser === 'function') {
    const { data, error } = await clientOrAdmin.auth.getUser(token);
    if (error || !data?.user || typeof data.user.id !== 'string' || !data.user.id) {
      throw new Error('Invalid token');
    }

    const user = data.user;
    let role = user.app_metadata?.role || null;

    if (!role && typeof clientOrAdmin.from === 'function') {
      const { data: profile } = await clientOrAdmin
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
      if (profile?.role) {
        role = profile.role;
      }
    }

    return { uid: user.id, role };
  }

  throw new Error('Auth client is not configured');
}

function createAuthMiddleware({ client, requiredRole, allowedRoles }) {
  const devBypassEnabled =
      process.env.NODE_ENV !== 'production' &&
      process.env.ALLOW_DEV_MODE === 'true';

  return async function authenticate(req, res, next) {
    const authorization = req.get('authorization');
    const match =
        typeof authorization === 'string'
            ? authorization.match(/^Bearer\s+([^\s]+)$/i)
            : null;

    if (devBypassEnabled) {
      const devTeacherId = req.get('x-teacher-id');
      const devStudentId = req.get('x-test-student-uid');
      const devUid = devTeacherId || devStudentId;
      if (typeof devUid === 'string' && devUid.length > 0) {
        const role =
            requiredRole ||
            (allowedRoles && allowedRoles.includes('student') ? 'student' : 'teacher');
        req.user = { uid: devUid, role };
        return next();
      }
    }

    if (!match) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let verified;
    try {
      verified = await verifyTokenAndRole(client, match[1]);
    } catch {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (requiredRole && verified.role !== requiredRole) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (allowedRoles && !allowedRoles.includes(verified.role ?? undefined)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    req.user = { uid: verified.uid, role: verified.role || null };
    return next();
  };
}

function createRequireTeacher(client) {
  return createAuthMiddleware({ client, requiredRole: 'teacher' });
}

function createRequireStudent(client) {
  return createAuthMiddleware({ client, allowedRoles: [undefined, null, 'student'] });
}

function createSupabaseSocketAuth(client) {
  return async function verifySocketToken(socket, next) {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || token.length === 0) {
      return next(new Error('unauthorized'));
    }

    try {
      const verified = await verifyTokenAndRole(client, token);
      socket.data.uid = verified.uid;
      socket.data.role = verified.role || null;
      return next();
    } catch {
      return next(new Error('unauthorized'));
    }
  };
}

module.exports = {
  createSupabaseSocketAuth,
  createRequireStudent,
  createRequireTeacher,
};
function createAuthMiddleware({ verifier, db, requiredRole }) {
  return async function authenticate(req, res, next) {
    const match = req.get('authorization')?.match(/^Bearer\s+(\S+)$/i);
    if (!match) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const { data, error } = await verifier.auth.getUser(match[1]);
      if (error || !data.user) return res.status(401).json({ error: 'Unauthorized' });
      // Authoritative roles live in this project's existing profiles table.
      const { data: profile, error: profileError } = await db.from('profiles')
        .select('role').eq('id', data.user.id).maybeSingle();
      if (profileError) throw profileError;
      const role = profile?.role === 'teacher' ? 'teacher' : 'student';
      if (requiredRole && role !== requiredRole) return res.status(403).json({ error: 'Forbidden' });
      req.user = { uid: data.user.id, email: data.user.email || '', role };
      next();
    } catch (error) { next(error); }
  };
}
function createRequireTeacher(verifier, db) {
  return createAuthMiddleware({ verifier, db, requiredRole: 'teacher' });
}
function createRequireStudent(verifier, db) {
  return createAuthMiddleware({ verifier, db });
}
module.exports = { createRequireTeacher, createRequireStudent };

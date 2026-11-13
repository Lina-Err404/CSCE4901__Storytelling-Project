const { getSupabaseClient } = require('./supabase');

function createRequireSupabaseStudent({ getSupabase = getSupabaseClient } = {}) {
  return async function requireSupabaseStudent(req, res, next) {
    const authorization = req.get('authorization');
    const match = typeof authorization === 'string'
      ? authorization.match(/^Bearer\s+([^\s]+)$/i)
      : null;

    if (!match) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data, error } = await getSupabase().auth.getUser(match[1]);
    if (error) {
      if ([400, 401, 403].includes(error.status)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      return next(error);
    }

    if (typeof data?.user?.id !== 'string' || data.user.id.length === 0) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.user = { uid: data.user.id };
    return next();
  };
}

module.exports = { createRequireSupabaseStudent };

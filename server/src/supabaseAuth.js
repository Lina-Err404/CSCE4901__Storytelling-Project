

const { getSupabase } = require("./supabase");

function requireSupabaseTeacher(req, res, next) {
  const supabase = getSupabase();
  return createRequireTeacher(supabase)(req, res, next);
}

const VALID_ROLES = new Set(['student', 'teacher']);

function getDisplayName(user) {
  const metadataName = user.user_metadata?.display_name;
  if (typeof metadataName === 'string' && metadataName.trim()) {
    return metadataName.trim().slice(0, 50);
  }
  const emailName = typeof user.email === 'string' ? user.email.split('@')[0] : '';
  return emailName.trim().slice(0, 50) || 'Student';
}

async function getOrCreateProfile(supabase, user) {
  const existing = await supabase
    .from('profiles')
    .select('role, display_name')
    .eq('id', user.id)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const created = await supabase
    .from('profiles')
    .upsert(
      { id: user.id, display_name: getDisplayName(user), role: 'student' },
      { onConflict: 'id', ignoreDuplicates: true },
    );
  if (created.error) throw created.error;

  const profile = await supabase
    .from('profiles')
    .select('role, display_name')
    .eq('id', user.id)
    .single();
  if (profile.error) throw profile.error;
  return profile.data;
}

function createSupabaseAuthMiddleware({ supabase, requiredRole, allowedRoles }) {
  return async function authenticate(req, res, next) {
    const authorization = req.get('authorization');
    const match = typeof authorization === 'string'
      ? authorization.match(/^Bearer\s+([^\s]+)$/i)
      : null;

    if (!match) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const { data, error } = await supabase.auth.getUser(match[1]);
      if (error || !data.user?.id) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const profile = await getOrCreateProfile(supabase, data.user);
      if (!VALID_ROLES.has(profile.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (requiredRole && profile.role !== requiredRole) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (allowedRoles && !allowedRoles.includes(profile.role)) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      req.user = {
        uid: data.user.id,
        role: profile.role,
        displayName: profile.display_name,
      };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

function createRequireUser(supabase) {
  return createSupabaseAuthMiddleware({ supabase });
}

function createRequireTeacher(supabase) {
  return createSupabaseAuthMiddleware({ supabase, requiredRole: 'teacher' });
}

function createRequireStudent(supabase) {
  return createSupabaseAuthMiddleware({ supabase, requiredRole: 'student' });
}

module.exports = {
  requireSupabaseTeacher,
  createRequireStudent,
  createRequireTeacher,
  createRequireUser,
  createSupabaseAuthMiddleware,
};
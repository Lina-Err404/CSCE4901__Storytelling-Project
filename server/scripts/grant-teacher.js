// Run from repo root: node server/scripts/grant-teacher.js <SUPABASE_AUTH_USER_UUID>
// Only a trusted administrator with the service key should run this.
const { initializeSupabase } = require('../src/supabase');
const uid = process.argv[2];
if (!uid || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid)) {
  console.error('Usage: node server/scripts/grant-teacher.js <SUPABASE_AUTH_USER_UUID>');
  process.exit(1);
}
const { db } = initializeSupabase();
db.auth.admin.getUserById(uid).then(async ({ data, error }) => {
  if (error || !data.user) throw error || new Error('User not found');
  const existing = data.user.app_metadata || {};
  const result = await db.auth.admin.updateUserById(uid, {
    app_metadata: { ...existing, role: 'teacher' },
  });
  if (result.error) throw result.error;
  const name = [data.user.user_metadata?.first_name, data.user.user_metadata?.last_name]
    .filter(Boolean).join(' ').trim() || data.user.email?.split('@')[0] || 'Teacher';
  const { error: profileError } = await db.from('profiles').upsert(
    { id: uid, display_name: name, role: 'teacher' }, { onConflict: 'id' });
  if (profileError) throw profileError;
  console.log(`Teacher profile role granted to ${uid}.`);
}).catch((error) => { console.error(error.message); process.exitCode = 1; });

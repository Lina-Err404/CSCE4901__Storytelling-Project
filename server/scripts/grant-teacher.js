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
  const name = [data.user.user_metadata?.first_name, data.user.user_metadata?.last_name]
    .filter(Boolean).join(' ').trim() || data.user.email?.split('@')[0] || 'Teacher';
  const { error: insertError } = await db.from('profiles').upsert(
    { id: uid, display_name: [...name].slice(0, 50).join(''), role: 'teacher' },
    { onConflict: 'id', ignoreDuplicates: true });
  if (insertError) throw insertError;
  const { error: roleError } = await db.from('profiles').update({ role: 'teacher' }).eq('id', uid);
  if (roleError) throw roleError;
  console.log(`Teacher profile role granted to ${uid}.`);
}).catch((error) => { console.error(error.message); process.exitCode = 1; });

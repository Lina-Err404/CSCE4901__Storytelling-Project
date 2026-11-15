const { supabase } = require('./supabase');

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function grantTeacher(uid) {
  if (typeof uid !== 'string' || !UUID_PATTERN.test(uid.trim())) {
    throw new Error('Pass a valid Supabase Auth user UUID as the first argument');
  }

  const userId = uid.trim();

  if (supabase.auth?.admin) {
    const { data: userData, error: getUserError } =
        await supabase.auth.admin.getUserById(userId);
    if (!getUserError && userData?.user) {
      await supabase.auth.admin.updateUserById(userId, {
        app_metadata: {
          ...userData.user.app_metadata,
          role: 'teacher',
        },
      });
    }
  }

  const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ id: userId, role: 'teacher' }, { onConflict: 'id' });

  if (profileError) {
    throw new Error(`Could not update public.profiles: ${profileError.message}`);
  }

  console.log(`Granted teacher role to ${userId}`);
}

grantTeacher(process.argv[2]).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
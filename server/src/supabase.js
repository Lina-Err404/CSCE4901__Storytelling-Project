const { createClient } = require('@supabase/supabase-js');

let client;

function getSupabaseClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw Object.assign(new Error('Story database is not configured'), {
      status: 503,
      expose: true,
    });
  }

  if (!client) {
    client = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return client;
}

module.exports = { getSupabaseClient };
function getSupabase() {
    if (!supabase) {
        throw new Error("Missing supabase config");
    }

    return supabase;
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = supabaseUrl && serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
  : null;

module.exports = { supabase, getSupabase };

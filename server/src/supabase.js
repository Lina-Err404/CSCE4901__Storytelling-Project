const { createClient } = require('@supabase/supabase-js');

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
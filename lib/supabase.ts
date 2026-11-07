// Supabase client for Collab Storytelling.
// Values come from .env.local (never commit real keys).
// Use the PUBLISHABLE key here, never the secret key.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Add them to .env.local."
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);

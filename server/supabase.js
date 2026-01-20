const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE;

if (!supabaseUrl || !serviceRole) {
  throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE faltando no .env");
}

const supabase = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false }
});

module.exports = { supabase };

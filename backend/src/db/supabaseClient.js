const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseKey || !/^https?:\/\//i.test(supabaseUrl)) {
  console.warn(
    '[supabaseClient] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set to valid values. ' +
    'The API will still start, but database calls will fail until you fill in backend/.env.'
  );
}

const supabase = createClient(
  supabaseUrl || 'https://example.invalid',
  supabaseKey || 'placeholder-key',
  { auth: { persistSession: false } }
);

module.exports = supabase;

const path = require('path');
const dotenv = require('dotenv');

// Load .env from current directory, backend directory, or root
dotenv.config();
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../backend/.env') });

const { createClient } = require('@supabase/supabase-js');

// Clean and extract environment variables
const cleanEnv = (val) => {
  if (!val) return '';
  let str = String(val).trim();
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    str = str.slice(1, -1).trim();
  }
  return str;
};

const supabaseUrl = cleanEnv(process.env.SUPABASE_URL) || 'https://dummy.supabase.co';
// Use the service role key to bypass RLS since the backend is a trusted environment
const supabaseKey = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) || cleanEnv(process.env.SUPABASE_KEY) || 'dummy';

if (!cleanEnv(process.env.SUPABASE_URL) || !cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
  console.warn('WARNING: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are not set!');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

module.exports = supabase;


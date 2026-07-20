require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

async function main() {
  const { data: users, error } = await supabase.from('users').select('*').limit(5);
  if (error) {
    console.error('Fetch Users Error:', error);
  } else {
    console.log('Users found:', users);
  }
}

main();

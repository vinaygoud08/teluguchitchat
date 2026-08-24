require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listBuckets() {
  const { data, error } = await supabase.storage.listBuckets();
  console.log('Buckets:', data);
  if (error) console.log('Error:', error);
}

listBuckets();

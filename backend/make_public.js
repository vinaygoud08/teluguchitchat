require('dotenv').config({ path: '.env' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function makePublic() {
  const { data, error } = await supabase.storage.updateBucket('abcd', {
    public: true
  });
  console.log('Update Data:', data);
  if (error) console.log('Update Error:', error);
}

makePublic();

require('dotenv').config();
const supabase = require('./supabaseClient');

async function test() {
  const { data, error } = await supabase.from('users').select('*').limit(1);
  if (error) console.error(error);
  else console.log(Object.keys(data[0] || {}));
}
test();

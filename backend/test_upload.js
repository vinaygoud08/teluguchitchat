const supabase = require('./supabaseClient');

async function testUpload() {
  const { data, error } = await supabase.storage
    .from('abcd')
    .upload('test_file.txt', Buffer.from('hello world'), {
      contentType: 'text/plain',
      upsert: true
    });
    
  console.log('Upload Data:', data);
  console.log('Upload Error:', error);
}

testUpload();

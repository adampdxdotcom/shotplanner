const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');
fs.writeFileSync('large.txt', Buffer.alloc(2 * 1024 * 1024)); // 2MB
async function run() {
  const form = new FormData();
  form.append('file', fs.createReadStream('large.txt'));
  form.append('media_type', 'image');
  form.append('type', 'Test');
  form.append('subject_name', 'Subject');
  
  const res = await fetch('http://localhost:3000/api/assets/upload', {
    method: 'POST',
    body: form
  });
  console.log(res.status, res.headers.get('content-type'));
  const text = await res.text();
  console.log(text.substring(0, 100));
}
run();

const fs = require('fs');
fs.writeFileSync('dummy.txt', 'hello');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function run() {
  const form = new FormData();
  form.append('file', fs.createReadStream('dummy.txt'));
  form.append('media_type', 'image');
  form.append('type', 'Test');
  form.append('subject_name', 'Subject');
  
  const res = await fetch('http://localhost:3000/api/assets/upload', {
    method: 'POST',
    body: form
  });
  console.log(res.status, res.headers.get('content-type'));
  const text = await res.text();
  console.log(text);
}
run();

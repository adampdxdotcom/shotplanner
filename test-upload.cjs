const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function test() {
  const form = new FormData();
  form.append('media_type', 'image');
  form.append('type', 'Headshot');
  form.append('subject_name', 'jackie');
  form.append('description', 'test image');
  form.append('file', fs.readFileSync('package.json'), {
    filename: 'package.json',
    contentType: 'application/json'
  });

  try {
    const res = await fetch('http://localhost:3000/api/assets/upload', {
      method: 'POST',
      body: form
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (err) {
    console.error(err);
  }
}
test();

const fetch = require('node-fetch');
const FormData = require('form-data');
const fs = require('fs');

async function run() {
  fs.writeFileSync('test-chunk.txt', 'chunk1 data');
  const form = new FormData();
  form.append('file', fs.createReadStream('test-chunk.txt'));
  form.append('upload_id', 'test1234');
  form.append('chunk_index', '0');
  form.append('total_chunks', '2');
  form.append('original_name', 'test.txt');
  
  const res = await fetch('http://localhost:3000/api/assets/upload_chunk', {
    method: 'POST',
    body: form
  });
  console.log('Status 1:', res.status);
  console.log('Body 1:', await res.text());

  fs.writeFileSync('test-chunk2.txt', 'chunk2 data');
  const form2 = new FormData();
  form2.append('file', fs.createReadStream('test-chunk2.txt'));
  form2.append('upload_id', 'test1234');
  form2.append('chunk_index', '1');
  form2.append('total_chunks', '2');
  form2.append('original_name', 'test.txt');
  
  const res2 = await fetch('http://localhost:3000/api/assets/upload_chunk', {
    method: 'POST',
    body: form2
  });
  console.log('Status 2:', res2.status);
  console.log('Body 2:', await res2.text());
}
run();

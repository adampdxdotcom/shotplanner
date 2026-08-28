import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

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
    body: form,
  });
  console.log('Status 1:', res.status);
  console.log('Body 1:', await res.text());
}
run();

import fs from 'fs';
let code = fs.readFileSync('src/components/AssetManagerSection.tsx', 'utf-8');
code = code.replace(
  'throw new Error(data.error || "Failed to upload file chunk.");',
  'throw new Error(data.error || data.message || data.err || `Failed to upload chunk. Server responded with ${res.status}: ${JSON.stringify(data)}`);'
);
fs.writeFileSync('src/components/AssetManagerSection.tsx', code);

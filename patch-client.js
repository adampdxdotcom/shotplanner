import fs from 'fs';
let code = fs.readFileSync('src/components/AssetManagerSection.tsx', 'utf-8');
code = code.replace(
  'formData.append("file", chunk);',
  'formData.append("file", chunk, file.name);'
);
fs.writeFileSync('src/components/AssetManagerSection.tsx', code);

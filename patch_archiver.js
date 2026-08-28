import fs from 'fs';
let serverCode = fs.readFileSync('server.ts', 'utf-8');

serverCode = serverCode.replace(
  'import archiver from "archiver";',
  'import { ZipArchive } from "archiver";'
);

serverCode = serverCode.replace(
  'const archive = archiver("zip", { zlib: { level: 9 } });',
  'const archive = new ZipArchive({ zlib: { level: 9 } });'
);

fs.writeFileSync('server.ts', serverCode);

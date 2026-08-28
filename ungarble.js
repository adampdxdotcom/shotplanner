import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');
// Fix the literal '\n'
code = code.split('\\n').join('\n');
fs.writeFileSync('server.ts', code);

import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');
code = code.replace(
  '    console.error("Chunk upload error:", err);\n    res.status(500).json({ error: err.message });',
  '    console.error("Chunk upload error:", err);\n    res.status(500).json({ error: err ? (err.message || String(err)) : "Unknown chunk error" });'
);
fs.writeFileSync('server.ts', code);

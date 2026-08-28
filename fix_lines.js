import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

const lines = code.split('\n');

for (let i = 0; i < lines.length; i++) {
  if (lines[i] === '      const lines = ["Global Subject Definitions:') {
    lines[i] = '      const lines = ["Global Subject Definitions:\\n"];';
    lines[i+1] = ''; // remove the hanging `"];`
  }
}

code = lines.join('\n');

code = code.replace(
  'Please expand this basic stub into a structured MiniMax-H3 prompt. Begin with the "Global Subject Definitions:" header defined above, followed by alignment instructions (if applicable), integrated_multimodal_description, overall_soundscape, and non_diegetic_music.`;',
  '\\nPlease expand this basic stub into a structured MiniMax-H3 prompt. Begin with the "Global Subject Definitions:" header defined above, followed by alignment instructions (if applicable), integrated_multimodal_description, overall_soundscape, and non_diegetic_music.`;'
);

code = code.replace(
  'const userMessage = `USER BASIC STUB / CONCEPT:\n"${basic_stub}"\n\n### SELECTED REFERENCE ASSETS:\n${definitionsHeader || "No reference assets provided."}\n\n\\nPlease expand',
  'const userMessage = `USER BASIC STUB / CONCEPT:\\n"${basic_stub}"\\n\\n### SELECTED REFERENCE ASSETS:\\n${definitionsHeader || "No reference assets provided."}\\n\\nPlease expand'
);

code = code.replace(
  'return lines.join("\n") + "\n\n";',
  'return lines.join("\\n") + "\\n\\n";'
);


fs.writeFileSync('server.ts', code);

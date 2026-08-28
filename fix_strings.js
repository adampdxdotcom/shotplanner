import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

// Fix string literal 1
code = code.replace(
  'const lines = ["Global Subject Definitions:\n"];',
  'const lines = ["Global Subject Definitions:\\n"];'
);

// Fix string literal 2 (the prompt one)
const badPrompt = 'generatedPrompt = `${definitionsHeader}integrated_multimodal_description: [Shot 1] Live-action, cinematic 4K sequence capturing ${basic_stub.trim()}. Featuring ${tagsList || \'<Picture 1>\'} with authentic facial expressions, realistic skin texture, and seamless character identity preservation. The camera pushes in with small amplitude at slow speed.\n\noverall_soundscape: Soft room ambience and atmospheric audio.\n\nnon_diegetic_music: None`;';

code = code.replace(
  /generatedPrompt = `\$\{definitionsHeader\}integrated_multimodal_description: \[Shot 1\] Live-action, cinematic 4K sequence capturing \$\{basic_stub\.trim\(\)\}\. Featuring \$\{tagsList \|\| '<Picture 1>'\} with authentic facial expressions, realistic skin texture, and seamless character identity preservation\. The camera pushes in with small amplitude at slow speed\.\n\noverall_soundscape: Soft room ambience and atmospheric audio\.\n\nnon_diegetic_music: None`;/,
  "generatedPrompt = `${definitionsHeader}integrated_multimodal_description: [Shot 1] Live-action, cinematic 4K sequence capturing ${basic_stub.trim()}. Featuring ${tagsList || '<Picture 1>'} with authentic facial expressions, realistic skin texture, and seamless character identity preservation. The camera pushes in with small amplitude at slow speed.\\n\\noverall_soundscape: Soft room ambience and atmospheric audio.\\n\\nnon_diegetic_music: None`;"
);

fs.writeFileSync('server.ts', code);

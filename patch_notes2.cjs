const fs = require('fs');
let content = fs.readFileSync('projectnotes/filebreakdown.txt', 'utf-8');

const targetStr = '- **`server/services/headshotService.ts`**\n  - Implemented `HEADSHOT_TEMPLATES` constant block explicitly defining visual directives for presets ("Facing", "3/4 Profile", "Full Profile", "Cinematic / Mood") demanding maximum quality and likeness preservation.';

const replacementStr = '- **`server/services/headshotService.ts`**\n  - Implemented `HEADSHOT_TEMPLATES` constant block explicitly defining visual directives for presets ("Facing", "3/4 Profile", "Full Profile", "Cinematic / Mood") demanding maximum quality and likeness preservation.\n  - **Updates:** Updated templates across all presets to strictly instruct the generation model to place every subject against an isolated, seamless, pure solid white background ("on a pure solid white studio backdrop, isolated on clean white background, studio lighting").';

content = content.replace(targetStr, replacementStr);
fs.writeFileSync('projectnotes/filebreakdown.txt', content);

import fs from 'fs';
let code = fs.readFileSync('src/components/AssetManagerSection.tsx', 'utf-8');

const regex = /<button\\s*onClick=\{\\(\\) => handleDelete\\(asset\\.filename\\)\\}\\s*className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"\\s*title="Delete asset"\\s*>\\s*<Trash2 className="w-3\\.5 h-3\\.5" \/>\\s*<\/button>\\s*<\/div>/g;

// there are two matches now. We want to remove the second one.
let matchCount = 0;
code = code.replace(regex, (match) => {
  matchCount++;
  if (matchCount === 2) {
    return ''; // remove the leftover one
  }
  return match; // keep the one in the new flex container
});

fs.writeFileSync('src/components/AssetManagerSection.tsx', code);

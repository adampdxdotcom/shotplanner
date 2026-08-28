import fs from 'fs';
let code = fs.readFileSync('src/components/AssetManagerSection.tsx', 'utf-8');
const lines = code.split('\\n');

// Find where "div" closes the preview block
// Then remove the leftover button block

let newLines = [];
let skip = false;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('<button') && lines[i+1] && lines[i+1].includes('onClick={() => handleDelete(asset.filename)}') && lines[i+2] && lines[i+2].includes('className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"')) {
    // Check if this is the leftover one (if we already saw the first one inside flex items-center gap-1)
    if (lines[i-1].includes('gap-1')) {
      // First one, keep it
    } else {
      // Second one, remove lines until </div>
      skip = true;
    }
  }
  
  if (skip) {
    if (lines[i].includes('</div>')) {
      skip = false; // done skipping
    }
    continue;
  }
  
  newLines.push(lines[i]);
}

fs.writeFileSync('src/components/AssetManagerSection.tsx', newLines.join('\\n'));

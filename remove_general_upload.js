import fs from 'fs';

let content = fs.readFileSync('src/components/AssetManagerSection.tsx', 'utf8');

const regex = /\{\/\* Header \*\/\}.*?\{\/\* Uploaded Assets Grid \*\/\}/s;

const newHeader = `{/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">1. Segmented Asset Management</h2>
            <p className="text-xs text-zinc-400">Click on an empty slot below to upload and configure semantic metadata. Auto-renames to format <code className="text-zinc-300">{\`{type}_{name}_{timestamp}.ext\`}</code>.</p>
          </div>
        </div>
      </div>

      {/* Uploaded Assets Grid */}`;

content = content.replace(regex, newHeader);

fs.writeFileSync('src/components/AssetManagerSection.tsx', content);

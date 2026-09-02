const fs = require('fs');
const file = 'src/components/cast/AiReferenceStagingStudioModal.tsx';
const content = fs.readFileSync(file, 'utf-8');
const lines = content.split('\n');

const startIdx = lines.findIndex(l => l.includes('{activeTab === "headshots" && ('));
const endIdx = lines.findIndex((l, i) => i > startIdx && l.includes('          {/* ========================================== */}')) - 1; // get the )} line before TAB 2

console.log(`Replacing from ${startIdx} to ${endIdx}`);

const newContent = [
  ...lines.slice(0, startIdx),
  '          {activeTab === "headshots" && (',
  '            <HeadshotGeneratorTab',
  '              activeSubject={activeSubject}',
  '              activeScene={activeScene}',
  '              currentCharacterAssets={currentCharacterAssets}',
  '              onAssetSaved={onAssetSaved}',
  '              addToast={addToast}',
  '              onClose={onClose}',
  '            />',
  '          )}',
  ...lines.slice(endIdx + 1)
].join('\n');

fs.writeFileSync(file, newContent);

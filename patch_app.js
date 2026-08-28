import fs from 'fs';
let appCode = fs.readFileSync('src/App.tsx', 'utf-8');

appCode = appCode.replace(
  'const handleAssetDeleted = (filename: string) => {',
  `const handleAssetUpdated = (oldFilename: string, newAsset: MediaAsset) => {
    setAssets(prev => prev.map(a => a.filename === oldFilename ? newAsset : a));
    // Update nodeMappings if the filename changed
    if (oldFilename !== newAsset.filename) {
      setNodeMappings(prev => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[key] === oldFilename) next[key] = newAsset.filename;
        }
        return next;
      });
    }
  };

  const handleAssetDeleted = (filename: string) => {`
);

appCode = appCode.replace(
  'onAssetDeleted={handleAssetDeleted}',
  'onAssetDeleted={handleAssetDeleted}\n            onAssetUpdated={handleAssetUpdated}'
);

fs.writeFileSync('src/App.tsx', appCode);

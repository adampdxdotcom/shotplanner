import fs from 'fs';

let content = fs.readFileSync('src/components/AssetManagerSection.tsx', 'utf8');

content = content.replace(
  'if (finalData && finalData.asset) {\n        onAssetUploaded(finalData.asset);\n      } else {',
  'if (finalData && finalData.asset) {\n        onAssetUploaded(finalData.asset);\n        closeUploadModal();\n      } else {'
);

fs.writeFileSync('src/components/AssetManagerSection.tsx', content);

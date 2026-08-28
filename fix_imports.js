import fs from 'fs';
let code = fs.readFileSync('src/components/AssetManagerSection.tsx', 'utf-8');

code = code.replace(
  'import {\n  Edit3,\n  Maximize,\n  X, MediaAsset, AssetType } from "../types";\nimport { \n  HardDrive,',
  'import { MediaAsset, AssetType } from "../types";\nimport { \n  Edit3,\n  Maximize,\n  X,\n  HardDrive,'
);

fs.writeFileSync('src/components/AssetManagerSection.tsx', code);

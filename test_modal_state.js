import fs from 'fs';

let content = fs.readFileSync('src/components/AssetManagerSection.tsx', 'utf8');

content = content.replace(
  'const [uploadError, setUploadError] = useState<string | null>(null);',
  'const [uploadError, setUploadError] = useState<string | null>(null);\n  const [uploadModalSlot, setUploadModalSlot] = useState<{ type: "image" | "audio" | "video", index: number } | null>(null);'
);

fs.writeFileSync('src/components/AssetManagerSection.tsx', content);

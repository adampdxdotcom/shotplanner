import fs from 'fs';
let serverCode = fs.readFileSync('server.ts', 'utf-8');

const putRoute = `
// 6.b Update Asset (Metadata only)
app.put("/api/assets/:filename", express.json(), (req: Request, res: Response) => {
  const { filename } = req.params;
  const { type, subject_name, description } = req.body;
  const asset = assetDatabase.find(a => a.filename === filename);
  if (!asset) return res.status(404).json({ error: "Asset not found" });

  asset.type = type || asset.type;
  asset.subject_name = subject_name || asset.subject_name;
  asset.description = description !== undefined ? description : asset.description;
  
  res.json({ success: true, asset });
});
`;

serverCode = serverCode.replace('// 6. Delete Asset', putRoute + '\n// 6. Delete Asset');

// modify upload_chunk to support replacing an existing asset
const chunkUploadLogic = `
        const assetRecord: AssetRecord = {
          id: targetFilename,
          original_name: original_name || "unknown",
          filename: targetFilename,
          media_type: media_type as "image" | "audio" | "video",
          type: type || "unknown",
          subject_name: subject_name || "subject",
          description: description || "",
          size_bytes: stats.size,
          created_at: Date.now(),
          preview_url: \`/assets/uploads/\${targetFilename}\`
        };

        const replaceFilename = req.body.replace_filename;
        if (replaceFilename) {
          const oldIndex = assetDatabase.findIndex(a => a.filename === replaceFilename);
          if (oldIndex !== -1) {
             const oldPath = path.join(UPLOADS_DIR, replaceFilename);
             if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
             assetDatabase[oldIndex] = assetRecord;
          } else {
             assetDatabase.unshift(assetRecord);
          }
        } else {
          assetDatabase.unshift(assetRecord);
        }

        return res.json({
`;

serverCode = serverCode.replace(/const assetRecord: AssetRecord = \{[\s\S]*?assetDatabase.unshift\(assetRecord\);\s+return res.json\(\{/, chunkUploadLogic);


fs.writeFileSync('server.ts', serverCode);

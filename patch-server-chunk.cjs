const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const newEndpoint = `
// 6.b Chunked File Upload
app.post("/api/assets/upload_chunk", upload.single("file"), (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No chunk provided" });

    const { upload_id, chunk_index, total_chunks, original_name } = req.body;
    if (!upload_id || chunk_index === undefined || !total_chunks) {
      return res.status(400).json({ error: "Missing chunk metadata" });
    }

    const chunkIndex = parseInt(chunk_index, 10);
    const totalChunks = parseInt(total_chunks, 10);
    
    const tempAssemblyPath = path.join(TMP_UPLOAD_DIR, upload_id);
    
    // Append chunk to the assembly file
    const chunkData = fs.readFileSync(req.file.path);
    fs.appendFileSync(tempAssemblyPath, chunkData);
    fs.unlinkSync(req.file.path); // remove the multer temp chunk

    if (chunkIndex === totalChunks - 1) {
      // Final chunk received, assemble and finalize
      const mediaType = (req.body.media_type || "image") as "image" | "audio" | "video";
      const assetType = req.body.type || "headshot";
      const subjectName = req.body.subject_name || "subject";
      const description = req.body.description || "";

      const cleanType = sanitizeSlug(assetType);
      const cleanName = sanitizeSlug(subjectName);
      const timestamp = Math.floor(Date.now() / 1000);
      const ext = path.extname(original_name || req.file.originalname) || (mediaType === "image" ? ".png" : mediaType === "audio" ? ".mp3" : ".mp4");
      
      const targetFilename = \`\${cleanType}_\${cleanName}_\${timestamp}\${ext}\`;
      const destinationPath = path.join(UPLOADS_DIR, targetFilename);

      // Move the fully assembled file
      fs.copyFileSync(tempAssemblyPath, destinationPath);
      const stats = fs.statSync(tempAssemblyPath);
      fs.unlinkSync(tempAssemblyPath);

      const assetRecord: AssetRecord = {
        id: targetFilename,
        original_name: original_name || req.file.originalname,
        filename: targetFilename,
        media_type: mediaType,
        type: assetType,
        subject_name: subjectName,
        description,
        size_bytes: stats.size,
        created_at: Date.now(),
        preview_url: \`/assets/uploads/\${targetFilename}\`
      };

      assetDatabase.unshift(assetRecord);

      return res.json({
        success: true,
        asset: assetRecord
      });
    }

    // Acknowledge chunk
    return res.json({ success: true, message: "chunk received" });

  } catch (err: any) {
    console.error("Chunk upload error:", err);
    res.status(500).json({ error: err.message });
  }
});
`;

code = code.replace(
  '// 7. LM Studio Prompt Expansion ("Generate from Stub")',
  newEndpoint + '\n// 7. LM Studio Prompt Expansion ("Generate from Stub")'
);

fs.writeFileSync('server.ts', code);

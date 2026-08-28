import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

// The route starts at 'app.post("/api/assets/upload_chunk"'
// Let's replace the whole app.post("/api/assets/upload_chunk" ... });
const routeStart = 'app.post("/api/assets/upload_chunk"';

const correctChunkCode = `
app.post("/api/assets/upload_chunk", upload.single("file"), (req: Request, res: Response) => {
  try {
    const { upload_id, chunk_index, total_chunks, original_name, media_type, type, subject_name, description, replace_filename } = req.body;
    
    if (!upload_id) return res.status(400).json({ error: "Missing upload_id" });
    if (!req.file) return res.status(400).json({ error: "No chunk file" });

    if (!uploadChunks.has(upload_id)) {
      uploadChunks.set(upload_id, new Array(parseInt(total_chunks)).fill(""));
    }

    const chunkArray = uploadChunks.get(upload_id)!;
    const chunkPath = path.join(UPLOADS_DIR, \`\${upload_id}_\${chunk_index}\`);
    fs.copyFileSync(req.file.path, chunkPath);
    fs.unlinkSync(req.file.path);
    chunkArray[parseInt(chunk_index)] = chunkPath;

    const isFinalChunk = chunkArray.every((cp) => cp !== "");

    if (isFinalChunk) {
      const cleanType = sanitizeSlug(type || "asset");
      const cleanName = sanitizeSlug(subject_name || "subject");
      const timestamp = Math.floor(Date.now() / 1000);
      const ext = path.extname(original_name || "") || "";
      const targetFilename = \`\${cleanType}_\${cleanName}_\${timestamp}\${ext}\`;
      const finalPath = path.join(UPLOADS_DIR, targetFilename);

      const writeStream = fs.createWriteStream(finalPath);
      for (const cp of chunkArray) {
        const data = fs.readFileSync(cp);
        writeStream.write(data);
        fs.unlinkSync(cp);
      }
      writeStream.end();

      writeStream.on("finish", () => {
        uploadChunks.delete(upload_id);
        const stats = fs.statSync(finalPath);

        const assetRecord: AssetRecord = {
          id: targetFilename,
          original_name: original_name || "unknown",
          filename: targetFilename,
          media_type: (media_type as "image" | "audio" | "video") || "image",
          type: type || "unknown",
          subject_name: subject_name || "subject",
          description: description || "",
          size_bytes: stats.size,
          created_at: Date.now(),
          preview_url: \`/assets/uploads/\${targetFilename}\`
        };

        if (replace_filename) {
          const oldIndex = assetDatabase.findIndex(a => a.filename === replace_filename);
          if (oldIndex !== -1) {
             const oldPath = path.join(UPLOADS_DIR, replace_filename);
             if (fs.existsSync(oldPath)) {
               try { fs.unlinkSync(oldPath); } catch (e) {}
             }
             assetDatabase[oldIndex] = assetRecord;
          } else {
             assetDatabase.unshift(assetRecord);
          }
        } else {
          assetDatabase.unshift(assetRecord);
        }

        return res.json({ success: true, asset: assetRecord });
      });

      writeStream.on("error", (err) => {
        throw err;
      });
      return;
    }

    return res.json({ success: true, message: "chunk received" });
  } catch (err: any) {
    console.error("Chunk upload error:", err);
    res.status(500).json({ error: err ? (err.message || String(err)) : "Unknown chunk error" });
  }
});
`;

const startIndex = code.indexOf(routeStart);
const endIndex = code.indexOf('// 7. LM Studio Prompt Expansion');

if (startIndex !== -1 && endIndex !== -1) {
  code = code.substring(0, startIndex) + correctChunkCode + '\n' + code.substring(endIndex);
}

fs.writeFileSync('server.ts', code);

import re

with open("server/services/assetService.ts", "r") as f:
    content = f.read()

# Replace class AssetService methods
r_class = """class AssetService {
  private uploadChunks = new Map<string, string[]>();

  constructor() {}
  public loadAssetDatabase(): void {}
  public saveAssetDatabase(): void {}
  public getRawDatabase(): AssetRecord[] { return []; }
  
  public getAssetFilePath(filename: string): string | null {
    const dirsToScan = [
      ASSETS_DIR,
      path.join(ASSETS_DIR, "shared")
    ];
    // Also include all subdirs
    if (fs.existsSync(ASSETS_DIR)) {
      const items = fs.readdirSync(ASSETS_DIR, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory() && item.name !== "project_jsons") {
          dirsToScan.push(path.join(ASSETS_DIR, item.name, "images"));
          dirsToScan.push(path.join(ASSETS_DIR, item.name, "videos"));
          dirsToScan.push(path.join(ASSETS_DIR, item.name, "audios"));
          dirsToScan.push(path.join(ASSETS_DIR, item.name, "shared"));
        }
      }
    }
    dirsToScan.push(LEGACY_IMAGES_DIR, LEGACY_VIDEOS_DIR, LEGACY_AUDIOS_DIR, LEGACY_UPLOADS_DIR);
    
    for (const dir of dirsToScan) {
      if (fs.existsSync(dir)) {
        const p = path.join(dir, filename);
        if (fs.existsSync(p)) return p;
      }
    }
    return null;
  }
  
  public getAllAssets(sceneName?: string): AssetRecord[] {
    const assets: AssetRecord[] = [];
    const seen = new Set<string>();

    const dirsToScan = [];
    if (sceneName) {
      const sceneDirs = ensureSceneDirectories(sceneName);
      dirsToScan.push(sceneDirs.images, sceneDirs.videos, sceneDirs.audios, sceneDirs.shared);
    }
    const globalShared = path.join(ASSETS_DIR, "shared");
    dirsToScan.push(globalShared);

    if (!sceneName) {
      dirsToScan.push(LEGACY_IMAGES_DIR, LEGACY_VIDEOS_DIR, LEGACY_AUDIOS_DIR, LEGACY_UPLOADS_DIR);
    }

    for (const dir of dirsToScan) {
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        for (const file of files) {
          if (file.isFile() && file.name !== ".DS_Store" && file.name !== "empty.png") {
            if (seen.has(file.name)) continue;
            seen.add(file.name);
            const ext = path.extname(file.name).toLowerCase();
            let mediaType = "image";
            if (/\\.(mp4|mov|webm|mkv|avi)$/i.test(ext)) mediaType = "video";
            else if (/\\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(ext)) mediaType = "audio";
            
            let size = 0;
            let mtime = Date.now();
            try {
              const stats = fs.statSync(path.join(dir, file.name));
              size = stats.size;
              mtime = stats.mtimeMs;
            } catch(e) {}
            
            assets.push({
              id: file.name,
              filename: file.name,
              original_name: file.name,
              media_type: mediaType as any,
              type: "unknown",
              subject_name: "subject",
              description: "",
              size_bytes: size,
              created_at: mtime,
              preview_url: `/api/uploads/${file.name}`,
              scene_name: sceneName || "unknown",
              path: path.join(dir, file.name)
            });
          }
        }
      }
    }
    return assets;
  }
  
  public upsertAsset(record: AssetRecord, replaceFilename?: string): AssetRecord {
    if (replaceFilename) {
      const oldPath = this.getAssetFilePath(replaceFilename);
      if (oldPath && fs.existsSync(oldPath)) {
        try { fs.unlinkSync(oldPath); } catch (e) {}
      }
    }
    return record;
  }
  
  public deleteAsset(filename: string): boolean {
    const foundPath = this.getAssetFilePath(filename);
    if (foundPath && fs.existsSync(foundPath)) {
      try {
        fs.unlinkSync(foundPath);
        return true;
      } catch (e) {}
    }
    return false;
  }
  
  public updateAssetMetadata(
    filename: string,
    updates: { type?: string; subject_name?: string; description?: string }
  ): AssetRecord | null {
    return {
      id: filename,
      filename,
      original_name: filename,
      media_type: "image",
      type: updates.type || "unknown",
      subject_name: updates.subject_name || "subject",
      description: updates.description || "",
      size_bytes: 0,
      created_at: Date.now(),
      preview_url: `/api/uploads/${filename}`,
      path: ""
    };
  }
  
  public handleSingleFileUpload(
    file: Express.Multer.File,
    meta: {
      media_type?: string;
      type?: string;
      subject_name?: string;
      description?: string;
      slot_index?: string | number;
      scene_name?: string;
    }
  ): AssetRecord {
    const mediaType = (meta.media_type || "image") as "image" | "audio" | "video";
    const assetType = meta.type || "headshot";
    const subjectName = meta.subject_name || "subject";
    const description = meta.description || "";
    const sceneName = meta.scene_name || "scene01";
    const cleanType = sanitizeSlug(assetType);
    const cleanName = sanitizeSlug(subjectName);
    const timestamp = Math.floor(Date.now() / 1000);
    const ext =
      path.extname(file.originalname) ||
      (mediaType === "image" ? ".png" : mediaType === "audio" ? ".mp3" : ".mp4");
    const targetFilename = `${cleanType}_${cleanName}_${timestamp}${ext}`;

    const sceneDirs = ensureSceneDirectories(sceneName);
    let targetDir = sceneDirs.images;
    if (mediaType === "video" || ext.match(/\\.(mp4|mov|webm|mkv|avi)$/i)) {
      targetDir = sceneDirs.videos;
    } else if (mediaType === "audio" || ext.match(/\\.(mp3|wav|ogg|flac|aac|m4a)$/i)) {
      targetDir = sceneDirs.audios;
    } else if (mediaType === "image" || ext.match(/\\.(png|jpg|jpeg|webp|gif|bmp)$/i)) {
      targetDir = sceneDirs.images;
    } else {
      targetDir = sceneDirs.shared || sceneDirs.images;
    }

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const destinationPath = path.join(targetDir, targetFilename);
    fs.copyFileSync(file.path, destinationPath);
    try {
      fs.unlinkSync(file.path);
    } catch (e) {}
    
    const parsedSlotIndex =
      meta.slot_index !== undefined &&
      meta.slot_index !== null &&
      meta.slot_index !== "" &&
      !isNaN(parseInt(String(meta.slot_index)))
        ? parseInt(String(meta.slot_index))
        : undefined;
        
    return {
      id: targetFilename,
      original_name: file.originalname,
      filename: targetFilename,
      media_type: mediaType,
      type: assetType,
      subject_name: subjectName,
      description,
      size_bytes: file.size,
      created_at: Date.now(),
      preview_url: `/api/uploads/${targetFilename}`,
      slot_index: parsedSlotIndex,
      scene_name: sceneName,
      path: destinationPath
    };
  }

  public handleChunkUpload(
    chunkFile: Express.Multer.File,
    payload: {
      upload_id: string;
      chunk_index: string | number;
      total_chunks: string | number;
      original_name?: string;
      media_type?: string;
      type?: string;
      subject_name?: string;
      description?: string;
      replace_filename?: string;
      slot_index?: string | number;
      scene_name?: string;
    }
  ): Promise<{ complete: boolean; asset?: AssetRecord }> {
    return new Promise((resolve, reject) => {
      const {
        upload_id,
        chunk_index,
        total_chunks,
        original_name,
        media_type,
        type,
        subject_name,
        description,
        replace_filename,
        slot_index,
        scene_name
      } = payload;
      const chunkIdx = parseInt(String(chunk_index));
      const total = parseInt(String(total_chunks));
      if (!this.uploadChunks.has(upload_id)) {
        this.uploadChunks.set(upload_id, new Array(total).fill(""));
      }
      const chunkArray = this.uploadChunks.get(upload_id)!;
      const chunksTempDir = path.join(TMP_DIR, "chunks");
      if (!fs.existsSync(chunksTempDir)) {
        fs.mkdirSync(chunksTempDir, { recursive: true });
      }
      const chunkPath = path.join(chunksTempDir, `${upload_id}_${chunkIdx}`);
      fs.copyFileSync(chunkFile.path, chunkPath);
      try {
        fs.unlinkSync(chunkFile.path);
      } catch (e) {}
      chunkArray[chunkIdx] = chunkPath;
      const isFinalChunk = chunkArray.every((cp) => cp !== "");
      if (!isFinalChunk) {
        return resolve({ complete: false });
      }
      
      const cleanType = sanitizeSlug(type || "asset");
      const cleanName = sanitizeSlug(subject_name || "subject");
      const timestamp = Math.floor(Date.now() / 1000);
      const ext = path.extname(original_name || "") || "";
      const targetFilename = `${cleanType}_${cleanName}_${timestamp}${ext}`;
      const resolvedSceneName = scene_name || "scene01";
      const sceneDirs = ensureSceneDirectories(resolvedSceneName);
      const mType = (media_type as "image" | "audio" | "video") || "image";
      let targetDir = sceneDirs.images;
      if (mType === "video" || ext.match(/\\.(mp4|mov|webm|mkv|avi)$/i)) {
        targetDir = sceneDirs.videos;
      } else if (mType === "audio" || ext.match(/\\.(mp3|wav|ogg|flac|aac|m4a)$/i)) {
        targetDir = sceneDirs.audios;
      } else if (mType === "image" || ext.match(/\\.(png|jpg|jpeg|webp|gif|bmp)$/i)) {
        targetDir = sceneDirs.images;
      } else {
        targetDir = sceneDirs.shared || sceneDirs.images;
      }
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const finalPath = path.join(targetDir, targetFilename);
      const writeStream = fs.createWriteStream(finalPath);
      for (const cp of chunkArray) {
        if (fs.existsSync(cp)) {
          const data = fs.readFileSync(cp);
          writeStream.write(data);
          try {
            fs.unlinkSync(cp);
          } catch (e) {}
        }
      }
      writeStream.end();
      writeStream.on("finish", () => {
        this.uploadChunks.delete(upload_id);
        if (!fs.existsSync(finalPath)) {
          return reject(new Error("Failed to write assembled chunked file. File missing."));
        }
        const stats = fs.statSync(finalPath);
        const parsedSlotIndex =
          slot_index !== undefined &&
          slot_index !== null &&
          slot_index !== "" &&
          !isNaN(parseInt(String(slot_index)))
            ? parseInt(String(slot_index))
            : undefined;
            
        if (replace_filename) {
          const oldPath = this.getAssetFilePath(replace_filename);
          if (oldPath && fs.existsSync(oldPath)) {
            try { fs.unlinkSync(oldPath); } catch (e) {}
          }
        }
            
        resolve({
          complete: true,
          asset: {
            id: targetFilename,
            original_name: original_name || "unknown",
            filename: targetFilename,
            media_type: mType,
            type: type || "unknown",
            subject_name: subject_name || "subject",
            description: description || "",
            size_bytes: stats.size,
            created_at: Date.now(),
            preview_url: `/api/uploads/${targetFilename}`,
            slot_index: parsedSlotIndex,
            scene_name: resolvedSceneName,
            path: finalPath
          }
        });
      });
      writeStream.on("error", (err) => {
        reject(err);
      });
    });
  }
}
"""

content = re.sub(r'class AssetService \{.*\}\n\nexport const assetService = new AssetService\(\);', r_class + '\n\nexport const assetService = new AssetService();', content, flags=re.DOTALL)

with open("server/services/assetService.ts", "w") as f:
    f.write(content)

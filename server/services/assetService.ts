import fs from "fs";
import path from "path";
import { 
  ASSET_DB_FILE, 
  ASSETS_DIR, 
  LEGACY_IMAGES_DIR, 
  LEGACY_VIDEOS_DIR, 
  LEGACY_AUDIOS_DIR, 
  LEGACY_UPLOADS_DIR, 
  TMP_DIR,
  ensureSceneDirectories,
  formatSceneFolderName 
} from "../config/constants";
import { AssetRecord } from "../types";
import { sanitizeSlug } from "../utils/formatters";

const COMPOUND_REFERENCE_TYPES = [
  "motion_reference_video",
  "voiceover_audio",
  "motion_reference",
  "voice_reference",
  "body_reference",
  "scene_reference",
  "object_reference",
  "style_reference",
  "character_reference",
  "location_reference",
  "prop_reference",
  "mood_reference",
  "face_reference",
];

export function parseAssetFilename(filename: string): {
  type: string;
  subject_name: string;
  media_type: "image" | "video" | "audio";
} {
  const parsed = path.parse(filename);
  const ext = parsed.ext.toLowerCase();
  const stem = parsed.name;

  let mediaType: "image" | "video" | "audio" = "image";
  if ([".mp4", ".mov", ".webm", ".mkv", ".avi"].includes(ext)) {
    mediaType = "video";
  } else if ([".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac"].includes(ext)) {
    mediaType = "audio";
  }

  const stemLower = stem.toLowerCase();
  let assetType = "unknown";
  let remainder = stem;

  let matchedPrefix = false;
  for (const prefix of COMPOUND_REFERENCE_TYPES) {
    if (stemLower.startsWith(`${prefix}_`)) {
      assetType = prefix;
      remainder = stem.slice(prefix.length + 1);
      matchedPrefix = true;
      break;
    }
  }

  if (!matchedPrefix) {
    const parts = stem.split("_");
    if (parts.length >= 3 && parts[1].toLowerCase() === "reference") {
      assetType = `${parts[0]}_reference`.toLowerCase();
      remainder = parts.slice(2).join("_");
    } else if (parts.length >= 3) {
      assetType = parts[0].toLowerCase();
      remainder = parts.slice(1).join("_");
    } else if (parts.length === 2) {
      assetType = parts[0].toLowerCase();
      remainder = parts[1];
    } else {
      assetType = mediaType === "image" ? "headshot" : "unknown";
      remainder = stem;
    }
  }

  const remParts = remainder.split("_");
  while (remParts.length > 1 && /^\d+$/.test(remParts[remParts.length - 1])) {
    remParts.pop();
  }

  const subjectRaw = remParts.length > 0 ? remParts.join("_") : "subject";
  let subjectClean = subjectRaw.replace(/^reference[_\-\s]+/i, "").replace(/^_+|_+$/g, "");
  if (!subjectClean || ["unknown", "null", "undefined", ""].includes(subjectClean.toLowerCase())) {
    subjectClean = "subject";
  }

  let subjectDisplay = subjectClean;
  if (subjectClean === subjectClean.toLowerCase()) {
    subjectDisplay = subjectClean
      .split("_")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  } else {
    subjectDisplay = subjectClean.replace(/_/g, " ");
  }

  return {
    type: assetType,
    subject_name: subjectDisplay,
    media_type: mediaType
  };
}

class AssetService {
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
            if (/\.(mp4|mov|webm|mkv|avi)$/i.test(ext)) mediaType = "video";
            else if (/\.(mp3|wav|ogg|flac|aac|m4a)$/i.test(ext)) mediaType = "audio";
            
            let size = 0;
            let mtime = Date.now();
            try {
              const stats = fs.statSync(path.join(dir, file.name));
              size = stats.size;
              mtime = stats.mtimeMs;
            } catch(e) {}
            
            const parsedInfo = parseAssetFilename(file.name);

            assets.push({
              id: file.name,
              filename: file.name,
              original_name: file.name,
              media_type: (mediaType || parsedInfo.media_type) as any,
              type: parsedInfo.type,
              subject_name: parsedInfo.subject_name,
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
    updates: {
      type?: string;
      assetType?: string;
      asset_type?: string;
      subject_name?: string;
      subjectName?: string;
      description?: string;
      tags?: string[] | string;
      scene_name?: string;
      sceneName?: string;
      original_filename?: string;
    }
  ): AssetRecord | null {
    const targetFilename = updates.original_filename || (filename !== "update" ? filename : (updates.original_filename || "asset"));
    const updatedType = updates.type || updates.assetType || updates.asset_type || "unknown";
    const updatedSubject = updates.subject_name || updates.subjectName || "subject";
    const updatedDesc = updates.description || "";
    
    let updatedTags: string[] = [];
    if (typeof updates.tags === "string") {
      try {
        updatedTags = JSON.parse(updates.tags);
      } catch (e) {
        updatedTags = updates.tags.split(",").map(t => t.trim()).filter(Boolean);
      }
    } else if (Array.isArray(updates.tags)) {
      updatedTags = updates.tags;
    }

    const sceneName = updates.scene_name || updates.sceneName;
    const filePath = this.getAssetFilePath(targetFilename);
    const parsed = parseAssetFilename(targetFilename);
    
    let size = 0;
    let mtime = Date.now();
    if (filePath && fs.existsSync(filePath)) {
      try {
        const st = fs.statSync(filePath);
        size = st.size;
        mtime = st.mtimeMs;
      } catch (e) {}
    }

    // 1. Update assets_db.json
    try {
      let dbRecords: any[] = [];
      if (fs.existsSync(ASSET_DB_FILE)) {
        try {
          const raw = fs.readFileSync(ASSET_DB_FILE, "utf-8");
          const loaded = JSON.parse(raw);
          if (Array.isArray(loaded)) dbRecords = loaded;
          else if (typeof loaded === "object" && loaded !== null) dbRecords = Object.values(loaded);
        } catch (e) {}
      }

      let found = false;
      for (const r of dbRecords) {
        if (r && (r.filename === targetFilename || r.id === targetFilename)) {
          r.type = updatedType;
          r.subject_name = updatedSubject;
          r.description = updatedDesc;
          r.tags = updatedTags;
          r.media_type = parsed.media_type;
          r.size_bytes = size;
          r.preview_url = `/api/uploads/${targetFilename}`;
          if (sceneName) r.scene_name = sceneName;
          found = true;
          break;
        }
      }

      if (!found) {
        dbRecords.push({
          id: targetFilename,
          filename: targetFilename,
          original_name: targetFilename,
          media_type: parsed.media_type,
          type: updatedType,
          subject_name: updatedSubject,
          description: updatedDesc,
          tags: updatedTags,
          size_bytes: size,
          scene_name: sceneName || "scene01",
          preview_url: `/api/uploads/${targetFilename}`,
          path: filePath || ""
        });
      }

      fs.writeFileSync(ASSET_DB_FILE, JSON.stringify(dbRecords, null, 2), "utf-8");
    } catch (e) {
      console.error("[AssetService] Error updating ASSET_DB_FILE:", e);
    }

    // 2. Synchronize project JSON files in assets/
    try {
      const ignoredFiles = new Set(["assets_db.json", "gemini_config.json", "package.json", "tsconfig.json", "metadata.json"]);
      if (fs.existsSync(ASSETS_DIR)) {
        const dirs = fs.readdirSync(ASSETS_DIR, { withFileTypes: true });
        for (const d of dirs) {
          if (d.isDirectory() && d.name !== "tmp_uploads") {
            const dirPath = path.join(ASSETS_DIR, d.name);
            const files = fs.readdirSync(dirPath);
            for (const f of files) {
              if (f.endsWith(".json") && !ignoredFiles.has(f.toLowerCase()) && !f.startsWith(".")) {
                const projPath = path.join(dirPath, f);
                try {
                  const projRaw = fs.readFileSync(projPath, "utf-8");
                  const proj = JSON.parse(projRaw);
                  let modified = false;

                  if (proj && Array.isArray(proj.assets)) {
                    for (const a of proj.assets) {
                      if (a && (a.filename === targetFilename || a.id === targetFilename)) {
                        a.type = updatedType;
                        a.subject_name = updatedSubject;
                        a.description = updatedDesc;
                        a.tags = updatedTags;
                        modified = true;
                      }
                    }
                  }

                  if (updatedSubject && !["unknown", "subject", ""].includes(updatedSubject.toLowerCase())) {
                    if (proj && Array.isArray(proj.subjects)) {
                      const cleanExisting = proj.subjects.map((s: any) => typeof s === "string" ? s.trim().toLowerCase() : "");
                      if (!cleanExisting.includes(updatedSubject.trim().toLowerCase())) {
                        proj.subjects.push(updatedSubject.trim());
                        modified = true;
                      }
                    }
                  }

                  if (proj && Array.isArray(proj.shared_assets)) {
                    for (const s of proj.shared_assets) {
                      if (s && s.filename === targetFilename) {
                        s.label = `${updatedType}: ${updatedSubject}`;
                        modified = true;
                      }
                    }
                  }

                  if (modified) {
                    fs.writeFileSync(projPath, JSON.stringify(proj, null, 2), "utf-8");
                  }
                } catch (e) {}
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("[AssetService] Error syncing project files:", e);
    }

    return {
      id: targetFilename,
      filename: targetFilename,
      original_name: targetFilename,
      media_type: parsed.media_type,
      type: updatedType,
      subject_name: updatedSubject,
      description: updatedDesc,
      tags: updatedTags,
      size_bytes: size,
      created_at: mtime,
      preview_url: `/api/uploads/${targetFilename}`,
      scene_name: sceneName || "scene01",
      path: filePath || ""
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
    if (mediaType === "video" || ext.match(/\.(mp4|mov|webm|mkv|avi)$/i)) {
      targetDir = sceneDirs.videos;
    } else if (mediaType === "audio" || ext.match(/\.(mp3|wav|ogg|flac|aac|m4a)$/i)) {
      targetDir = sceneDirs.audios;
    } else if (mediaType === "image" || ext.match(/\.(png|jpg|jpeg|webp|gif|bmp)$/i)) {
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
      if (mType === "video" || ext.match(/\.(mp4|mov|webm|mkv|avi)$/i)) {
        targetDir = sceneDirs.videos;
      } else if (mType === "audio" || ext.match(/\.(mp3|wav|ogg|flac|aac|m4a)$/i)) {
        targetDir = sceneDirs.audios;
      } else if (mType === "image" || ext.match(/\.(png|jpg|jpeg|webp|gif|bmp)$/i)) {
        targetDir = sceneDirs.images;
      } else {
        targetDir = sceneDirs.shared || sceneDirs.images;
      }
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const finalPath = path.join(targetDir, targetFilename);
      const writeStream = fs.createWriteStream(finalPath);
      
      const appendNext = (i: number) => {
        if (i >= total) {
          writeStream.end();
          return;
        }
        const cp = path.join(chunksTempDir, `${upload_id}_${i}.part`);
        if (fs.existsSync(cp)) {
          const rs = fs.createReadStream(cp);
          rs.pipe(writeStream, { end: false });
          rs.on("end", () => {
            try { fs.unlinkSync(cp); } catch (e) {}
            appendNext(i + 1);
          });
          rs.on("error", reject);
        } else {
          appendNext(i + 1);
        }
      };
      
      appendNext(0);
      
      writeStream.on("finish", () => {
        if (this.uploadChunks) {
            this.uploadChunks.delete(upload_id);
        }
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


export const assetService = new AssetService();

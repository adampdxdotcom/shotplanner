import fs from "fs";
import path from "path";
import { 
  ASSET_DB_FILE, 
  ASSETS_DIR, 
  LEGACY_IMAGES_DIR, 
  LEGACY_VIDEOS_DIR, 
  LEGACY_AUDIOS_DIR, 
  LEGACY_UPLOADS_DIR, 
  UNIVERSE_DIR,
  UNIVERSE_MEDIA_DIR,
  TMP_DIR,
  ensureSceneDirectories,
  formatSceneFolderName 
} from "../config/constants";
import { AssetRecord } from "../types";
import { sanitizeSlug } from "../utils/formatters";
import { generateThumbnailFile } from "./thumbnailService";
import { writeJsonAtomicSync } from "../utils/atomicFs";
import { safeUnlinkSync, purgeUploadSessionChunks } from "../utils/fileCleanup";
import { createScopedLogger } from "../utils/logger";

const log = createScopedLogger("AssetService");

const COMPOUND_REFERENCE_TYPES = [
  "scene_location_reference",
  "character_staging_reference",
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

  let typeDisplay = assetType;
  if (assetType === "scene_location_reference") {
    typeDisplay = "Scene / Location Reference";
  } else if (assetType === "character_staging_reference") {
    typeDisplay = "Character Staging Reference";
  } else if (assetType === "scene_reference") {
    typeDisplay = "Scene Reference";
  } else if (assetType === "body_reference" || assetType === "body reference") {
    typeDisplay = "Body Reference";
  } else if (assetType === "headshot") {
    typeDisplay = "Headshot";
  }

  return {
    type: typeDisplay,
    subject_name: subjectDisplay,
    media_type: mediaType
  };
}

interface ChunkUploadSession {
  chunks: string[];
  total: number;
  createdAt: number;
  lastActivity: number;
}

class AssetService {
  private uploadChunks = new Map<string, ChunkUploadSession>();

  constructor() {}
  public loadAssetDatabase(): void {}
  public saveAssetDatabase(): void {}
  public getRawDatabase(): AssetRecord[] { return []; }

  /**
   * Prunes abandoned upload sessions inactive for longer than maxAgeMs (default: 1 hour).
   */
  public pruneExpiredUploadSessions(maxAgeMs: number = 60 * 60 * 1000): number {
    const now = Date.now();
    let pruned = 0;
    for (const [uploadId, session] of this.uploadChunks.entries()) {
      if (now - session.lastActivity > maxAgeMs) {
        purgeUploadSessionChunks(uploadId);
        this.uploadChunks.delete(uploadId);
        pruned++;
      }
    }
    if (pruned > 0) {
      log.info(`Pruned ${pruned} abandoned in-memory upload chunk session(s).`);
    }
    return pruned;
  }

  /**
   * Aborts an active chunked upload session and removes all written chunk files.
   */
  public abortChunkUpload(uploadId: string): boolean {
    purgeUploadSessionChunks(uploadId);
    return this.uploadChunks.delete(uploadId);
  }
  
  public getAssetFilePath(filename: string): string | null {
    const dirsToScan = [
      ASSETS_DIR,
      UNIVERSE_DIR,
      UNIVERSE_MEDIA_DIR,
      path.join(UNIVERSE_DIR, "media"),
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
  
  public getAllAssets(sceneName?: string, options?: { includeUniverse?: boolean; universeOnly?: boolean }): AssetRecord[] {
    const assets: AssetRecord[] = [];
    const seen = new Set<string>();

    const dbMap = new Map<string, any>();
    if (fs.existsSync(ASSET_DB_FILE)) {
      try {
        const raw = fs.readFileSync(ASSET_DB_FILE, "utf-8");
        const entries = JSON.parse(raw);
        if (Array.isArray(entries)) {
          for (const item of entries) {
            if (item && item.filename) {
              dbMap.set(item.filename, item);
            }
          }
        }
      } catch (e) {}
    }

    const dirsToScan: string[] = [];

    if (options?.universeOnly) {
      dirsToScan.push(UNIVERSE_MEDIA_DIR);
    } else {
      if (sceneName) {
        const sceneDirs = ensureSceneDirectories(sceneName);
        dirsToScan.push(sceneDirs.images, sceneDirs.videos, sceneDirs.audios, sceneDirs.shared);
      }
      const globalShared = path.join(ASSETS_DIR, "shared");
      dirsToScan.push(globalShared);

      // Only scan universe media directory if explicitly requested
      if (options?.includeUniverse) {
        dirsToScan.push(UNIVERSE_MEDIA_DIR);
      }

      if (!sceneName && !options?.includeUniverse) {
        dirsToScan.push(LEGACY_IMAGES_DIR, LEGACY_VIDEOS_DIR, LEGACY_AUDIOS_DIR, LEGACY_UPLOADS_DIR);
      }
    }

    for (const dir of dirsToScan) {
      if (fs.existsSync(dir)) {
        const isUniverseDir = dir === UNIVERSE_MEDIA_DIR || dir.startsWith(UNIVERSE_DIR);
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
            const dbRecord = dbMap.get(file.name);

            assets.push({
              id: file.name,
              filename: file.name,
              original_name: dbRecord?.original_name || file.name,
              media_type: (dbRecord?.media_type || mediaType || parsedInfo.media_type) as any,
              type: dbRecord?.type || parsedInfo.type,
              subject_name: dbRecord?.subject_name || parsedInfo.subject_name,
              description: dbRecord?.description || "",
              tags: dbRecord?.tags,
              size_bytes: size,
              created_at: dbRecord?.created_at || mtime,
              preview_url: `/api/uploads/${file.name}`,
              slot_index: dbRecord?.slot_index,
              scene_name: dbRecord?.scene_name || (isUniverseDir ? "universe" : (sceneName || "unknown")),
              path: path.join(dir, file.name),
              is_universe: isUniverseDir || dbRecord?.is_universe || false
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

      writeJsonAtomicSync(ASSET_DB_FILE, dbRecords);
    } catch (e) {
      log.error("Error updating ASSET_DB_FILE", { error: e });
    }

    // 2. Synchronize project JSON files in assets/
    try {
      const ignoredFiles = new Set(["assets_db.json", "gemini_config.json", "civitai_config.json", "huggingface_config.json", "runpod_config.json", "package.json", "tsconfig.json", "metadata.json"]);
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
                    writeJsonAtomicSync(projPath, proj);
                  }
                } catch (e) {}
              }
            }
          }
        }
      }
    } catch (e) {
      log.error("Error syncing project files", { error: e });
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
  
  public async handleSingleFileUpload(
    file: Express.Multer.File,
    meta: {
      media_type?: string;
      type?: string;
      asset_type?: string;
      assetType?: string;
      subject_name?: string;
      description?: string;
      slot_index?: string | number;
      scene_name?: string;
    }
  ): Promise<AssetRecord> {
    const mediaType = (meta.media_type || "image") as "image" | "audio" | "video";
    const rawType = (meta.type || meta.asset_type || (meta as any).assetType || "").trim();
    let assetType = "Headshot";
    if (rawType.toLowerCase().replace(/[\s_-]+/g, " ").includes("body")) {
      assetType = "Body Reference";
    } else if (rawType.toLowerCase().includes("headshot")) {
      assetType = "Headshot";
    } else if (rawType) {
      assetType = rawType;
    }
    const subjectName = meta.subject_name || "subject";
    const description = meta.description || "";
    const sceneName = meta.scene_name || "scene01";
    const cleanType = sanitizeSlug(assetType);
    const cleanName = sanitizeSlug(subjectName);
    let timestamp = Math.floor(Date.now() / 1000);
    const ext =
      path.extname(file.originalname) ||
      (mediaType === "image" ? ".png" : mediaType === "audio" ? ".mp3" : ".mp4");
    let targetFilename = `${cleanType}_${cleanName}_${timestamp}${ext}`;

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

    // Ensure collision-free unique filename so multiple references of the same type never overwrite each other
    let destinationPath = path.join(targetDir, targetFilename);
    while (fs.existsSync(destinationPath)) {
      timestamp++;
      targetFilename = `${cleanType}_${cleanName}_${timestamp}${ext}`;
      destinationPath = path.join(targetDir, targetFilename);
    }
    fs.copyFileSync(file.path, destinationPath);
    try {
      fs.unlinkSync(file.path);
    } catch (e) {}

    // Early thumbnail generation for instant UI feedback and vision captioning
    let thumbPath: string | undefined = undefined;
    if (mediaType === "image" || ext.match(/\.(png|jpg|jpeg|webp|gif|bmp)$/i)) {
      thumbPath = await generateThumbnailFile(destinationPath, undefined, 384);
    }
    
    const parsedSlotIndex =
      meta.slot_index !== undefined &&
      meta.slot_index !== null &&
      meta.slot_index !== "" &&
      !isNaN(parseInt(String(meta.slot_index)))
        ? parseInt(String(meta.slot_index))
        : undefined;
        
    const record: AssetRecord = {
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
      thumbnail_url: `/api/assets/thumb/${targetFilename}`,
      thumbnail_path: thumbPath,
      slot_index: parsedSlotIndex,
      scene_name: sceneName,
      path: destinationPath
    };

    try {
      let dbRecords: any[] = [];
      if (fs.existsSync(ASSET_DB_FILE)) {
        try {
          const raw = fs.readFileSync(ASSET_DB_FILE, "utf-8");
          const loaded = JSON.parse(raw);
          if (Array.isArray(loaded)) dbRecords = loaded;
        } catch (e) {}
      }
      const existingIdx = dbRecords.findIndex((r: any) => r.filename === targetFilename);
      if (existingIdx !== -1) {
        dbRecords[existingIdx] = record;
      } else {
        dbRecords.push(record);
      }
      writeJsonAtomicSync(ASSET_DB_FILE, dbRecords);
    } catch (e) {}

    return record;
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
      
      // Opportunistically prune abandoned upload sessions
      this.pruneExpiredUploadSessions();

      if (!this.uploadChunks.has(upload_id)) {
        this.uploadChunks.set(upload_id, {
          chunks: new Array(total).fill(""),
          total,
          createdAt: Date.now(),
          lastActivity: Date.now()
        });
      }
      
      const session = this.uploadChunks.get(upload_id)!;
      session.lastActivity = Date.now();

      const chunksTempDir = path.join(TMP_DIR, "chunks");
      if (!fs.existsSync(chunksTempDir)) {
        fs.mkdirSync(chunksTempDir, { recursive: true });
      }
      const chunkPath = path.join(chunksTempDir, `${upload_id}_${chunkIdx}`);
      fs.copyFileSync(chunkFile.path, chunkPath);
      try {
        fs.unlinkSync(chunkFile.path);
      } catch (e) {}
      
      session.chunks[chunkIdx] = chunkPath;
      const isFinalChunk = session.chunks.every((cp) => cp !== "");
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
      
      const cleanupOnError = (err: any) => {
        log.error(`Chunk assembly error for upload ${upload_id}: ${err?.message || err}`);
        try { writeStream.destroy(); } catch (e) {}
        safeUnlinkSync(finalPath);
        purgeUploadSessionChunks(upload_id);
        this.uploadChunks.delete(upload_id);
        reject(err instanceof Error ? err : new Error(String(err)));
      };

      writeStream.on("error", cleanupOnError);

      const appendNext = (i: number) => {
        if (i >= total) {
          writeStream.end();
          return;
        }
        const cp = path.join(chunksTempDir, `${upload_id}_${i}`);
        if (fs.existsSync(cp)) {
          const rs = fs.createReadStream(cp);
          rs.pipe(writeStream, { end: false });
          rs.on("end", () => {
            try { fs.unlinkSync(cp); } catch (e) {}
            appendNext(i + 1);
          });
          rs.on("error", (err) => {
            cleanupOnError(err);
          });
        } else {
          appendNext(i + 1);
        }
      };
      
      appendNext(0);
      
      writeStream.on("finish", async () => {
        this.uploadChunks.delete(upload_id);
        purgeUploadSessionChunks(upload_id);

        if (!fs.existsSync(finalPath)) {
          return cleanupOnError(new Error("Failed to write assembled chunked file. File missing."));
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

        let thumbPath: string | undefined = undefined;
        if (mType === "image" || ext.match(/\.(png|jpg|jpeg|webp|gif|bmp)$/i)) {
          thumbPath = await generateThumbnailFile(finalPath, undefined, 384);
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
            thumbnail_url: `/api/assets/thumb/${targetFilename}`,
            thumbnail_path: thumbPath,
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

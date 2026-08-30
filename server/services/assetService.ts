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

class AssetService {
  private assetDatabase: AssetRecord[] = [];
  private uploadChunks = new Map<string, string[]>();

  constructor() {
    this.loadAssetDatabase();
  }

  public loadAssetDatabase(): void {
    if (fs.existsSync(ASSET_DB_FILE)) {
      try {
        this.assetDatabase = JSON.parse(fs.readFileSync(ASSET_DB_FILE, "utf-8"));
      } catch (e) {
        this.assetDatabase = [];
      }
    }
  }

  public saveAssetDatabase(): void {
    try {
      fs.writeFileSync(ASSET_DB_FILE, JSON.stringify(this.assetDatabase, null, 2));
    } catch (e) {
      console.error("Failed to save asset database:", e);
    }
  }

  public getAllAssets(): AssetRecord[] {
    return [...this.assetDatabase]
      .sort((a, b) => (a.slot_index ?? 0) - (b.slot_index ?? 0))
      .map((a) => ({
        ...a,
        preview_url: `/api/uploads/${a.filename}`
      }));
  }

  public getRawDatabase(): AssetRecord[] {
    return this.assetDatabase;
  }

  public findAsset(filename: string): AssetRecord | undefined {
    return this.assetDatabase.find((a) => a.filename === filename);
  }

  public getAssetFilePath(filename: string): string | null {
    const cleanName = path.basename(filename);
    
    // Scan all Scene folders first
    if (fs.existsSync(ASSETS_DIR)) {
      try {
        const sceneDirs = fs.readdirSync(ASSETS_DIR, { withFileTypes: true })
          .filter((d) => d.isDirectory() && d.name.startsWith("scene"));
          
        for (const scene of sceneDirs) {
          const sceneBase = path.join(ASSETS_DIR, scene.name);
          for (const sub of ["images", "videos", "audios", "workflows", "shared"]) {
            const potentialFile = path.join(sceneBase, sub, cleanName);
            if (fs.existsSync(potentialFile) && fs.statSync(potentialFile).isFile()) {
              return potentialFile;
            }
          }
        }
      } catch {}
    }
    
    // Fallback to legacy flat folders
    const candidateDirs = [
      LEGACY_IMAGES_DIR,
      LEGACY_VIDEOS_DIR,
      LEGACY_AUDIOS_DIR,
      LEGACY_UPLOADS_DIR,
      ASSETS_DIR
    ];
    for (const base of candidateDirs) {
      if (fs.existsSync(base)) {
        const direct = path.join(base, cleanName);
        if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
        try {
          const subdirs = fs.readdirSync(base, { withFileTypes: true }).filter((d) => d.isDirectory());
          for (const s of subdirs) {
            const subFile = path.join(base, s.name, cleanName);
            if (fs.existsSync(subFile) && fs.statSync(subFile).isFile()) return subFile;
          }
        } catch {}
      }
    }
    return null;
  }

  public deleteAsset(filename: string): boolean {
    const assetIndex = this.assetDatabase.findIndex((a) => a.filename === filename);
    if (assetIndex !== -1) {
      this.assetDatabase.splice(assetIndex, 1);
    }
    const foundPath = this.getAssetFilePath(filename);
    if (foundPath && fs.existsSync(foundPath)) {
      try {
        fs.unlinkSync(foundPath);
      } catch (e) {}
    }
    this.saveAssetDatabase();
    return true;
  }

  public updateAssetMetadata(
    filename: string,
    updates: { type?: string; subject_name?: string; description?: string }
  ): AssetRecord | null {
    const asset = this.assetDatabase.find((a) => a.filename === filename);
    if (!asset) return null;

    if (updates.type !== undefined) asset.type = updates.type;
    if (updates.subject_name !== undefined) asset.subject_name = updates.subject_name;
    if (updates.description !== undefined) asset.description = updates.description;

    this.saveAssetDatabase();
    return asset;
  }

  public syncAssets(assets: any[]): AssetRecord[] {
    if (Array.isArray(assets)) {
      this.assetDatabase = assets.map((item: any, idx: number) => ({
        ...item,
        slot_index: item.slot_index !== undefined ? item.slot_index : idx,
        preview_url: `/api/uploads/${item.filename}`
      }));
      this.saveAssetDatabase();
    }
    return this.assetDatabase;
  }

  public upsertAsset(record: AssetRecord, replaceFilename?: string): AssetRecord {
    if (replaceFilename) {
      const oldIndex = this.assetDatabase.findIndex((a) => a.filename === replaceFilename);
      if (oldIndex !== -1) {
        const oldPath = this.getAssetFilePath(replaceFilename);
        if (oldPath && fs.existsSync(oldPath)) {
          try {
            fs.unlinkSync(oldPath);
          } catch (e) {}
        }
        this.assetDatabase[oldIndex] = {
          ...record,
          slot_index: this.assetDatabase[oldIndex].slot_index ?? record.slot_index
        };
      } else {
        this.assetDatabase.push(record);
      }
    } else if (record.slot_index !== undefined) {
      const existingIdx = this.assetDatabase.findIndex(
        (a) =>
          (a.media_type || "image") === (record.media_type || "image") &&
          a.slot_index === record.slot_index
      );
      if (existingIdx !== -1) {
        const oldFile = this.assetDatabase[existingIdx].filename;
        if (oldFile && oldFile !== record.filename) {
          const oldPath = this.getAssetFilePath(oldFile);
          if (oldPath && fs.existsSync(oldPath)) {
            try {
              fs.unlinkSync(oldPath);
            } catch (e) {}
          }
        }
        this.assetDatabase[existingIdx] = record;
      } else {
        this.assetDatabase.push(record);
      }
    } else {
      this.assetDatabase.push(record);
    }

    this.saveAssetDatabase();
    return record;
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
      targetDir = sceneDirs.shared;
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

      const assetRecord: AssetRecord = {
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
        scene_name: sceneName
      };

    return this.upsertAsset(assetRecord);
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

      // Final chunk reached: reassemble file into scene folder
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
        targetDir = sceneDirs.shared;
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
        const stats = fs.statSync(finalPath);

        const parsedSlotIndex =
          slot_index !== undefined &&
          slot_index !== null &&
          slot_index !== "" &&
          !isNaN(parseInt(String(slot_index)))
            ? parseInt(String(slot_index))
            : undefined;

        const assetRecord: AssetRecord = {
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
          scene_name: resolvedSceneName
        };

        const savedRecord = this.upsertAsset(assetRecord, replace_filename);
        resolve({ complete: true, asset: savedRecord });
      });

      writeStream.on("error", (err) => {
        reject(err);
      });
    });
  }
}

export const assetService = new AssetService();

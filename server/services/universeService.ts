import fs from "fs";
import path from "path";
import { 
  UNIVERSE_CHARACTERS_FILE, 
  UNIVERSE_MEDIA_DIR, 
  UNIVERSE_DIR,
  initDirectories 
} from "../config/constants";
import { UniverseCharacterProfile } from "../types";
import { assetService } from "./assetService";

// Ensure universe directory and database file exist
initDirectories();

export class UniverseService {
  /**
   * Load all universe characters from data/universe/characters.json
   */
  public getUniverseCharacters(): Record<string, UniverseCharacterProfile> {
    try {
      if (!fs.existsSync(UNIVERSE_CHARACTERS_FILE)) {
        fs.mkdirSync(UNIVERSE_DIR, { recursive: true });
        fs.writeFileSync(UNIVERSE_CHARACTERS_FILE, JSON.stringify({}, null, 2), "utf-8");
        return {};
      }
      const raw = fs.readFileSync(UNIVERSE_CHARACTERS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch (err) {
      console.error("[UniverseService] Error reading characters:", err);
      return {};
    }
  }

  /**
   * Return all universe media reference assets
   */
  public getUniverseMediaAssets() {
    return assetService.getAllAssets(undefined, { universeOnly: true });
  }

  /**
   * Persist universe character map to disk
   */
  public saveUniverseCharacters(characters: Record<string, UniverseCharacterProfile>): boolean {
    try {
      if (!fs.existsSync(UNIVERSE_DIR)) {
        fs.mkdirSync(UNIVERSE_DIR, { recursive: true });
      }
      fs.writeFileSync(UNIVERSE_CHARACTERS_FILE, JSON.stringify(characters, null, 2), "utf-8");
      return true;
    } catch (err) {
      console.error("[UniverseService] Error saving characters:", err);
      return false;
    }
  }

  /**
   * Upsert a character in the Universe roster
   */
  public upsertUniverseCharacter(profile: Partial<UniverseCharacterProfile> & { name: string }): UniverseCharacterProfile {
    const characters = this.getUniverseCharacters();
    const key = profile.name.trim();
    const now = new Date().toISOString();

    const existing: Partial<UniverseCharacterProfile> = characters[key] || {};
    
    // Ensure quick_slots are padded to 4 slots
    const incomingSlots = profile.quick_slots || profile.universe_slots || existing.quick_slots || ["", "", "", ""];
    const normalizedSlots = Array.from({ length: 4 }, (_, i) => incomingSlots[i] || "");

    const updatedProfile: UniverseCharacterProfile = {
      id: profile.id || existing.id || `universe_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: key,
      notes: profile.notes !== undefined ? profile.notes : (existing.notes || ""),
      quick_slots: normalizedSlots,
      universe_slots: normalizedSlots,
      scene_outfit_ref: profile.scene_outfit_ref !== undefined ? profile.scene_outfit_ref : (existing.scene_outfit_ref || ""),
      default_outfit_ref: profile.default_outfit_ref !== undefined ? profile.default_outfit_ref : (existing.default_outfit_ref || profile.scene_outfit_ref || ""),
      is_location: profile.is_location !== undefined ? profile.is_location : !!existing.is_location,
      source_scene: profile.source_scene || existing.source_scene,
      created_at: existing.created_at || now,
      updated_at: now
    };

    characters[key] = updatedProfile;
    this.saveUniverseCharacters(characters);
    return updatedProfile;
  }

  /**
   * Remove a character from the Universe roster
   */
  public deleteUniverseCharacter(name: string): boolean {
    const characters = this.getUniverseCharacters();
    const key = name.trim();
    if (characters[key]) {
      delete characters[key];
      this.saveUniverseCharacters(characters);
      return true;
    }
    return false;
  }

  /**
   * Promote an asset from a scene/upload directory into the global universe media folder
   */
  public promoteAssetToUniverse(filename: string): { success: boolean; universePath?: string; filename: string; error?: string } {
    try {
      if (!filename) {
        return { success: false, filename, error: "No filename provided" };
      }

      // If it already lives in universe media dir, no-op
      const destPath = path.join(UNIVERSE_MEDIA_DIR, filename);
      if (fs.existsSync(destPath)) {
        return { success: true, universePath: destPath, filename };
      }

      // Locate original file
      const sourcePath = assetService.getAssetFilePath(filename);
      if (!sourcePath || !fs.existsSync(sourcePath)) {
        return { success: false, filename, error: `Source asset '${filename}' not found` };
      }

      if (!fs.existsSync(UNIVERSE_MEDIA_DIR)) {
        fs.mkdirSync(UNIVERSE_MEDIA_DIR, { recursive: true });
      }

      // Copy to universe media dir
      fs.copyFileSync(sourcePath, destPath);

      // Also copy thumbnail if exists
      const sourceThumb = path.join(path.dirname(sourcePath), "thumbnails", filename);
      if (fs.existsSync(sourceThumb)) {
        const destThumbDir = path.join(UNIVERSE_MEDIA_DIR, "thumbnails");
        if (!fs.existsSync(destThumbDir)) {
          fs.mkdirSync(destThumbDir, { recursive: true });
        }
        fs.copyFileSync(sourceThumb, path.join(destThumbDir, filename));
      }

      // Update assets_db.json so this asset is recorded as a universe asset
      try {
        const { ASSET_DB_FILE } = require("../config/constants");
        if (fs.existsSync(ASSET_DB_FILE)) {
          const raw = fs.readFileSync(ASSET_DB_FILE, "utf-8");
          const dbRecords = JSON.parse(raw);
          if (Array.isArray(dbRecords)) {
            const item = dbRecords.find((r: any) => r.filename === filename);
            if (item) {
              item.is_universe = true;
              item.scene_name = "universe";
              fs.writeFileSync(ASSET_DB_FILE, JSON.stringify(dbRecords, null, 2), "utf-8");
            }
          }
        }
      } catch (e) {}

      return { success: true, universePath: destPath, filename };
    } catch (err: any) {
      console.error("[UniverseService] Error promoting asset:", err);
      return { success: false, filename, error: err.message };
    }
  }

  /**
   * Inspect a ZIP archive buffer and calculate character / asset conflicts against the current Universe master roster
   */
  public async inspectUniverseFromZip(
    zipBuffer: Buffer
  ): Promise<{
    has_universe_data: boolean;
    incomingCharacters: Record<string, UniverseCharacterProfile>;
    items: Array<{
      name: string;
      is_location?: boolean;
      status: "new" | "identical" | "different";
      incoming: UniverseCharacterProfile;
      existing?: UniverseCharacterProfile;
      diffs: {
        notes?: { local: string; incoming: string };
        default_outfit_ref?: { local: string; incoming: string };
        slots?: { local: string[]; incoming: string[] };
      };
    }>;
    total_incoming: number;
    total_conflicts: number;
  }> {
    const unzipper = await import("unzipper");
    const directory = await unzipper.Open.buffer(zipBuffer);
    
    let incomingCharacters: Record<string, UniverseCharacterProfile> = {};
    let hasUniverseFile = false;

    // Look for universe/characters.json or top-level characters in project json
    for (const file of directory.files) {
      if (file.type !== "File") continue;
      if (file.path === "universe/characters.json" || file.path.endsWith("/universe/characters.json")) {
        try {
          const buf = await file.buffer();
          const parsed = JSON.parse(buf.toString("utf-8"));
          if (parsed && typeof parsed === "object") {
            incomingCharacters = { ...incomingCharacters, ...parsed };
            hasUniverseFile = true;
          }
        } catch (e) {}
      }
    }

    // If no universe/characters.json was found, inspect project json characters
    if (Object.keys(incomingCharacters).length === 0) {
      for (const file of directory.files) {
        if (file.type !== "File") continue;
        if (file.path.endsWith(".json") && !file.path.includes("/")) {
          try {
            const buf = await file.buffer();
            const projectData = JSON.parse(buf.toString("utf-8"));
            const sceneChars = projectData.characters || projectData.scene_planning?.characters || {};
            for (const [name, char] of Object.entries(sceneChars)) {
              if ((char as any)?.in_universe) {
                incomingCharacters[name] = char as UniverseCharacterProfile;
              }
            }
          } catch (e) {}
        }
      }
    }

    const currentMaster = this.getUniverseCharacters();
    const items: Array<any> = [];
    let conflictsCount = 0;

    for (const [name, incoming] of Object.entries(incomingCharacters)) {
      const local = currentMaster[name];
      if (!local) {
        items.push({
          name,
          is_location: !!incoming.is_location,
          status: "new",
          incoming,
          diffs: {}
        });
      } else {
        const diffs: any = {};
        const localNotes = (local.notes || "").trim();
        const incomingNotes = (incoming.notes || "").trim();
        if (localNotes !== incomingNotes) {
          diffs.notes = { local: localNotes, incoming: incomingNotes };
        }

        const localOutfit = (local.default_outfit_ref || local.scene_outfit_ref || "").trim();
        const incomingOutfit = (incoming.default_outfit_ref || incoming.scene_outfit_ref || "").trim();
        if (localOutfit !== incomingOutfit) {
          diffs.default_outfit_ref = { local: localOutfit, incoming: incomingOutfit };
        }

        const localSlots = (local.universe_slots || local.quick_slots || ["", "", "", ""]).slice(0, 4);
        const incomingSlots = (incoming.universe_slots || incoming.quick_slots || ["", "", "", ""]).slice(0, 4);
        const slotsMatch = localSlots.every((s, i) => s === (incomingSlots[i] || ""));
        if (!slotsMatch) {
          diffs.slots = { local: localSlots, incoming: incomingSlots };
        }

        const hasDiff = Object.keys(diffs).length > 0;
        if (hasDiff) conflictsCount++;

        items.push({
          name,
          is_location: !!(incoming.is_location || local.is_location),
          status: hasDiff ? "different" : "identical",
          incoming,
          existing: local,
          diffs
        });
      }
    }

    return {
      has_universe_data: Object.keys(incomingCharacters).length > 0,
      incomingCharacters,
      items,
      total_incoming: Object.keys(incomingCharacters).length,
      total_conflicts: conflictsCount
    };
  }

  /**
   * Apply user resolution decisions for universe characters from an imported archive
   */
  public applyUniverseResolution(
    resolutions: Record<string, "keep_local" | "overwrite" | "ingest_as_new">,
    incomingCharacters: Record<string, UniverseCharacterProfile>
  ) {
    const current = this.getUniverseCharacters();
    for (const [charName, decision] of Object.entries(resolutions)) {
      const incoming = incomingCharacters[charName];
      if (!incoming) continue;

      if (decision === "overwrite") {
        this.upsertUniverseCharacter({
          ...incoming,
          name: charName
        });
      } else if (decision === "ingest_as_new") {
        // If entity already exists, give it a new distinct name e.g. "Name (Imported)"
        let newName = `${charName} (Imported)`;
        let counter = 2;
        while (current[newName]) {
          newName = `${charName} (Imported ${counter})`;
          counter++;
        }
        this.upsertUniverseCharacter({
          ...incoming,
          name: newName,
          id: `universe_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        });
      }
      // If "keep_local", do nothing!
    }
  }
}

export const universeService = new UniverseService();

import fs from "fs";
import path from "path";
import { Response } from "express";
import { ZipArchive } from "archiver";
import { ASSETS_DIR, UPLOADS_DIR, formatSceneFolderName } from "../../config/constants";
import { formatShotNumber, sanitizeFilenamePart } from "../../utils/formatters";
import { findProjectFile } from "./projectCrud";

export interface ProjectTakesSummary {
  projectName: string;
  sceneName: string;
  totalShots: number;
  totalTakes: number;
  foundVideoFiles: number;
  totalSizeBytes: number;
  heroTakesCount: number;
  goodTakesCount: number;
  badTakesCount: number;
  unreviewedTakesCount: number;
  takesByShot: Array<{
    shotNumber: number;
    shotName: string;
    takesCount: number;
    foundFilesCount: number;
  }>;
}

export function getProjectTakesSummary(projectName: string): ProjectTakesSummary | null {
  const filePath = findProjectFile(projectName);
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  let projectData: any = {};
  try {
    projectData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (e) {
    return null;
  }

  const rawName = path.parse(filePath).name;
  const cleanSceneName = sanitizeFilenamePart(projectData.scene_name || rawName || "Scene");
  const shotsList = Array.isArray(projectData.shots) ? projectData.shots : [];

  let totalTakes = 0;
  let foundVideoFiles = 0;
  let totalSizeBytes = 0;
  let heroTakesCount = 0;
  let goodTakesCount = 0;
  let badTakesCount = 0;
  let unreviewedTakesCount = 0;

  const candidateDirs = [
    path.join(ASSETS_DIR, formatSceneFolderName(cleanSceneName), "outputs"),
    path.join(ASSETS_DIR, sanitizeFilenamePart(cleanSceneName), "outputs"),
    path.join(ASSETS_DIR, cleanSceneName, "outputs"),
    path.join(ASSETS_DIR, "outputs"),
    UPLOADS_DIR
  ];

  const takesByShot: any[] = [];

  for (const shot of shotsList) {
    if (!shot || typeof shot !== "object") continue;
    const shotNumStr = formatShotNumber(shot.shot_number);
    const takes = Array.isArray(shot.takes) ? shot.takes : [];
    let shotFoundFiles = 0;

    for (const take of takes) {
      totalTakes++;
      if (take.is_hero || take.id === shot.hero_take_id) heroTakesCount++;
      if (take.rating === "good" || take.review_status === "approved") goodTakesCount++;
      else if (take.rating === "bad" || take.review_status === "needs_work") badTakesCount++;
      else unreviewedTakesCount++;

      const possibleFilenames = [
        take.video_filename,
        `${cleanSceneName}_Shot_${shotNumStr}_Take_${take.take_number}.mp4`,
        `${cleanSceneName}_Shot_${shotNumStr}_Take_${take.take_number}.webm`,
        `take_${take.take_number}.mp4`
      ].filter(Boolean);

      let foundPath: string | null = null;
      if (take.video_path && fs.existsSync(take.video_path)) {
        foundPath = take.video_path;
      } else {
        for (const fn of possibleFilenames) {
          for (const dir of candidateDirs) {
            const p = path.join(dir, fn);
            if (fs.existsSync(p)) {
              foundPath = p;
              break;
            }
          }
          if (foundPath) break;
        }
      }

      if (foundPath) {
        shotFoundFiles++;
        foundVideoFiles++;
        try {
          const stat = fs.statSync(foundPath);
          totalSizeBytes += stat.size;
        } catch (e) {}
      }
    }

    takesByShot.push({
      shotNumber: shot.shot_number,
      shotName: shot.shot_name || `Shot ${shotNumStr}`,
      takesCount: takes.length,
      foundFilesCount: shotFoundFiles
    });
  }

  return {
    projectName: rawName,
    sceneName: cleanSceneName,
    totalShots: shotsList.length,
    totalTakes,
    foundVideoFiles,
    totalSizeBytes,
    heroTakesCount,
    goodTakesCount,
    badTakesCount,
    unreviewedTakesCount,
    takesByShot
  };
}

export async function exportTakesZip(projectName: string, res: Response): Promise<void> {
  const filePath = findProjectFile(projectName);
  if (!filePath || !fs.existsSync(filePath)) {
    res.status(404).json({ error: `Project '${projectName}' not found on server. Please save it first.` });
    return;
  }

  let projectData: any = {};
  try {
    projectData = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (err: any) {
    res.status(500).json({ error: `Failed to parse project file: ${err.message}` });
    return;
  }

  const rawName = path.parse(filePath).name;
  const cleanSceneName = sanitizeFilenamePart(projectData.scene_name || rawName || "Scene");
  const shotsList = Array.isArray(projectData.shots) ? projectData.shots : [];

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${cleanSceneName}_takes.zip"`);

  // Use compression level 1 for rapid packaging of already compressed video data
  const archive = new ZipArchive({ zlib: { level: 1 } });

  archive.on("error", (err: any) => {
    console.error("Takes archive error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Failed to create takes archive" });
    }
  });

  const cleanup = () => {
    try { archive.abort(); } catch (e) {}
  };
  res.on("close", cleanup);

  archive.pipe(res);

  const candidateDirs = [
    path.join(ASSETS_DIR, formatSceneFolderName(cleanSceneName), "outputs"),
    path.join(ASSETS_DIR, sanitizeFilenamePart(cleanSceneName), "outputs"),
    path.join(ASSETS_DIR, cleanSceneName, "outputs"),
    path.join(ASSETS_DIR, "outputs"),
    UPLOADS_DIR
  ];

  const addedFiles = new Set<string>();
  const manifestShots: any[] = [];
  const textLogLines: string[] = [
    "================================================================================",
    `DIRECTOR TAKES LOG - SCENE: ${cleanSceneName.toUpperCase()}`,
    `Exported At: ${new Date().toLocaleString()}`,
    `Project: ${rawName}.json`,
    "================================================================================",
    ""
  ];

  let totalFilesPackaged = 0;

  for (const shot of shotsList) {
    if (!shot || typeof shot !== "object") continue;
    const shotNumStr = formatShotNumber(shot.shot_number);
    const shotFolder = `Shot_${shotNumStr}${shot.shot_name ? `_${sanitizeFilenamePart(shot.shot_name)}` : ""}`;
    const takes = Array.isArray(shot.takes) ? shot.takes : [];

    textLogLines.push(`--------------------------------------------------------------------------------`);
    textLogLines.push(`SHOT ${shotNumStr}: ${shot.shot_name || "(Untitled)"} [${shot.shot_type || "Medium"} | ${shot.camera_movement || "Static"}]`);
    if (shot.prompt_node_id || shot.expanded_prompt) {
      textLogLines.push(`Prompt: ${shot.expanded_prompt || shot.basic_stub || ""}`);
    }
    textLogLines.push(`--------------------------------------------------------------------------------`);

    const manifestTakes: any[] = [];

    for (const take of takes) {
      const takeNumStr = String(take.take_number || 1).padStart(2, "0");
      const isHero = Boolean(take.is_hero || take.id === shot.hero_take_id);
      const rating = take.rating || (take.review_status === "approved" ? "good" : take.review_status === "needs_work" ? "bad" : "unreviewed");

      const possibleFilenames = [
        take.video_filename,
        `${cleanSceneName}_Shot_${shotNumStr}_Take_${take.take_number}.mp4`,
        `${cleanSceneName}_Shot_${shotNumStr}_Take_${take.take_number}.webm`,
        `take_${take.take_number}.mp4`
      ].filter(Boolean);

      let foundPath: string | null = null;
      let matchedFilename = take.video_filename || `${cleanSceneName}_Shot_${shotNumStr}_Take_${takeNumStr}.mp4`;

      if (take.video_path && fs.existsSync(take.video_path)) {
        foundPath = take.video_path;
        matchedFilename = path.basename(take.video_path);
      } else {
        for (const fn of possibleFilenames) {
          for (const dir of candidateDirs) {
            const candidatePath = path.join(dir, fn);
            if (fs.existsSync(candidatePath)) {
              foundPath = candidatePath;
              matchedFilename = fn;
              break;
            }
          }
          if (foundPath) break;
        }
      }

      let zipEntryPath = "";
      let fileSize = 0;

      if (foundPath && fs.existsSync(foundPath)) {
        zipEntryPath = `takes/${shotFolder}/${matchedFilename}`;
        if (!addedFiles.has(zipEntryPath)) {
          archive.file(foundPath, { name: zipEntryPath });
          addedFiles.add(zipEntryPath);
          totalFilesPackaged++;
          try {
            fileSize = fs.statSync(foundPath).size;
          } catch (e) {}
        }
      }

      manifestTakes.push({
        id: take.id,
        take_number: take.take_number,
        is_hero: isHero,
        rating,
        review_status: take.review_status || (rating === "good" ? "approved" : rating === "bad" ? "needs_work" : "unreviewed"),
        video_filename: matchedFilename,
        archive_path: zipEntryPath || null,
        file_size: fileSize,
        file_found_on_disk: Boolean(foundPath),
        notes: take.notes || "",
        expanded_prompt: take.expanded_prompt || "",
        generation_params: take.generation_params || null,
        created_at: take.created_at || null
      });

      const heroTag = isHero ? " [HERO TAKE]" : "";
      const ratingTag = rating === "good" ? " [GOOD]" : rating === "bad" ? " [NEEDS WORK]" : " [UNREVIEWED]";
      textLogLines.push(`  * Take ${takeNumStr}${heroTag}${ratingTag}: ${matchedFilename} (${fileSize ? (fileSize / (1024*1024)).toFixed(1) + " MB" : "not on disk"})`);
      if (take.notes) {
        textLogLines.push(`    Notes: ${take.notes}`);
      }
      if (take.expanded_prompt) {
        textLogLines.push(`    Take Prompt: ${take.expanded_prompt}`);
      }
    }

    if (takes.length === 0) {
      textLogLines.push(`  (No takes recorded for this shot)`);
    }

    textLogLines.push("");

    manifestShots.push({
      id: shot.id,
      shot_number: shot.shot_number,
      shot_name: shot.shot_name,
      shot_type: shot.shot_type,
      camera_movement: shot.camera_movement,
      hero_take_id: shot.hero_take_id,
      takes: manifestTakes
    });
  }

  // Also scan scene output folders for any unlinked take files matching scene
  for (const dir of candidateDirs) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if ((file.endsWith(".mp4") || file.endsWith(".webm")) && !file.startsWith(".")) {
            let alreadyAdded = false;
            for (const a of addedFiles) {
              if (a.endsWith(`/${file}`)) {
                alreadyAdded = true;
                break;
              }
            }
            if (!alreadyAdded) {
              const fullP = path.join(dir, file);
              const extraEntryPath = `takes/unassigned/${file}`;
              archive.file(fullP, { name: extraEntryPath });
              addedFiles.add(extraEntryPath);
              totalFilesPackaged++;
            }
          }
        }
      } catch (e) {}
    }
  }

  // Add director notes text log
  archive.append(textLogLines.join("\n"), { name: "DIRECTOR_NOTES.txt" });

  // Add JSON manifest
  const manifest = {
    scene_name: cleanSceneName,
    project_name: rawName,
    exported_at: new Date().toISOString(),
    total_shots: shotsList.length,
    total_takes_packaged: totalFilesPackaged,
    shots: manifestShots
  };
  archive.append(JSON.stringify(manifest, null, 2), { name: "takes_manifest.json" });

  await archive.finalize();
}

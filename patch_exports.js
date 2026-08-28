import fs from 'fs';
let code = fs.readFileSync('server.ts', 'utf-8');

const replacement = `// Mock export route so frontend doesn't break
app.get("/api/projects/:filename/export", (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const p = path.join(PROJECTS_DIR, \`\${filename}.json\`);
    if (!fs.existsSync(p)) return res.status(404).json({ error: "Project not found" });

    const projectData = JSON.parse(fs.readFileSync(p, "utf-8"));

    const archive = new ZipArchive({ zlib: { level: 9 } });
    res.attachment(\`\${filename}.zip\`);
    archive.pipe(res);

    archive.append(fs.readFileSync(p), { name: \`\${filename}.json\` });

    // Assuming assets array is in projectData
    if (projectData.assets && Array.isArray(projectData.assets)) {
      projectData.assets.forEach((asset: any) => {
        const assetPath = path.join(UPLOADS_DIR, asset.filename);
        if (fs.existsSync(assetPath)) {
          archive.append(fs.readFileSync(assetPath), { name: \`assets/\${asset.filename}\` });
        }
      });
    }

    archive.finalize();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/projects/import", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No zip file provided" });
    const extractDir = path.join(ROOT_DIR, "tmp", req.file.filename + "_extract");
    fs.mkdirSync(extractDir, { recursive: true });

    await fs.createReadStream(req.file.path)
      .pipe(unzipper.Extract({ path: extractDir }))
      .promise();

    // Look for json file
    const files = fs.readdirSync(extractDir);
    const jsonFile = files.find(f => f.endsWith(".json"));
    if (!jsonFile) throw new Error("No JSON project file found in zip");

    const projectData = JSON.parse(fs.readFileSync(path.join(extractDir, jsonFile), "utf-8"));
    const projectName = jsonFile.replace(".json", "");

    fs.copyFileSync(path.join(extractDir, jsonFile), path.join(PROJECTS_DIR, jsonFile));

    // Move assets if they exist
    const extractedAssetsDir = path.join(extractDir, "assets");
    if (fs.existsSync(extractedAssetsDir)) {
      const assets = fs.readdirSync(extractedAssetsDir);
      for (const a of assets) {
        fs.copyFileSync(path.join(extractedAssetsDir, a), path.join(UPLOADS_DIR, a));
      }
    }

    // Cleanup
    fs.unlinkSync(req.file.path);
    fs.rmSync(extractDir, { recursive: true, force: true });

    res.json({ success: true, project: projectName });
  } catch (err: any) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});`;

code = code.replace(
  /\/\/ Mock export route so frontend doesn't break[\s\S]*?import not implemented in restored mock"\ \}\);\n\}\);/,
  replacement
);

fs.writeFileSync('server.ts', code);

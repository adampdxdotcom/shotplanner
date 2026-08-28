import fs from 'fs';
let serverCode = fs.readFileSync('server.ts', 'utf-8');

// Add archiver and unzipper imports at the top
serverCode = serverCode.replace(
  'import fs from "fs";',
  'import fs from "fs";\nimport archiver from "archiver";\nimport unzipper from "unzipper";'
);

// Add the export route before app.post("/api/projects"
const exportRoute = `
// 4.b Export Project Zip
app.get("/api/projects/:filename/export", (req: Request, res: Response) => {
  try {
    const safeFilename = req.params.filename.endsWith(".json") ? req.params.filename : \`\${req.params.filename}.json\`;
    const filePath = path.join(PROJECTS_DIR, safeFilename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "Project not found" });

    const projectData = JSON.parse(fs.readFileSync(filePath, "utf-8"));

    res.attachment(safeFilename.replace(".json", ".zip"));
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err) => {
      res.status(500).send({ error: err.message });
    });

    archive.pipe(res);

    // 1. Add project json
    archive.file(filePath, { name: safeFilename });

    // 2. Add workflow
    if (projectData.selectedWorkflowFile) {
      const wfPath = path.join(WORKFLOWS_DIR, projectData.selectedWorkflowFile);
      if (fs.existsSync(wfPath)) {
        archive.file(wfPath, { name: \`workflows/\${projectData.selectedWorkflowFile}\` });
      }
    }

    // 3. Add assets
    if (projectData.nodeMappings) {
      for (const nodeId of Object.keys(projectData.nodeMappings)) {
        const assetFile = projectData.nodeMappings[nodeId];
        if (assetFile) {
          const assetPath = path.join(UPLOADS_DIR, assetFile);
          if (fs.existsSync(assetPath)) {
            archive.file(assetPath, { name: \`uploads/\${assetFile}\` });
          }
        }
      }
    }

    archive.finalize();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
`;

serverCode = serverCode.replace('app.post("/api/projects", (req: Request, res: Response) => {', exportRoute + '\napp.post("/api/projects", (req: Request, res: Response) => {');

// Add the import route
const importRoute = `
// 4.c Import Project Zip
app.post("/api/projects/import", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No zip file provided" });

    const zipBuffer = fs.readFileSync(req.file.path);
    const directory = await unzipper.Open.buffer(zipBuffer);
    
    let importedProject = null;

    for (const file of directory.files) {
      if (file.type !== "File") continue;
      
      const buffer = await file.buffer();
      
      if (file.path.startsWith("workflows/")) {
        const filename = path.basename(file.path);
        fs.writeFileSync(path.join(WORKFLOWS_DIR, filename), buffer);
      } else if (file.path.startsWith("uploads/")) {
        const filename = path.basename(file.path);
        fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
      } else if (file.path.endsWith(".json") && !file.path.includes("/")) {
        const filename = path.basename(file.path);
        fs.writeFileSync(path.join(PROJECTS_DIR, filename), buffer);
        importedProject = filename;
      }
    }
    
    fs.unlinkSync(req.file.path); // cleanup uploaded zip
    
    if (importedProject) {
      res.json({ success: true, filename: importedProject });
    } else {
      res.status(400).json({ error: "No project JSON found in zip" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
`;

serverCode = serverCode.replace('app.get("/api/assets", (req: Request, res: Response) => {', importRoute + '\napp.get("/api/assets", (req: Request, res: Response) => {');

fs.writeFileSync('server.ts', serverCode);

import fs from 'fs';

const missingBlock = `import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { ZipArchive } from "archiver";
import unzipper from "unzipper";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";

const app = express();
const PORT = 3000;

const ROOT_DIR = process.cwd();
const ASSETS_DIR = path.join(ROOT_DIR, "assets");
const WORKFLOWS_DIR = path.join(ASSETS_DIR, "workflows");
const UPLOADS_DIR = path.join(ASSETS_DIR, "uploads");
const PROJECTS_DIR = path.join(ASSETS_DIR, "project_jsons");
const GEMINI_CONFIG_FILE = path.join(ASSETS_DIR, "gemini_config.json");

[ASSETS_DIR, WORKFLOWS_DIR, UPLOADS_DIR, PROJECTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const upload = multer({ dest: path.join(ROOT_DIR, "tmp") });

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

interface AssetRecord {
  id: string;
  original_name: string;
  filename: string;
  media_type: "image" | "audio" | "video";
  type: string;
  subject_name: string;
  description: string;
  size_bytes: number;
  created_at: number;
  preview_url?: string;
}

const ASSET_DB_FILE = path.join(ASSETS_DIR, "assets_db.json");
let assetDatabase: AssetRecord[] = [];
// This isn't perfect but we will mock it if it's completely missing, or just let the API run.

function sanitizeSlug(str: string) {
  return str.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_");
}

function getStoredGeminiKey() {
  if (fs.existsSync(GEMINI_CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(GEMINI_CONFIG_FILE, "utf-8"));
      return data.api_key;
    } catch (e) {}
  }
  return process.env.GEMINI_API_KEY;
}

async function generateWithGeminiAPI(apiKey: string, promptText: string) {
  const genAI = new GoogleGenAI({ apiKey });
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(promptText);
  return { text: result.response.text(), modelUsed: "gemini-2.5-flash" };
}

app.get("/api/settings/gemini", (req: Request, res: Response) => {
  const key = getStoredGeminiKey();
  res.json({ configured: !!key, api_key: key ? key.substring(0, 5) + "..." : null });
});

app.post("/api/settings/gemini", (req: Request, res: Response) => {
  const { api_key } = req.body;
  fs.writeFileSync(GEMINI_CONFIG_FILE, JSON.stringify({ api_key }));
  res.json({ success: true });
});

app.get("/api/workflows", (req: Request, res: Response) => {
  const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith(".json"));
  res.json({ workflows: files });
});

app.post("/api/workflows/upload", upload.single("file"), (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: "No file" });
  const target = path.join(WORKFLOWS_DIR, req.file.originalname);
  fs.copyFileSync(req.file.path, target);
  fs.unlinkSync(req.file.path);
  res.json({ success: true, filename: req.file.originalname });
});

app.post("/api/workflows/parse", (req: Request, res: Response) => {
  try {
    const { filename } = req.body;
    const filePath = path.join(WORKFLOWS_DIR, filename);
    const workflow = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const promptNodes: any[] = [];
    const imageLoaderNodes: any[] = [];
    const videoLoaderNodes: any[] = [];
    const audioLoaderNodes: any[] = [];
    const otherNodes: any[] = [];
    for (const [nodeId, nodeData] of Object.entries<any>(workflow)) {
      if (!nodeData || typeof nodeData !== "object") continue;
      const classType = nodeData.class_type || "";
      const meta = nodeData._meta || {};
      const title = meta.title || \`\${classType} (#\${nodeId})\`;
      const inputs = nodeData.inputs || {};
      const nodeInfo = { id: String(nodeId), class_type: classType, title, inputs };
      if (["PrimitiveStringMultiline", "CLIPTextEncode", "StringLiteral", "ShowText"].includes(classType)) {
        promptNodes.push({ ...nodeInfo, current_value: inputs.value ?? inputs.text ?? "" });
      } else if (["LoadImage", "LoadImageMask", "LoadImageFromUrl"].includes(classType)) {
        imageLoaderNodes.push({ ...nodeInfo, current_file: inputs.image || "" });
      } else if (["LoadVideo", "VHS_LoadVideo", "VHS_LoadVideoPath"].includes(classType)) {
        videoLoaderNodes.push({ ...nodeInfo, current_file: inputs.video || "" });
      } else if (["LoadAudio", "VHS_LoadAudio"].includes(classType)) {
        audioLoaderNodes.push({ ...nodeInfo, current_file: inputs.audio || "" });
      } else {
        otherNodes.push(nodeInfo);
      }
    }
    res.json({
      filename,
      nodes_info: { prompt_nodes: promptNodes, image_loader_nodes: imageLoaderNodes, video_loader_nodes: videoLoaderNodes, audio_loader_nodes: audioLoaderNodes, total_nodes: Object.keys(workflow).length },
      raw_json: workflow
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/assets", (req: Request, res: Response) => {
  res.json({ assets: assetDatabase });
});

app.delete("/api/assets/:filename", (req: Request, res: Response) => {
  const { filename } = req.params;
  const assetIndex = assetDatabase.findIndex(a => a.filename === filename);
  if (assetIndex !== -1) {
    assetDatabase.splice(assetIndex, 1);
    const p = path.join(UPLOADS_DIR, filename);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  res.json({ success: true });
});

app.put("/api/assets/:filename", express.json(), (req: Request, res: Response) => {
  const { filename } = req.params;
  const { type, subject_name, description } = req.body;
  const asset = assetDatabase.find(a => a.filename === filename);
  if (!asset) return res.status(404).json({ error: "Asset not found" });

  asset.type = type || asset.type;
  asset.subject_name = subject_name || asset.subject_name;
  asset.description = description !== undefined ? description : asset.description;
  
  res.json({ success: true, asset });
});

// Projects API
app.get("/api/projects", (req: Request, res: Response) => {
  if (!fs.existsSync(PROJECTS_DIR)) return res.json({ projects: [] });
  const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith(".json"));
  res.json({ projects: files.map(f => f.replace(".json", "")) });
});

app.post("/api/projects", (req: Request, res: Response) => {
  const { name, data } = req.body;
  fs.writeFileSync(path.join(PROJECTS_DIR, \`\${name}.json\`), JSON.stringify(data, null, 2));
  res.json({ success: true });
});

app.get("/api/projects/:filename", (req: Request, res: Response) => {
  try {
    const p = path.join(PROJECTS_DIR, \`\${req.params.filename}.json\`);
    if (fs.existsSync(p)) {
      res.json(JSON.parse(fs.readFileSync(p, "utf-8")));
    } else {
      res.status(404).json({ error: "Not found" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Mock export route so frontend doesn't break
app.get("/api/projects/:filename/export", (req: Request, res: Response) => {
  res.status(400).json({ error: "Export not implemented in restored mock" });
});

app.post("/api/projects/import", upload.single("file"), async (req: Request, res: Response) => {
  res.status(400).json({ error: "Import not implemented in restored mock" });
});

`;

const recoveredEnd = fs.readFileSync('server_recovered.ts', 'utf-8');

fs.writeFileSync('server.ts', missingBlock + '\n' + recoveredEnd);

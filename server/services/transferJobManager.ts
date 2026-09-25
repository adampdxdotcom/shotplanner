import fs from "fs";
import path from "path";
import { Response } from "express";
import { SERVER_CONFIG_DIR } from "../config/constants";
import { writeJsonAtomicSync, readJsonWithBackupRecoverySync } from "../utils/atomicFs";
import { createScopedLogger } from "../utils/logger";

const log = createScopedLogger("TransferJobManager");
const RECENT_ASSETS_FILE = path.join(SERVER_CONFIG_DIR, "recent_assets.json");

export interface RecentAssetItem {
  id: string;
  filename: string;
  size_bytes: number;
  remote_path: string;
  status: "transferred" | "verified";
  timestamp: string;
  scene_name?: string;
  shot_number?: string | number;
}

export interface TransferFileProgressItem {
  filename: string;
  file: string;
  size_bytes: number;
  status: "pending" | "transferring" | "transferred" | "failed" | "skipped";
  remote_path?: string;
  transferred_bytes?: number;
  percent?: number;
  message?: string;
  duration_ms?: number;
}

export interface ActiveTransferJob {
  jobId: string;
  status: "idle" | "in_progress" | "completed" | "error";
  action: "shot" | "scene" | "execute_shot" | "assets";
  sceneName?: string;
  shotNumber?: string | number;
  targetHost?: string;
  currentFile?: string;
  fileIndex: number;
  totalFiles: number;
  fileBytesTransferred: number;
  fileTotalBytes: number;
  filePercent: number;
  totalBytesTransferred: number;
  totalBytes: number;
  totalPercent: number;
  statusMessage: string;
  activeFiles: TransferFileProgressItem[];
  transferredFiles: TransferFileProgressItem[];
  failedFiles: string[];
  startedAt: number;
  completedAt?: number;
  error?: string;
  transferResult?: any;
}

class TransferJobManager {
  private currentJob: ActiveTransferJob | null = null;
  private latestJob: ActiveTransferJob | null = null;
  private sseClients: Set<Response> = new Set();
  private recentAssets: RecentAssetItem[] = [];
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.loadRecentAssets();
    this.startHeartbeat();
  }

  private loadRecentAssets(): void {
    try {
      if (fs.existsSync(RECENT_ASSETS_FILE)) {
        const loaded = readJsonWithBackupRecoverySync<RecentAssetItem[]>(RECENT_ASSETS_FILE);
        if (Array.isArray(loaded)) {
          this.recentAssets = loaded;
        }
      }
    } catch (err: any) {
      log.warn("Failed to load recent assets from disk", { error: err.message });
      this.recentAssets = [];
    }
  }

  private persistRecentAssets(): void {
    try {
      if (!fs.existsSync(SERVER_CONFIG_DIR)) {
        fs.mkdirSync(SERVER_CONFIG_DIR, { recursive: true });
      }
      writeJsonAtomicSync(RECENT_ASSETS_FILE, this.recentAssets);
    } catch (err: any) {
      log.warn("Failed to persist recent assets", { error: err.message });
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => {
      this.broadcastRaw(": heartbeat\n\n");
    }, 15000);
  }

  public registerSSEClient(res: Response): void {
    this.sseClients.add(res);
    log.info(`Registered SSE client for transfer events (Total: ${this.sseClients.size})`);

    // Immediately push current status
    const currentStatus = this.getCurrentJob() || this.getLatestJob();
    const payload = JSON.stringify({
      type: "sync",
      job: currentStatus,
      recentAssets: this.getRecentAssets()
    });
    res.write(`data: ${payload}\n\n`);
  }

  public unregisterSSEClient(res: Response): void {
    this.sseClients.delete(res);
    log.info(`Unregistered SSE client for transfer events (Remaining: ${this.sseClients.size})`);
  }

  private broadcast(data: any): void {
    const raw = `data: ${JSON.stringify(data)}\n\n`;
    this.broadcastRaw(raw);
  }

  private broadcastRaw(rawMessage: string): void {
    const deadClients: Response[] = [];
    for (const client of this.sseClients) {
      try {
        client.write(rawMessage);
      } catch (err) {
        deadClients.push(client);
      }
    }
    deadClients.forEach(c => this.sseClients.delete(c));
  }

  public startJob(params: {
    jobId?: string;
    action?: "shot" | "scene" | "execute_shot" | "assets";
    sceneName?: string;
    shotNumber?: string | number;
    targetHost?: string;
    totalFiles?: number;
    initialFiles?: Array<{ filename: string; sizeBytes?: number; remotePath?: string }>;
  }): ActiveTransferJob {
    const jobId = params.jobId || `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const action = params.action || "shot";
    const initialFiles = params.initialFiles || [];
    const totalFiles = params.totalFiles ?? initialFiles.length;

    const totalBytes = initialFiles.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);

    const activeFiles: TransferFileProgressItem[] = initialFiles.map(f => ({
      filename: f.filename,
      file: f.filename,
      size_bytes: f.sizeBytes || 0,
      remote_path: f.remotePath,
      status: "pending",
      transferred_bytes: 0,
      percent: 0
    }));

    this.currentJob = {
      jobId,
      status: "in_progress",
      action,
      sceneName: params.sceneName,
      shotNumber: params.shotNumber,
      targetHost: params.targetHost,
      currentFile: activeFiles[0]?.filename || undefined,
      fileIndex: 0,
      totalFiles,
      fileBytesTransferred: 0,
      fileTotalBytes: activeFiles[0]?.size_bytes || 0,
      filePercent: 0,
      totalBytesTransferred: 0,
      totalBytes,
      totalPercent: 0,
      statusMessage: "Connecting to remote GPU...",
      activeFiles,
      transferredFiles: [],
      failedFiles: [],
      startedAt: Date.now()
    };

    log.info(`Transfer job "${jobId}" started (${totalFiles} files to ${params.targetHost || "remote"})`);
    this.broadcast({ type: "job_started", job: this.currentJob });
    return this.currentJob;
  }

  public updateFileStart(filename: string, fileIndex: number, totalFiles: number, sizeBytes: number): void {
    if (!this.currentJob) return;

    this.currentJob.currentFile = filename;
    this.currentJob.fileIndex = fileIndex;
    this.currentJob.totalFiles = totalFiles;
    this.currentJob.fileBytesTransferred = 0;
    this.currentJob.fileTotalBytes = sizeBytes;
    this.currentJob.filePercent = 0;
    this.currentJob.statusMessage = `[${fileIndex + 1}/${totalFiles}] Transferring ${filename}...`;

    const existing = this.currentJob.activeFiles.find(f => f.filename === filename);
    if (existing) {
      existing.status = "transferring";
      existing.size_bytes = sizeBytes;
    } else {
      this.currentJob.activeFiles.push({
        filename,
        file: filename,
        size_bytes: sizeBytes,
        status: "transferring",
        transferred_bytes: 0,
        percent: 0
      });
    }

    this.broadcast({
      type: "file_started",
      job: this.currentJob,
      file: { filename, fileIndex, totalFiles, sizeBytes }
    });
  }

  public updateFileProgress(
    filename: string,
    fileBytesTransferred: number,
    fileTotalBytes: number,
    filePercent: number,
    totalBytesTransferred: number,
    overallPercent: number
  ): void {
    if (!this.currentJob) return;

    this.currentJob.currentFile = filename;
    this.currentJob.fileBytesTransferred = fileBytesTransferred;
    this.currentJob.fileTotalBytes = fileTotalBytes;
    this.currentJob.filePercent = filePercent;
    this.currentJob.totalBytesTransferred = totalBytesTransferred;
    this.currentJob.totalPercent = overallPercent;

    const kbTransferred = (fileBytesTransferred / 1024).toFixed(1);
    const kbTotal = (fileTotalBytes / 1024).toFixed(1);
    this.currentJob.statusMessage = `[${this.currentJob.fileIndex + 1}/${this.currentJob.totalFiles}] ${filename}: ${kbTransferred}/${kbTotal} KB (${filePercent}%)`;

    const activeItem = this.currentJob.activeFiles.find(f => f.filename === filename);
    if (activeItem) {
      activeItem.transferred_bytes = fileBytesTransferred;
      activeItem.percent = filePercent;
      activeItem.status = "transferring";
    }

    this.broadcast({
      type: "file_progress",
      job: this.currentJob,
      progress: {
        filename,
        fileBytesTransferred,
        fileTotalBytes,
        filePercent,
        totalBytesTransferred,
        overallPercent
      }
    });
  }

  public updateFileComplete(
    filename: string,
    sizeBytes: number,
    remotePath: string,
    durationMs: number,
    message?: string
  ): void {
    if (!this.currentJob) return;

    const fileResult: TransferFileProgressItem = {
      filename,
      file: filename,
      size_bytes: sizeBytes,
      status: "transferred",
      remote_path: remotePath,
      transferred_bytes: sizeBytes,
      percent: 100,
      message: message || `Transferred in ${durationMs}ms`,
      duration_ms: durationMs
    };

    // Update in active files list
    const activeItem = this.currentJob.activeFiles.find(f => f.filename === filename);
    if (activeItem) {
      activeItem.status = "transferred";
      activeItem.percent = 100;
      activeItem.transferred_bytes = sizeBytes;
      activeItem.duration_ms = durationMs;
      activeItem.remote_path = remotePath;
      activeItem.message = fileResult.message;
    } else {
      this.currentJob.activeFiles.push(fileResult);
    }

    this.currentJob.transferredFiles.push(fileResult);
    this.currentJob.statusMessage = `Verified and transferred ${filename} (${(sizeBytes / 1024).toFixed(1)} KB)`;

    // Record to global recent assets running list
    this.recordTransferredAsset({
      filename,
      size_bytes: sizeBytes,
      remote_path: remotePath,
      status: "transferred",
      scene_name: this.currentJob.sceneName,
      shot_number: this.currentJob.shotNumber
    });

    this.broadcast({
      type: "file_completed",
      job: this.currentJob,
      file: fileResult
    });
  }

  public updateFileError(filename: string, remotePath: string, errorMessage: string): void {
    if (!this.currentJob) return;

    this.currentJob.failedFiles.push(filename);
    const activeItem = this.currentJob.activeFiles.find(f => f.filename === filename);
    if (activeItem) {
      activeItem.status = "failed";
      activeItem.message = errorMessage;
    }

    this.broadcast({
      type: "file_failed",
      job: this.currentJob,
      file: { filename, remotePath, error: errorMessage }
    });
  }

  public updateStepMessage(message: string): void {
    if (!this.currentJob) return;
    this.currentJob.statusMessage = message;
    this.broadcast({
      type: "step_message",
      job: this.currentJob,
      message
    });
  }

  public completeJob(result: any): void {
    if (!this.currentJob) return;

    this.currentJob.status = "completed";
    this.currentJob.totalPercent = 100;
    this.currentJob.filePercent = 100;
    this.currentJob.completedAt = Date.now();
    this.currentJob.transferResult = result;
    this.currentJob.statusMessage = result?.message || `Successfully transferred ${this.currentJob.transferredFiles.length} file(s).`;

    this.latestJob = { ...this.currentJob };
    const finishedJob = this.currentJob;
    this.currentJob = null;

    log.info(`Transfer job "${finishedJob.jobId}" completed successfully`);
    this.broadcast({
      type: "job_completed",
      job: finishedJob,
      result,
      recentAssets: this.getRecentAssets()
    });
  }

  public failJob(errorMessage: string): void {
    if (!this.currentJob) return;

    this.currentJob.status = "error";
    this.currentJob.error = errorMessage;
    this.currentJob.completedAt = Date.now();
    this.currentJob.statusMessage = `Failed: ${errorMessage}`;

    this.latestJob = { ...this.currentJob };
    const failedJob = this.currentJob;
    this.currentJob = null;

    log.error(`Transfer job "${failedJob.jobId}" failed: ${errorMessage}`);
    this.broadcast({
      type: "job_failed",
      job: failedJob,
      error: errorMessage
    });
  }

  public recordTransferredAsset(asset: Omit<RecentAssetItem, "id" | "timestamp">): void {
    const existingIndex = this.recentAssets.findIndex(
      a => a.filename === asset.filename && a.remote_path === asset.remote_path
    );

    const updatedItem: RecentAssetItem = {
      id: `asset_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      filename: asset.filename,
      size_bytes: asset.size_bytes,
      remote_path: asset.remote_path,
      status: asset.status || "transferred",
      timestamp: new Date().toISOString(),
      scene_name: asset.scene_name,
      shot_number: asset.shot_number
    };

    if (existingIndex >= 0) {
      this.recentAssets.splice(existingIndex, 1);
    }

    this.recentAssets.unshift(updatedItem);

    // Limit running history to latest 150 entries
    if (this.recentAssets.length > 150) {
      this.recentAssets = this.recentAssets.slice(0, 150);
    }

    this.persistRecentAssets();
  }

  public getCurrentJob(): ActiveTransferJob | null {
    return this.currentJob;
  }

  public getLatestJob(): ActiveTransferJob | null {
    return this.latestJob;
  }

  public getRecentAssets(): RecentAssetItem[] {
    return this.recentAssets;
  }

  public clearRecentAssets(): void {
    this.recentAssets = [];
    this.persistRecentAssets();
    this.broadcast({ type: "recent_assets_cleared" });
  }
}

export const transferJobManager = new TransferJobManager();

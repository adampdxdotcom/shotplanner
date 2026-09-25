import { describe, it, expect, beforeEach } from "vitest";
import { transferJobManager } from "../../server/services/transferJobManager";

describe("TransferJobManager - Real-Time SFTP Upload & Recent Assets Tracking", () => {
  beforeEach(() => {
    transferJobManager.clearRecentAssets();
  });

  it("initializes a transfer job with accurate file queues and overall bytes", () => {
    const job = transferJobManager.startJob({
      jobId: "test_job_1",
      action: "shot",
      sceneName: "Scene01",
      shotNumber: 1,
      targetHost: "192.168.1.100",
      initialFiles: [
        { filename: "char1.png", sizeBytes: 1000, remotePath: "/input/char1.png" },
        { filename: "char2.png", sizeBytes: 2000, remotePath: "/input/char2.png" }
      ]
    });

    expect(job.jobId).toBe("test_job_1");
    expect(job.status).toBe("in_progress");
    expect(job.totalFiles).toBe(2);
    expect(job.totalBytes).toBe(3000);
    expect(job.totalPercent).toBe(0);
    expect(job.activeFiles.length).toBe(2);
    expect(job.activeFiles[0].filename).toBe("char1.png");
  });

  it("updates file start and chunk progress accurately without stalls", () => {
    transferJobManager.startJob({
      jobId: "test_job_2",
      action: "shot",
      initialFiles: [
        { filename: "asset1.png", sizeBytes: 2000 },
        { filename: "asset2.png", sizeBytes: 2000 }
      ]
    });

    transferJobManager.updateFileStart("asset1.png", 0, 2, 2000);
    let current = transferJobManager.getCurrentJob();
    expect(current?.currentFile).toBe("asset1.png");
    expect(current?.fileIndex).toBe(0);
    expect(current?.statusMessage).toContain("asset1.png");

    // Chunk progress
    transferJobManager.updateFileProgress("asset1.png", 1000, 2000, 50, 1000, 25);
    current = transferJobManager.getCurrentJob();
    expect(current?.fileBytesTransferred).toBe(1000);
    expect(current?.filePercent).toBe(50);
    expect(current?.totalPercent).toBe(25);

    // File completion
    transferJobManager.updateFileComplete("asset1.png", 2000, "/workspace/input/asset1.png", 150);
    current = transferJobManager.getCurrentJob();
    expect(current?.transferredFiles.length).toBe(1);
    expect(current?.transferredFiles[0].filename).toBe("asset1.png");
    expect(current?.transferredFiles[0].status).toBe("transferred");

    // Check recent assets running history
    const recent = transferJobManager.getRecentAssets();
    expect(recent.length).toBe(1);
    expect(recent[0].filename).toBe("asset1.png");
    expect(recent[0].remote_path).toBe("/workspace/input/asset1.png");
  });

  it("deduplicates recent assets and maintains running history on successive transfers", () => {
    transferJobManager.recordTransferredAsset({
      filename: "hero_face.png",
      size_bytes: 1024,
      remote_path: "/input/hero_face.png",
      status: "transferred",
      scene_name: "Scene01"
    });

    transferJobManager.recordTransferredAsset({
      filename: "background.png",
      size_bytes: 2048,
      remote_path: "/input/background.png",
      status: "transferred",
      scene_name: "Scene01"
    });

    let recent = transferJobManager.getRecentAssets();
    expect(recent.length).toBe(2);
    expect(recent[0].filename).toBe("background.png"); // Most recent first

    // Re-transferring hero_face updates it to the top
    transferJobManager.recordTransferredAsset({
      filename: "hero_face.png",
      size_bytes: 1500,
      remote_path: "/input/hero_face.png",
      status: "transferred",
      scene_name: "Scene01"
    });

    recent = transferJobManager.getRecentAssets();
    expect(recent.length).toBe(2);
    expect(recent[0].filename).toBe("hero_face.png");
    expect(recent[0].size_bytes).toBe(1500);
  });

  it("marks job as completed and keeps latestJob accessible after completion", () => {
    transferJobManager.startJob({
      jobId: "completed_test",
      action: "scene",
      totalFiles: 1
    });

    transferJobManager.completeJob({
      success: true,
      transferred_count: 1,
      message: "Staged 1 file"
    });

    expect(transferJobManager.getCurrentJob()).toBeNull();
    const latest = transferJobManager.getLatestJob();
    expect(latest?.jobId).toBe("completed_test");
    expect(latest?.status).toBe("completed");
    expect(latest?.totalPercent).toBe(100);
  });

  it("marks job as failed and records error message", () => {
    transferJobManager.startJob({
      jobId: "failed_test",
      action: "shot"
    });

    transferJobManager.failJob("SSH connection timed out after 30s");

    expect(transferJobManager.getCurrentJob()).toBeNull();
    const latest = transferJobManager.getLatestJob();
    expect(latest?.jobId).toBe("failed_test");
    expect(latest?.status).toBe("error");
    expect(latest?.error).toBe("SSH connection timed out after 30s");
  });
});

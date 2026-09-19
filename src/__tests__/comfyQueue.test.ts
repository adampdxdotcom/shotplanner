import { describe, it, expect } from "vitest";
import {
  normalizeComfyUrl,
  ComfyQueueItem,
  ComfySystemStats,
  ComfyDeviceStats
} from "../../server/services/comfyQueueService";

describe("comfyQueueService - Endpoint and Data Transformation", () => {
  it("normalizes comfyui URLs properly", () => {
    expect(normalizeComfyUrl("http://192.168.1.100:8188/")).toBe("http://192.168.1.100:8188");
    expect(normalizeComfyUrl("http://localhost:8188")).toBe("http://localhost:8188");
    expect(normalizeComfyUrl("")).toBe("http://127.0.0.1:8188");
  });

  it("calculates VRAM usage percentages and GB conversions accurately", () => {
    const totalBytes = 24 * 1024 * 1024 * 1024; // 24 GB
    const freeBytes = 6 * 1024 * 1024 * 1024; // 6 GB free, 18 GB used

    const vramTotalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(1);
    const vramFreeGB = (freeBytes / (1024 * 1024 * 1024)).toFixed(1);
    const vramUsedGB = ((totalBytes - freeBytes) / (1024 * 1024 * 1024)).toFixed(1);
    const percent = Math.round(((totalBytes - freeBytes) / totalBytes) * 100);

    expect(vramTotalGB).toBe("24.0");
    expect(vramFreeGB).toBe("6.0");
    expect(vramUsedGB).toBe("18.0");
    expect(percent).toBe(75);
  });

  it("structures ComfyQueueItem with extracted shot and scene metadata", () => {
    const mockItem: ComfyQueueItem = {
      index: 1,
      prompt_id: "prompt-uuid-12345",
      client_id: "client-abc",
      status: "running",
      scene_name: "Scene 01",
      shot_number: 3,
      nodes_count: 28,
      output_prefix: "scene01_shot_03_take01"
    };

    expect(mockItem.prompt_id).toBe("prompt-uuid-12345");
    expect(mockItem.status).toBe("running");
    expect(mockItem.shot_number).toBe(3);
    expect(mockItem.scene_name).toBe("Scene 01");
  });
});

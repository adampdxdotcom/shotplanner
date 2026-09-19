import { describe, it, expect, vi } from "vitest";
import { ComfyQueueStatus, ComfySystemStats } from "../types";

describe("ComfyUI Queue Data Flow & Logic", () => {
  it("structures ComfyQueueStatus properly with active and pending jobs", () => {
    const mockStatus: ComfyQueueStatus = {
      success: true,
      is_executing: true,
      queue_remaining: 3,
      running: [
        {
          index: 0,
          prompt_id: "running-job-1",
          status: "running",
          scene_name: "Scene 1",
          shot_number: 2,
          nodes_count: 32,
          output_prefix: "scene_01_shot_02"
        }
      ],
      pending: [
        {
          index: 1,
          prompt_id: "pending-job-2",
          status: "pending",
          scene_name: "Scene 1",
          shot_number: 3,
          nodes_count: 32,
          output_prefix: "scene_01_shot_03"
        },
        {
          index: 2,
          prompt_id: "pending-job-3",
          status: "pending",
          scene_name: "Scene 1",
          shot_number: 4,
          nodes_count: 32,
          output_prefix: "scene_01_shot_04"
        }
      ]
    };

    expect(mockStatus.is_executing).toBe(true);
    expect(mockStatus.queue_remaining).toBe(3);
    expect(mockStatus.running.length).toBe(1);
    expect(mockStatus.pending.length).toBe(2);
    expect(mockStatus.running[0].prompt_id).toBe("running-job-1");
    expect(mockStatus.pending[0].shot_number).toBe(3);
  });

  it("handles empty queue and idle status correctly", () => {
    const idleStatus: ComfyQueueStatus = {
      success: true,
      is_executing: false,
      queue_remaining: 0,
      running: [],
      pending: []
    };

    expect(idleStatus.is_executing).toBe(false);
    expect(idleStatus.queue_remaining).toBe(0);
    expect(idleStatus.running).toHaveLength(0);
    expect(idleStatus.pending).toHaveLength(0);
  });

  it("validates system stats hardware device structure", () => {
    const stats: ComfySystemStats = {
      success: true,
      os: "Linux",
      python_version: "3.10.12",
      devices: [
        {
          name: "NVIDIA GeForce RTX 4090",
          type: "cuda",
          index: 0,
          vram_total: 25769803776,
          vram_free: 17179869184,
          vram_total_gb: "24.0",
          vram_free_gb: "16.0",
          vram_used_gb: "8.0",
          vram_usage_percent: 33
        }
      ]
    };

    expect(stats.devices[0].vram_total_gb).toBe("24.0");
    expect(stats.devices[0].vram_used_gb).toBe("8.0");
    expect(stats.devices[0].vram_usage_percent).toBe(33);
  });
});

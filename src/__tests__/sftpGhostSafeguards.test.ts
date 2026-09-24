import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import { 
  resolveLocalAssetsForTransfer, 
  ensureEmptyPngExists 
} from "../../server/services/execution/sftpTransferHelper";
import { injectAndPrepareWorkflowData } from "../../server/services/workflow/workflowInjector";
import { UPLOADS_DIR } from "../../server/config/constants";

describe("SFTP Staging Queue & Workflow Injection Safeguards (Phase 3)", () => {
  const testRealAsset = "test_real_asset_123.png";
  const testRealAssetPath = path.join(UPLOADS_DIR, testRealAsset);

  beforeEach(() => {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    fs.writeFileSync(testRealAssetPath, "dummy png bytes");
  });

  afterEach(() => {
    try {
      if (fs.existsSync(testRealAssetPath)) fs.unlinkSync(testRealAssetPath);
    } catch {}
  });

  it("ensureEmptyPngExists creates empty.png in uploads directory", () => {
    const emptyPath = ensureEmptyPngExists();
    expect(fs.existsSync(emptyPath)).toBe(true);
    expect(emptyPath.endsWith("empty.png")).toBe(true);
  });

  it("resolveLocalAssetsForTransfer separates existing assets from ghost files without failing", () => {
    const filenames = [testRealAsset, "ghost_deleted_asset_404.png", "empty.png"];
    const remoteDir = "/workspace/ComfyUI/input";

    const { sftpItems, missingSummary } = resolveLocalAssetsForTransfer(filenames, remoteDir);

    // Existing files are queued for SFTP upload
    expect(sftpItems.some(item => item.filename === testRealAsset)).toBe(true);
    expect(sftpItems.some(item => item.filename === "empty.png")).toBe(true);

    // Ghost file is recorded in missingSummary with status missing_locally
    expect(missingSummary.length).toBe(1);
    expect(missingSummary[0].filename).toBe("ghost_deleted_asset_404.png");
    expect(missingSummary[0].status).toBe("missing_locally");

    // Ghost file is NOT queued for upload to prevent SFTP failure
    expect(sftpItems.some(item => item.filename === "ghost_deleted_asset_404.png")).toBe(false);
  });

  it("workflow injection safely substitutes missing node mappings with safe placeholder empty.png", () => {
    const mockWorkflow = {
      nodes: [
        {
          id: 10,
          type: "LoadImage",
          title: "Character Ref",
          widgets_values: ["ghost_deleted_asset_404.png"]
        },
        {
          id: 6,
          type: "CLIPTextEncode",
          title: "Prompt",
          widgets_values: ["Original prompt text"]
        }
      ],
      links: []
    };

    // Node 10 has a ghost file mapping
    const nodeMappings = {
      "10": "ghost_deleted_asset_404.png"
    };

    // Simulate sanitize pass done before injection
    const missingFilenames = new Set(["ghost_deleted_asset_404.png"]);
    const sanitizedMappings = { ...nodeMappings };
    for (const [nodeId, fn] of Object.entries(sanitizedMappings)) {
      if (missingFilenames.has(fn)) {
        sanitizedMappings[nodeId] = "empty.png";
      }
    }

    const injected = injectAndPrepareWorkflowData(
      mockWorkflow,
      "6",
      "Cinematic Neo walking in rain",
      sanitizedMappings,
      true,
      "empty.png"
    );

    const loaderNode = injected.nodes.find((n: any) => n.id === 10);
    expect(loaderNode.widgets_values[0]).toBe("empty.png");

    const promptNode = injected.nodes.find((n: any) => n.id === 6);
    expect(promptNode.widgets_values[0]).toContain("Cinematic Neo");
  });
});

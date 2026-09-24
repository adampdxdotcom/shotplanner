import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  logger,
  createScopedLogger,
  sanitizeLogValue,
  LOG_LEVELS
} from "../../server/utils/logger";

describe("Structured Logger & Sanitizer (Phase 1)", () => {
  beforeEach(() => {
    logger.clearRecentLogs();
    logger.setLevel("info");
    logger.setBufferSize(100);
  });

  describe("sanitizeLogValue", () => {
    it("sanitizes base64 Data URIs into byte size indicators", () => {
      // Create a dummy base64 string
      const longBase64 = "A".repeat(200);
      const dataUri = `data:image/png;base64,${longBase64}`;
      const sanitized = sanitizeLogValue(dataUri);

      expect(sanitized).toContain("[base64 image/png:");
      expect(sanitized).not.toContain(longBase64);
    });

    it("redacts raw long base64 strings", () => {
      const rawB64 = "a".repeat(300);
      const sanitized = sanitizeLogValue(rawB64);
      expect(sanitized).toContain("[base64 string:");
      expect(sanitized).not.toContain(rawB64);
    });

    it("redacts Bearer tokens and known API key patterns", () => {
      const authHeader = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
      expect(sanitizeLogValue(authHeader)).toBe("Bearer ***");

      const hfKey = "hf_abcdefghijklmnopqrstuvwxyz012345";
      expect(sanitizeLogValue(`Using ${hfKey} for download`)).toBe("Using hf_*** for download");

      const rpaKey = "rpa_abcdefghijklmnopqrstuvwxyz012345";
      expect(sanitizeLogValue(`Key: ${rpaKey}`)).toBe("Key: rpa_***");

      const openAiKey = "sk-abcdefghijklmnopqrstuvwxyz012345";
      expect(sanitizeLogValue(`Key: ${openAiKey}`)).toBe("Key: sk-***");
    });

    it("redacts sensitive object keys recursively", () => {
      const sensitiveObj = {
        username: "creative_director",
        apiKey: "super-secret-key-12345",
        nested: {
          token: "secret-token-value",
          normalField: "visible",
          password: "password123"
        }
      };

      const result = sanitizeLogValue(sensitiveObj);
      expect(result.username).toBe("creative_director");
      expect(result.apiKey).toBe("***");
      expect(result.nested.token).toBe("***");
      expect(result.nested.password).toBe("***");
      expect(result.nested.normalField).toBe("visible");
    });

    it("handles circular references gracefully without throwing", () => {
      const circularObj: any = { name: "Root" };
      circularObj.self = circularObj;

      expect(() => {
        const sanitized = sanitizeLogValue(circularObj);
        expect(sanitized.name).toBe("Root");
        expect(sanitized.self).toBe("[Circular Reference]");
      }).not.toThrow();
    });

    it("sanitizes Error objects properly", () => {
      const err = new Error("Connection failed with token: hf_abcdefghijklmnopqrstuvwxyz012345");
      const sanitized = sanitizeLogValue(err);
      expect(sanitized.name).toBe("Error");
      expect(sanitized.message).toContain("hf_***");
    });
  });

  describe("Log Level Filtering", () => {
    it("respects log level hierarchy", () => {
      logger.setLevel("warn");

      logger.debug("Test", "Debug message");
      logger.info("Test", "Info message");
      logger.warn("Test", "Warning message");
      logger.error("Test", "Error message");

      const logs = logger.getRecentLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0].level).toBe("warn");
      expect(logs[1].level).toBe("error");
    });

    it("captures debug logs when level is set to debug", () => {
      logger.setLevel("debug");

      logger.debug("PromptEngine", "Drafting token stream");
      logger.info("PromptEngine", "Token stream completed");

      const logs = logger.getRecentLogs();
      expect(logs).toHaveLength(2);
      expect(logs[0].level).toBe("debug");
      expect(logs[0].message).toBe("Drafting token stream");
    });

    it("silences everything when level is silent", () => {
      logger.setLevel("silent");

      logger.debug("Test", "Debug");
      logger.info("Test", "Info");
      logger.warn("Test", "Warn");
      logger.error("Test", "Error");

      expect(logger.getRecentLogs()).toHaveLength(0);
    });
  });

  describe("In-Memory Ring Buffer", () => {
    it("enforces maximum buffer size by discarding oldest logs", () => {
      logger.setLevel("info");
      logger.setBufferSize(5);

      for (let i = 1; i <= 8; i++) {
        logger.info("BufferTest", `Message ${i}`);
      }

      const logs = logger.getRecentLogs();
      expect(logs).toHaveLength(5);
      expect(logs[0].message).toBe("Message 4");
      expect(logs[4].message).toBe("Message 8");
    });

    it("filters logs by tag, level, and limit", () => {
      logger.setLevel("debug");
      logger.info("Vision", "Scanned asset");
      logger.warn("Vision", "Low confidence detection");
      logger.info("Civitai", "Fetched LoRA info");
      logger.error("Civitai", "Network error");

      // Filter by tag
      const visionLogs = logger.getRecentLogs({ tag: "Vision" });
      expect(visionLogs).toHaveLength(2);
      expect(visionLogs.every(l => l.tag === "Vision")).toBe(true);

      // Filter by level
      const errorsOnly = logger.getRecentLogs({ level: "error" });
      expect(errorsOnly).toHaveLength(1);
      expect(errorsOnly[0].message).toBe("Network error");

      // Filter by limit
      const latestTwo = logger.getRecentLogs({ limit: 2 });
      expect(latestTwo).toHaveLength(2);
      expect(latestTwo[1].message).toBe("Network error");
    });

    it("reports buffer statistics accurately", () => {
      logger.setLevel("info");
      logger.info("Test", "Info 1");
      logger.info("Test", "Info 2");
      logger.warn("Test", "Warn 1");
      logger.error("Test", "Error 1");

      const stats = logger.getBufferStats();
      expect(stats.totalEntries).toBe(4);
      expect(stats.levelCounts.info).toBe(2);
      expect(stats.levelCounts.warn).toBe(1);
      expect(stats.levelCounts.error).toBe(1);
      expect(stats.currentLevel).toBe("info");
    });

    it("clears the buffer when requested", () => {
      logger.info("Test", "Before clear");
      expect(logger.getRecentLogs()).toHaveLength(1);

      logger.clearRecentLogs();
      expect(logger.getRecentLogs()).toHaveLength(0);
      expect(logger.getBufferStats().totalEntries).toBe(0);
    });
  });

  describe("Scoped Logger", () => {
    it("creates a scoped logger with consistent tagging", () => {
      logger.setLevel("info");
      const visionLog = createScopedLogger("VisionCaption");

      visionLog.info("Processed image", { dimensions: "1024x1024" });
      visionLog.warn("Slight blur detected");

      const logs = logger.getRecentLogs({ tag: "VisionCaption" });
      expect(logs).toHaveLength(2);
      expect(logs[0].tag).toBe("VisionCaption");
      expect(logs[0].message).toBe("Processed image");
      expect(logs[0].meta).toEqual({ dimensions: "1024x1024" });
      expect(logs[1].tag).toBe("VisionCaption");
      expect(logs[1].level).toBe("warn");
    });
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiClient, ApiError } from "../api/client";
import { settingsApi } from "../api/endpoints/settings";

describe("apiClient core", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("handles successful JSON GET requests and encodes query params", async () => {
    const mockData = { api_key: "gemini-test-123" };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => mockData,
    });

    const result = await apiClient.get<typeof mockData>("/api/settings/gemini", {
      params: { active: true, count: 5 },
    });

    expect(result).toEqual(mockData);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/settings/gemini?active=true&count=5",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({ Accept: "application/json" }),
      })
    );
  });

  it("handles successful POST requests with JSON payload", async () => {
    const mockRes = { message: "Key saved successfully" };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => mockRes,
    });

    const result = await settingsApi.saveGeminiKey("new-key-value");
    expect(result).toEqual(mockRes);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/settings/gemini",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ api_key: "new-key-value" }),
      })
    );
  });

  it("throws a structured ApiError when the server returns 4xx/5xx", async () => {
    const errorPayload = { error: "Invalid API Key provided" };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => errorPayload,
    });

    await expect(apiClient.get("/api/protected")).rejects.toThrow(ApiError);
    await expect(apiClient.get("/api/protected")).rejects.toMatchObject({
      status: 401,
      message: "Invalid API Key provided",
      data: errorPayload,
    });
  });

  it("supports AbortSignal cancellation", async () => {
    const controller = new AbortController();
    globalThis.fetch = vi.fn().mockImplementation((_url, opts) => {
      if (opts?.signal?.aborted) {
        return Promise.reject(new DOMException("The user aborted a request.", "AbortError"));
      }
      return Promise.resolve({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({}),
      });
    });

    controller.abort();
    await expect(
      apiClient.get("/api/test", { signal: controller.signal })
    ).rejects.toThrow("The user aborted a request.");
  });
});

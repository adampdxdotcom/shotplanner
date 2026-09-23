import { describe, it, expect, vi, beforeEach } from "vitest";
import { sanitizeCaptionOutput, generateVisionCaption, detectVisionCapability } from "../../server/services/visionCaptionService";
import { isVisionModel } from "../hooks/useVisionCaption";
import { stripThinkingTags } from "../../server/services/llm_service";
import * as projectModule from "../../server/services/project";

vi.mock("../../server/services/llm_service", async () => {
  const actual = await vi.importActual<any>("../../server/services/llm_service");
  return {
    ...actual,
    callLocalLLM: vi.fn()
  };
});

vi.mock("../../server/services/thumbnailService", () => ({
  getImageBase64ForVision: vi.fn().mockResolvedValue("data:image/jpeg;base64,fakebase64data")
}));

describe("Vision Engine - One-Pass Intelligence & Sanitation", () => {
  describe("stripThinkingTags", () => {
    it("removes <think> blocks and returns clean content", () => {
      const input = "<think>The user wants a description of Billie's attire. Let me describe it.</think>Billie wearing dark vintage bomber jacket and aviator glasses.";
      const result = stripThinkingTags(input);
      expect(result).toBe("Billie wearing dark vintage bomber jacket and aviator glasses.");
    });

    it("handles unclosed truncated <think> blocks", () => {
      const input = "<think>Analyzing image: subject is standing in a studio with soft overhead light...";
      const result = stripThinkingTags(input);
      expect(result).toBe("");
    });

    it("handles [thought] brackets", () => {
      const input = "[thought]Thinking about lighting[/thought]Subject in blue blazer beside warm window light";
      const result = stripThinkingTags(input);
      expect(result).toBe("Subject in blue blazer beside warm window light");
    });
  });

  describe("sanitizeCaptionOutput", () => {
    it("strips conversational preambles and thinking tags", () => {
      const input = "<think>Focus on attire</think>The photo shows Billie wearing an oversized charcoal coat.";
      const sanitized = sanitizeCaptionOutput(input, "Billie");
      expect(sanitized).toBe("Billie wearing an oversized charcoal coat");
    });

    it("substitutes generic person keywords with the subject name", () => {
      const input = "A person wearing tailored olive trench coat and black boots";
      const sanitized = sanitizeCaptionOutput(input, "Billie");
      expect(sanitized).toBe("Billie wearing tailored olive trench coat and black boots");
    });
  });

  describe("generateVisionCaption", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("parses single-pass JSON response with caption and structured analysis", async () => {
      const { callLocalLLM } = await import("../../server/services/llm_service");
      const mockLlmResponse = {
        content: JSON.stringify({
          caption: "Billie in vintage distressed leather jacket and sunglasses",
          analysis: {
            summary: "Billie in vintage distressed leather jacket under cinematic low-key lighting.",
            wardrobe: {
              garments: "Distressed leather bomber jacket, dark turtleneck",
              colors: "Black, charcoal",
              era_style: "90s grunge"
            },
            lighting: {
              quality: "dramatic",
              key_direction: "camera left rim",
              color_temperature: "cool",
              contrast_ratio: "high"
            },
            cinematography: {
              framing: "Medium Shot",
              lens_feel: "Anamorphic 50mm",
              depth_of_field: "shallow",
              camera_angle: "Eye Level"
            },
            environment_palette: {
              setting: "Industrial concrete loft",
              location_type: "interior",
              dominant_colors: ["#1a1a1a", "#4a4a4a"],
              mood: "Moody cinematic"
            }
          }
        }),
        model: "local-vision-model"
      };
      (callLocalLLM as any).mockResolvedValue(mockLlmResponse);

      const result = await generateVisionCaption({
        imageBase64: "data:image/jpeg;base64,testdata",
        filename: "billie_ref_01.jpg",
        subjectName: "Billie",
        contextType: "character"
      });

      expect(result.success).toBe(true);
      expect(result.caption).toContain("Billie in vintage distressed leather jacket and sunglasses");
      expect(result.analysis).toBeDefined();
      expect(result.analysis?.wardrobe?.era_style).toBe("90s grunge");
      expect(result.analysis?.lighting?.quality).toBe("dramatic");
      expect(result.analysis?.cinematography?.framing).toBe("Medium Shot");
    });

    it("falls back gracefully when model outputs plain text instead of JSON", async () => {
      const { callLocalLLM } = await import("../../server/services/llm_service");
      (callLocalLLM as any).mockResolvedValue({
        content: "<think>Describing wardrobe</think>Billie wearing dark tactical jacket and silver chain",
        model: "local-vision-model"
      });

      const result = await generateVisionCaption({
        imageBase64: "data:image/jpeg;base64,testdata",
        filename: "billie_ref_02.jpg",
        subjectName: "Billie"
      });

      expect(result.success).toBe(true);
      expect(result.caption).toBe("Billie wearing dark tactical jacket and silver chain");
      expect(result.analysis).toBeDefined();
      expect(result.analysis?.summary).toBe("Billie wearing dark tactical jacket and silver chain");
      expect(result.analysis?.filename).toBe("billie_ref_02.jpg");
    });

    it("parses JSON in markdown code fences with trailing commas", async () => {
      const { callLocalLLM } = await import("../../server/services/llm_service");
      const dirtyJsonFence = `\`\`\`json
{
  "caption": "Billie in oversized trench coat and dark boots",
  "analysis": {
    "summary": "Billie in oversized trench coat.",
    "wardrobe": {
      "garments": "Oversized trench coat",
    },
    "lighting": {
      "quality": "diffused",
    },
  },
}
\`\`\``;
      (callLocalLLM as any).mockResolvedValue({
        content: `<think>Formatting JSON</think>${dirtyJsonFence}`,
        model: "local-vision-model"
      });

      const result = await generateVisionCaption({
        imageBase64: "data:image/jpeg;base64,testdata",
        filename: "billie_ref_03.jpg",
        subjectName: "Billie"
      });

      expect(result.success).toBe(true);
      expect(result.caption).toBe("Billie in oversized trench coat and dark boots");
      expect(result.analysis?.wardrobe?.garments).toBe("Oversized trench coat");
      expect(result.analysis?.lighting?.quality).toBe("diffused");
    });

    it("parses structured markdown key-value text if model omits JSON", async () => {
      const { callLocalLLM } = await import("../../server/services/llm_service");
      const markdownKv = `
Caption: Billie wearing velvet burgundy jacket and glasses
Wardrobe: Burgundy velvet jacket, white collared shirt
Lighting: Soft ambient tungsten
Framing: Close-up portrait
Setting: Vintage cocktail lounge
`;
      (callLocalLLM as any).mockResolvedValue({
        content: markdownKv,
        model: "local-vision-model"
      });

      const result = await generateVisionCaption({
        imageBase64: "data:image/jpeg;base64,testdata",
        filename: "billie_ref_04.jpg",
        subjectName: "Billie"
      });

      expect(result.success).toBe(true);
      expect(result.caption).toBe("Billie wearing velvet burgundy jacket and glasses");
      expect(result.analysis?.wardrobe?.garments).toBe("Burgundy velvet jacket, white collared shirt");
      expect(result.analysis?.lighting?.quality).toBe("Soft ambient tungsten");
      expect(result.analysis?.cinematography?.framing).toBe("Close-up portrait");
      expect(result.analysis?.environment_palette?.setting).toBe("Vintage cocktail lounge");
    });

    it("handles string representations of subfields gracefully", async () => {
      const { callLocalLLM } = await import("../../server/services/llm_service");
      const stringSubfields = JSON.stringify({
        caption: "Billie in leather biker jacket",
        analysis: {
          summary: "Billie in biker jacket",
          wardrobe: "Black leather biker jacket",
          lighting: "Hard side key light",
          cinematography: "Dutch angle medium shot",
          environment_palette: "Dark alleyway at night"
        }
      });

      (callLocalLLM as any).mockResolvedValue({
        content: stringSubfields,
        model: "local-vision-model"
      });

      const result = await generateVisionCaption({
        imageBase64: "data:image/jpeg;base64,testdata",
        filename: "billie_ref_05.jpg",
        subjectName: "Billie"
      });

      expect(result.success).toBe(true);
      expect(result.analysis?.wardrobe?.garments).toBe("Black leather biker jacket");
      expect(result.analysis?.lighting?.quality).toBe("Hard side key light");
      expect(result.analysis?.cinematography?.framing).toBe("Dutch angle medium shot");
      expect(result.analysis?.environment_palette?.setting).toBe("Dark alleyway at night");
    });
  });

  describe("detectVisionCapability", () => {
    it("detects vision-capable models from string arrays", () => {
      const models = ["mistral-7b-instruct", "qwen2.5-vl-7b-instruct", "llama-3-8b"];
      const result = detectVisionCapability(models);
      expect(result.hasVision).toBe(true);
      expect(result.visionModel).toBe("qwen2.5-vl-7b-instruct");
      expect(result.detectedCount).toBe(1);
    });

    it("detects vision models across common naming patterns (llava, pixtral, llama-vision)", () => {
      expect(detectVisionCapability(["llama-3.2-11b-vision-instruct"]).hasVision).toBe(true);
      expect(detectVisionCapability(["llava-v1.6-mistral-7b"]).hasVision).toBe(true);
      expect(detectVisionCapability(["pixtral-12b"]).hasVision).toBe(true);
      expect(detectVisionCapability(["minicpm-v-2_6"]).hasVision).toBe(true);
      expect(detectVisionCapability(["moondream2"]).hasVision).toBe(true);
    });

    it("returns false when only text models are present", () => {
      const models = ["mistral-7b-instruct", "llama-3.1-8b-instruct", "qwen2.5-7b-instruct", "gemma-2-9b"];
      const result = detectVisionCapability(models);
      expect(result.hasVision).toBe(false);
      expect(result.visionModel).toBeUndefined();
      expect(result.detectedCount).toBe(0);
    });

    it("detects vision capability from model objects with architecture/modalities metadata", () => {
      const models = [
        { id: "custom-model", modalities: ["text", "image"] },
        { id: "text-only", modalities: ["text"] }
      ];
      const result = detectVisionCapability(models);
      expect(result.hasVision).toBe(true);
      expect(result.visionModel).toBe("custom-model");
    });

    it("detects vision capability from Ollama model objects with clip/mllama family", () => {
      const models = [
        { name: "custom-ollama:latest", details: { families: ["llama", "mllama"] } }
      ];
      const result = detectVisionCapability(models);
      expect(result.hasVision).toBe(true);
      expect(result.visionModel).toBe("custom-ollama:latest");
    });
  });

  describe("isVisionModel", () => {
    it("correctly identifies vision models client-side", () => {
      expect(isVisionModel("qwen2.5-vl-7b-instruct")).toBe(true);
      expect(isVisionModel("llama-3.2-11b-vision-instruct")).toBe(true);
      expect(isVisionModel("llava:latest")).toBe(true);
      expect(isVisionModel("mistral:7b")).toBe(false);
      expect(isVisionModel("qwen2.5:7b")).toBe(false);
      expect(isVisionModel(undefined)).toBe(false);
    });
  });
});

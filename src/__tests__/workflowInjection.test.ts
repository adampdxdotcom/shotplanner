import { describe, it, expect } from "vitest";
import {
  isExactImageLoader,
  isExactVideoLoader,
  isExactAudioLoader,
  isExactPromptNode,
  isExactNegativePromptNode,
  isSaveVideoNode,
  formatAspectRatioForComfyUI,
  getDimensionsFromAspectRatio,
  generateLiveInjectedWorkflow
} from "../utils/workflowInjection";
import { ShotItem, GenerationParameters, ParameterNodeMappings } from "../types";

describe("workflowInjection", () => {
  describe("Node classification helpers", () => {
    it("correctly identifies image loaders and excludes preview or processing nodes", () => {
      expect(isExactImageLoader("LoadImage")).toBe(true);
      expect(isExactImageLoader("CR Load Image")).toBe(true);
      expect(isExactImageLoader("LoadImageMask")).toBe(true);
      expect(isExactImageLoader("CustomNode", "Load Image from Disk")).toBe(true);

      expect(isExactImageLoader("SaveImage")).toBe(false);
      expect(isExactImageLoader("PreviewImage")).toBe(false);
      expect(isExactImageLoader("ImageScale")).toBe(false);
      expect(isExactImageLoader("ImageCrop")).toBe(false);
    });

    it("correctly identifies video loaders and excludes combiners or video savers", () => {
      expect(isExactVideoLoader("VHS_LoadVideo")).toBe(true);
      expect(isExactVideoLoader("LoadVideoPath")).toBe(true);
      expect(isExactVideoLoader("VHS_LoadVideoFFmpeg")).toBe(true);

      expect(isExactVideoLoader("VHS_VideoCombine")).toBe(false);
      expect(isExactVideoLoader("SaveVideo")).toBe(false);
    });

    it("correctly identifies audio loaders", () => {
      expect(isExactAudioLoader("LoadAudio")).toBe(true);
      expect(isExactAudioLoader("VHS_LoadAudio")).toBe(true);

      expect(isExactAudioLoader("SaveAudio")).toBe(false);
      expect(isExactAudioLoader("VAEDecode")).toBe(false);
    });

    it("correctly identifies prompt conditioning nodes", () => {
      expect(isExactPromptNode("CLIPTextEncode")).toBe(true);
      expect(isExactPromptNode("PrimitiveStringMultiline")).toBe(true);
      expect(isExactPromptNode("CustomText", "Positive Prompt")).toBe(true);
      expect(isExactPromptNode("CustomText", "Negative Prompt")).toBe(false);
    });

    it("correctly identifies negative prompt conditioning nodes", () => {
      expect(isExactNegativePromptNode("CLIPTextEncode", "Negative Prompt")).toBe(true);
      expect(isExactNegativePromptNode("CLIPTextEncode", "neg_prompt")).toBe(true);
      expect(isExactNegativePromptNode("CustomNode", "Negative Prompt")).toBe(true);
      expect(isExactNegativePromptNode("CLIPTextEncode", "Positive Prompt")).toBe(false);
    });

    it("correctly identifies save video nodes", () => {
      expect(isSaveVideoNode("SaveVideo")).toBe(true);
      expect(isSaveVideoNode("VHS_VideoCombine")).toBe(true);
      expect(isSaveVideoNode("CustomNode", "Save Video")).toBe(true);
      expect(isSaveVideoNode("LoadVideo")).toBe(false);
    });

    it("correctly formats aspect ratios and calculates pixel dimensions", () => {
      expect(formatAspectRatioForComfyUI("16:9")).toBe("16:9 (Widescreen)");
      expect(formatAspectRatioForComfyUI("9:16")).toBe("9:16 (Vertical)");
      expect(formatAspectRatioForComfyUI("1:1")).toBe("1:1 (Square)");

      const dims = getDimensionsFromAspectRatio("16:9", 1.0);
      expect(dims.width).toBeGreaterThan(0);
      expect(dims.height).toBeGreaterThan(0);
      expect(dims.width % 64).toBe(0);
      expect(dims.height % 64).toBe(0);
    });
  });

  describe("generateLiveInjectedWorkflow - API Dictionary format", () => {
    it("injects prompt text and asset filenames into target nodes", () => {
      const mockApiWorkflow = {
        "1": {
          class_type: "LoadImage",
          inputs: { image: "placeholder.png" }
        },
        "2": {
          class_type: "CLIPTextEncode",
          inputs: { text: "original prompt" }
        },
        "3": {
          class_type: "KSampler",
          inputs: { steps: 20, seed: 12345 }
        }
      };

      const mockShot: ShotItem = {
        id: "shot_1",
        shot_number: 1,
        shot_type: "Close Up",
        camera_movement: "Static",
        basic_stub: "Stub",
        expanded_prompt: "Cinematic close up of agent in rain",
        assigned_slots: {},
        updated_at: new Date().toISOString(),
        status: "unstaged"
      };

      const genParams: GenerationParameters = {
        steps: 35,
        megapixels: 1.0,
        frames: 81
      };

      const paramNodes: ParameterNodeMappings = {
        steps: "3",
        megapixels: "",
        frames: ""
      };

      const result = generateLiveInjectedWorkflow(
        mockApiWorkflow,
        mockShot,
        "2",
        { "1": "hero_character.png" },
        false,
        genParams,
        paramNodes,
        "Scene_01",
        [{ id: "1" }]
      );

      // Prompt injection
      expect(result["2"].inputs.text).toBe("Cinematic close up of agent in rain");
      // Image slot injection
      expect(result["1"].inputs.image).toBe("hero_character.png");
      // Parameter override injection
      expect(result["3"].inputs.steps).toBe(35);
    });
  });

  describe("generateLiveInjectedWorkflow - UI Graph format ({ nodes: [...] })", () => {
    it("injects prompt and slot mappings into node graph format", () => {
      const mockUiGraph = {
        nodes: [
          {
            id: 10,
            type: "LoadImage",
            title: "Load Image",
            widgets_values: ["old_image.png"],
            mode: 4
          },
          {
            id: 11,
            type: "LoadImage",
            title: "Unassigned Ref Image",
            widgets_values: ["empty.png"],
            mode: 0
          },
          {
            id: 20,
            type: "CLIPTextEncode",
            title: "CLIP Text Encode (Prompt)",
            widgets_values: ["old prompt"]
          }
        ]
      };

      const mockShot: ShotItem = {
        id: "shot_2",
        shot_number: 2,
        shot_type: "Wide Shot",
        camera_movement: "Static",
        basic_stub: "Stub",
        expanded_prompt: "Wide sunset horizon over neon city",
        assigned_slots: {},
        updated_at: new Date().toISOString(),
        status: "unstaged"
      };

      const defaultParams: GenerationParameters = {
        steps: 20,
        megapixels: 1.0,
        frames: 81
      };

      const emptyParamNodes: ParameterNodeMappings = {
        steps: "",
        megapixels: "",
        frames: ""
      };

      const result = generateLiveInjectedWorkflow(
        mockUiGraph,
        mockShot,
        "20",
        { "10": "city_background.png" },
        false,
        defaultParams,
        emptyParamNodes,
        "Scene_01",
        [{ id: "10" }, { id: "11" }]
      );

      const assignedImgNode = result.nodes.find((n: any) => n.id === 10);
      const unassignedImgNode = result.nodes.find((n: any) => n.id === 11);
      const promptNode = result.nodes.find((n: any) => n.id === 20);

      expect(assignedImgNode.widgets_values[0]).toBe("city_background.png");
      expect(assignedImgNode.mode).toBe(0); // Active
      expect(unassignedImgNode.mode).toBe(4); // Bypassed
      expect(promptNode.widgets_values[0]).toBe("Wide sunset horizon over neon city");
    });
  });
});

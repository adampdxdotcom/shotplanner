import { describe, it, expect } from "vitest";
import { injectWorkflowGraph } from "../shared/workflowInjectionEngine";

describe("workflowInjectionEngine (Shared pure AST engine)", () => {
  it("injects prompt, asset filenames, parameter overrides, and save video prefix into flat API dictionary", () => {
    const rawApi = {
      "10": {
        class_type: "LoadImage",
        inputs: { image: "old.png" }
      },
      "11": {
        class_type: "LoadImage",
        inputs: { image: "placeholder.png" }
      },
      "20": {
        class_type: "CLIPTextEncode",
        inputs: { text: "original prompt" }
      },
      "30": {
        class_type: "KSampler",
        inputs: { steps: 20, cfg: 7.0 }
      },
      "40": {
        class_type: "ResolutionSelector",
        inputs: { aspect_ratio: "1:1", megapixels: 0.5 }
      },
      "50": {
        class_type: "VHS_VideoCombine",
        inputs: { filename_prefix: "default_out" }
      }
    };

    const injected = injectWorkflowGraph({
      workflowData: rawApi,
      promptNodeId: "20",
      finalPrompt: "Cyberpunk street in rain, neon reflections",
      nodeMappings: { "10": "character_hero.png" },
      bypassMissing: true,
      safePlaceholder: "empty.png",
      parameterOverrides: {
        steps: 40,
        megapixels: 1.5,
        frames: 90
      },
      parameterNodeMappings: {
        steps: "30",
        megapixels: "40",
        frames: null
      },
      saveVideoPrefix: "Scene01_Shot03",
      aspectRatio: "16:9"
    });

    expect(injected["20"].inputs.text).toBe("Cyberpunk street in rain, neon reflections");
    expect(injected["10"].inputs.image).toBe("character_hero.png");
    expect(injected["11"].inputs.image).toBe("empty.png");
    expect(injected["30"].inputs.steps).toBe(40);
    expect(injected["40"].inputs.megapixels).toBe(1.5);
    expect(injected["40"].inputs.aspect_ratio).toBe("16:9 (Widescreen)");
    expect(injected["50"].inputs.filename_prefix).toBe("Scene01_Shot03");
  });

  it("injects visual canvas graph ({ nodes: [...] }) with mode switching (0 for active, 4 for bypassed)", () => {
    const rawVisual = {
      nodes: [
        {
          id: 1,
          type: "LoadImage",
          title: "Character Slot",
          widgets_values: ["old.png"],
          mode: 4
        },
        {
          id: 2,
          type: "LoadImage",
          title: "Environment Slot",
          widgets_values: ["example.png"],
          mode: 0
        },
        {
          id: 3,
          type: "CLIPTextEncode",
          title: "Positive Prompt",
          widgets_values: ["old text"]
        },
        {
          id: 4,
          type: "SaveVideo",
          title: "Save Video",
          widgets_values: ["old_prefix"]
        }
      ]
    };

    const injected = injectWorkflowGraph({
      workflowData: rawVisual,
      promptNodeId: "3",
      finalPrompt: "Close-up portrait of pilot",
      nodeMappings: { "1": "pilot_face.png" },
      bypassMissing: true,
      safePlaceholder: "empty.png",
      saveVideoPrefix: "Scene02_Shot01"
    });

    const node1 = injected.nodes.find((n: any) => n.id === 1);
    const node2 = injected.nodes.find((n: any) => n.id === 2);
    const node3 = injected.nodes.find((n: any) => n.id === 3);
    const node4 = injected.nodes.find((n: any) => n.id === 4);

    // Mapped node becomes active mode 0
    expect(node1.widgets_values[0]).toBe("pilot_face.png");
    expect(node1.mode).toBe(0);

    // Unmapped node becomes bypassed mode 4 and receives empty.png
    expect(node2.widgets_values[0]).toBe("empty.png");
    expect(node2.mode).toBe(4);

    // Prompt injected
    expect(node3.widgets_values[0]).toBe("Close-up portrait of pilot");

    // Video save prefix injected
    expect(node4.widgets_values[0]).toBe("Scene02_Shot01");
  });
});

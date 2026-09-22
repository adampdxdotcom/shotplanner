import { ParseSceneSketchResult } from "../types";
import { llmApi } from "../api";

export interface ParseSceneSketchRequestOptions {
  sketch_text: string;
  lm_studio_url?: string;
  model?: string;
  provider?: string;
  temperature?: number;
  max_tokens?: number;
  clean_import?: boolean;
}

export async function requestSceneSketchParse(options: ParseSceneSketchRequestOptions): Promise<ParseSceneSketchResult> {
  const data = await llmApi.parseSceneSketch(options);
  return data as ParseSceneSketchResult;
}

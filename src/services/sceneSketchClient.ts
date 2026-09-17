import { ParseSceneSketchResult } from "../types";

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
  const res = await fetch("/api/llm/parse-scene-sketch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(options)
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP error ${res.status}: Failed to parse scene sketch`);
  }

  return await res.json();
}

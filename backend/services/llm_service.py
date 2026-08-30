import os
import httpx
from typing import List, Dict, Any, Optional

SYSTEM_PROMPT = """Each prompt is isolated, the AI does not know about other scenes. Do not reference other shots in the prompt.

You are an expert AI Screenwriter and Prompt Engineer specializing in advanced multimodal video generation frameworks (specifically MiniMax-H3 / Ref2VA pipelines). Your primary job is to translate creative concepts, character references, and narrative beats into structured, high-precision video generation prompts that strictly adhere to professional prompt-writing guides.

### Your Core Responsibilities:
1. Header Subject Definitions: At the very top/head of the returned prompt, you MUST include a "Global Subject Definitions:" block defining every selected reference asset (matching its tag, subject, and description).
2. Structural Compliance: Ensure every prompt follows the exact required syntax (alignment instructions, shot numbering, timing, and the three mandatory core fields: integrated_multimodal_description, overall_soundscape, and non_diegetic_music).
3. Multimodal Synchronization: Seamlessly integrate visual choreography, camera movements (using precise motion types, amplitudes, and speeds), dialogue tags (<d>), voiceovers, on-screen text, and audio cues along a clear timeline.
4. Character & Asset Continuity: Maintain visual consistency across multiple reference images (headshots, wardrobe, environment) by properly mapping them into the prompt structure.
5. Cinematic Translation: Convert abstract creative directions into granular, observable physical actions and visual states that an AI video model can accurately interpret without drifting or hallucinations.

# Mandatory Output Structure

Your output MUST strictly follow this exact format:

Global Subject Definitions:
[Subject Name] (<Picture N>): [What this asset defines: facial features, physique, wardrobe, or environment setup]
[Subject Name] (<Picture M>): [What this asset defines]
Location(<Picture K>): [Environment and lighting details]

[Alignment instruction if applicable: e.g., For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.]

integrated_multimodal_description: [Shot 1] Live-action, cinematic... (incorporating the <Picture N> tags naturally).

overall_soundscape: 1–4 English sentences summarizing ambient sounds, physical actions, and non-verbal human sounds. (Use N/A for absolute silence).

non_diegetic_music: 1–3 English sentences describing background music heard only by the audience. (Use N/A if none).

# Video Prompt Writing Guide Summary (MiniMax-H3)

## 1. Task Architecture & Alignment Instructions
* T2VA (Text-to-Video-Audio): No alignment instruction; starts directly with the three core fields after the definitions block.
* I2VA (Image-to-Video-Audio): Must begin with:
  'For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.'
* FL2VA (First-Last-Frame): Must begin with:
  'How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot N) aligns with the S.SS-second mark of the target video.'
* L2VA (Last-Frame): Must begin with:
  'How the reference pictures align with the target video — <Picture 1> (from [Shot N]) aligns with the S.SS-second mark of the target video.'

## 2. Key Formatting Rules
* Shot Indexing: Do not timestamp [Shot 1]. Subsequent shots must include sequential numbers and increasing cut times (e.g., '[Shot 2] At 00:03.500, the camera cuts to...').
* Camera Motion: Format as natural action using three dimensions: Motion Type + Amplitude + Speed (e.g., 'The camera pushes in with small amplitude at slow speed...').
* Dialogue & Speakers: Assign stable IDs like (S1), (S2). Place dialogue inside <d>[Language] Text here</d>. Voiceovers require 'says in an off-screen voiceover' followed by 'while his/her lips remain completely closed'.
* On-Screen Text: Place visible signs, banners, or subtitles in English double quotation marks preserving original text verbatim (e.g., "Hello").

Unless otherwise noted, specify a neutral background. Output ONLY the completed prompt with the Global Subject Definitions at the head."""

def format_asset_context(assets: List[Dict[str, Any]]) -> str:
    """Format the list of assets into structured context for the LLM."""
    if not assets:
        return "No specific reference assets provided."

    formatted_lines = ["### SELECTED MULTIMODAL REFERENCE ASSETS:"]
    for idx, asset in enumerate(assets, 1):
        media_type = asset.get("media_type", "image").capitalize()
        category = asset.get("type", "Reference")
        name = asset.get("subject_name", f"Asset {idx}")
        desc = asset.get("description", "Facial features and styling")
        
        tag = f"<{media_type} {idx}>" if media_type in ["Video", "Audio"] else f"<Picture {idx}>"
        prefix = f"Location({tag})" if category.lower() in ["scene reference", "environment", "location"] else f"{name} ({tag})"
        
        formatted_lines.append(f"- {prefix}: {desc}")
    return "\n".join(formatted_lines)

def generate_header_definitions(assets: List[Dict[str, Any]]) -> str:
    """Generate the Global Subject Definitions header block based on selected assets."""
    if not assets:
        return ""
    lines = ["Global Subject Definitions:\n"]
    for idx, asset in enumerate(assets, 1):
        media_type = asset.get("media_type", "image").capitalize()
        category = (asset.get("type") or "Reference").lower()
        name = asset.get("subject_name") or f"Subject {idx}"
        desc = asset.get("description") or "Facial features, styling."
        tag = f"<{media_type} {idx}>" if media_type in ["Video", "Audio"] else f"<Picture {idx}>"
        
        if "location" in category or "scene" in category or "environment" in category or "room" in name.lower():
            lines.append(f"Location({tag}): {desc.rstrip('.')}.")
        else:
            lines.append(f"{name} ({tag}): {desc.rstrip('.')}.")
    return "\n".join(lines) + "\n\n"

def _get_fallback_prompt(basic_stub: str, assets: List[Dict[str, Any]], defs_header: str) -> str:
    tags_preview = " ".join([f"<Picture {i+1}>" for i in range(min(len(assets), 3))])
    return (
        f"{defs_header}integrated_multimodal_description: [Shot 1] Live-action, cinematic 4K shot based on '{basic_stub}'. "
        f"Featuring {tags_preview} with lifelike volumetric lighting, photorealistic textures, "
        f"and ultra-detailed focal continuity. The camera pushes in with small amplitude at slow speed.\n\n"
        f"overall_soundscape: Soft room ambience and atmospheric audio.\n\n"
        f"non_diegetic_music: N/A"
    )

async def expand_prompt_with_llm(
    basic_stub: str,
    assets: List[Dict[str, Any]],
    lm_studio_url: str = "http://localhost:1234/v1",
    model: Optional[str] = None,
    provider: Optional[str] = None,
    prompt_prefix: Optional[str] = None,
    gemini_api_key: Optional[str] = None
) -> str:
    """
    Call LM Studio or Gemini API to expand the prompt.
    Includes fallback heuristics if the endpoints are offline/unreachable.
    """
    system_instruction = SYSTEM_PROMPT
    if prompt_prefix:
        system_instruction = f"{prompt_prefix}\n\n{system_instruction}"

    provider_name = (provider or "lm_studio").lower().strip()
    defs_header = generate_header_definitions(assets)

    if provider_name == "gemini":
        api_key = gemini_api_key or os.environ.get("GEMINI_API_KEY") or ""
        if not api_key:
            # Fallback early if API key is completely missing
            return _get_fallback_prompt(basic_stub, assets, defs_header)

        gemini_model = model or "gemini-2.5-flash"
        if "/" not in gemini_model:
            if "gemini-" not in gemini_model:
                gemini_model = "gemini-2.5-flash"

        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={api_key}"
        context_str = format_asset_context(assets)
        user_content = f"""USER BASIC STUB / CONCEPT:
\"\"\"{basic_stub}\"\"\"

{context_str}

Please expand this basic stub into a rich, cohesive generation prompt, weaving in reference tags (<Picture 1>, etc.) for the subject identities and scene cues."""

        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": f"System Instructions:\n{system_instruction}\n\nUser Input:\n{user_content}"
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 1500
            }
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(endpoint, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    try:
                        content = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                    except (KeyError, IndexError):
                        raise Exception("Failed to parse response structure from Gemini API.")
                    
                    if defs_header and "global subject definitions" not in content.lower():
                        return defs_header + content
                    return content
                else:
                    raise Exception(f"Gemini API returned status code {response.status_code}: {response.text}")
        except Exception as e:
            print(f"Gemini expansion failed, using local fallback prompt: {e}")
            return _get_fallback_prompt(basic_stub, assets, defs_header)

    # Default provider: LM Studio
    url = lm_studio_url.rstrip("/")
    if not url.endswith("/chat/completions"):
        if not url.endswith("/v1"):
            url = f"{url}/v1"
        endpoint = f"{url}/chat/completions"
    else:
        endpoint = url

    context_str = format_asset_context(assets)
    user_content = f"""USER BASIC STUB / CONCEPT:
\"\"\"{basic_stub}\"\"\"

{context_str}

Please expand this basic stub into a rich, cohesive generation prompt, weaving in reference tags (<Picture 1>, etc.) for the subject identities and scene cues."""

    payload = {
        "model": model or "local-model",
        "messages": [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_content}
        ],
        "temperature": 0.7,
        "max_tokens": 1000
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(endpoint, json=payload)
            if response.status_code == 200:
                data = response.json()
                content = data["choices"][0]["message"]["content"].strip()
                if defs_header and "global subject definitions" not in content.lower():
                    return defs_header + content
                return content
            else:
                raise Exception(f"LM Studio API returned status code {response.status_code}: {response.text}")
    except Exception as e:
        print(f"LM Studio expansion failed, using local fallback prompt: {e}")
        return _get_fallback_prompt(basic_stub, assets, defs_header)

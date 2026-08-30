import os
import httpx
from typing import List, Dict, Any, Optional

SCENE_REFERENCE_DIRECTIVE = "Do not embellish the setting. Use the exact likeness of location."

SYSTEM_PROMPT = """You are an expert AI Screenwriter and Prompt Engineer specializing in advanced multimodal video generation frameworks (MiniMax-H3 / Ref2VA pipelines).

Your task is to generate ONLY the integrated_multimodal_description content. Do not generate headers, footers, or subject definitions. Use exact asset tags (<Picture N>, <Video N>) provided in the context.

### Strict Output Constraints:
- Spatial Initialization: Always define the subject's exact spatial position and initial posture at the very beginning (e.g., "[Shot 1] Live-action, cinematic... At the start of the shot, [Subject] is positioned at...").
- Exact Tags: Differentiate between facial likeness and styling using the exact tags provided (e.g., "<Picture 1>"). Do NOT invent new tags or reference off-screen characters.
- Camera Motion: Describe camera motion naturally (Motion Type + Amplitude + Speed, e.g., "The camera pushes in with small amplitude at slow speed...").
- Dialogue: If dialogue is present, format as <d>[Language] Dialogue text</d> with speaker tags like (S1).
- No Boilerplate: Output ONLY the narrative visual description. Do NOT output "Global Subject Definitions:", "overall_soundscape:", or "non_diegetic_music:"."""

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
    lines = ["Global Subject Definitions:"]
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
    return "\n".join(lines)

def build_mandatory_header(
    prompt_prefix: Optional[str],
    defs_header: str,
    is_scene_ref: bool = False,
    is_single_subject: bool = False
) -> str:
    parts = []
    if prompt_prefix and prompt_prefix.strip():
        parts.append(prompt_prefix.strip())
    if defs_header and defs_header.strip():
        parts.append(defs_header.strip())
    directives = []
    if is_scene_ref:
        directives.append(SCENE_REFERENCE_DIRECTIVE)
    if is_single_subject:
        directives.append("There is only one person visible on screen in this shot. All other characters remain strictly off-screen.")
    if directives:
        parts.append("\n".join(directives))
    return "\n\n".join(parts)

def build_mandatory_footer() -> str:
    return "overall_soundscape: Soft room ambience, environmental acoustics, and natural Foley effects matching on-screen physical actions.\n\nnon_diegetic_music: N/A"

def assemble_final_prompt(header: str, description: str, footer: str) -> str:
    desc = description.strip()
    if desc and not desc.lower().startswith("integrated_multimodal_description:"):
        desc = f"integrated_multimodal_description: {desc}"
    parts = [p for p in [header, desc, footer] if p]
    return "\n\n".join(parts)

def _get_fallback_description(basic_stub: str, assets: List[Dict[str, Any]]) -> str:
    tags_preview = " ".join([f"<Picture {i+1}>" for i in range(min(len(assets), 3))])
    return (
        f"[Shot 1] Live-action, cinematic 4K shot based on '{basic_stub}'. "
        f"Featuring {tags_preview or '<Picture 1>'} with lifelike volumetric lighting, photorealistic textures, "
        f"and ultra-detailed focal continuity. The camera pushes in with small amplitude at slow speed."
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
    Assembly Line prompt expansion:
    1. Mandatory Header (programmatic)
    2. Integrated Multimodal Description (LLM only)
    3. Mandatory Footer (programmatic)
    """
    provider_name = (provider or "lm_studio").lower().strip()
    defs_header = generate_header_definitions(assets)
    
    is_scene_ref = any(
        (a.get("type") or "").lower() in ["scene reference", "location", "environment"]
        for a in assets
    )
    is_single_subject = len([a for a in assets if "location" not in (a.get("type") or "").lower()]) == 1

    header = build_mandatory_header(prompt_prefix, defs_header, is_scene_ref, is_single_subject)
    footer = build_mandatory_footer()

    context_str = format_asset_context(assets)
    user_content = f"""CREATIVE CONCEPT / STUB:
\"\"\"{basic_stub}\"\"\"

{context_str}

Generate ONLY the integrated_multimodal_description paragraph incorporating the reference tags naturally."""

    raw_description = ""

    if provider_name == "gemini":
        api_key = gemini_api_key or os.environ.get("GEMINI_API_KEY") or ""
        if not api_key:
            desc = _get_fallback_description(basic_stub, assets)
            return assemble_final_prompt(header, desc, footer)

        gemini_model = model or "gemini-2.5-flash"
        if "/" not in gemini_model and "gemini-" not in gemini_model:
            gemini_model = "gemini-2.5-flash"

        endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={api_key}"
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": f"System Instructions:\n{SYSTEM_PROMPT}\n\nUser Input:\n{user_content}"
                        }
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 800
            }
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(endpoint, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    raw_description = data["candidates"][0]["content"]["parts"][0]["text"].strip()
                else:
                    raise Exception(f"Gemini error {response.status_code}")
        except Exception as e:
            print(f"Gemini expansion failed, using fallback: {e}")
            raw_description = _get_fallback_description(basic_stub, assets)

    else:
        # Default: LM Studio
        url = lm_studio_url.rstrip("/")
        if not url.endswith("/chat/completions"):
            if not url.endswith("/v1"):
                url = f"{url}/v1"
            endpoint = f"{url}/chat/completions"
        else:
            endpoint = url

        payload = {
            "model": model or "local-model",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content}
            ],
            "temperature": 0.7,
            "max_tokens": 800
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(endpoint, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    raw_description = data["choices"][0]["message"]["content"].strip()
                else:
                    raise Exception(f"LM Studio status {response.status_code}")
        except Exception as e:
            print(f"LM Studio failed, using fallback: {e}")
            raw_description = _get_fallback_description(basic_stub, assets)

    if not raw_description:
        raw_description = _get_fallback_description(basic_stub, assets)

    return assemble_final_prompt(header, raw_description, footer)

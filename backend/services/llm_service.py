import os
import httpx
from typing import List, Dict, Any, Optional

SCENE_REFERENCE_DIRECTIVE = "Do not embellish the setting. Use the exact likeness of location."

SYSTEM_PROMPT = """You are an expert AI Screenwriter and Prompt Engineer specializing in advanced multimodal video generation frameworks (MiniMax-H3 / Ref2VA pipelines).

Your task is to generate ONLY the integrated_multimodal_description content. Do not generate headers, footers, or subject definitions. Use exact asset tags (<Picture N>, <Video N>) provided in the context.

### Strict Output Constraints:
- Spatial Initialization: Always define the subject's exact spatial position and initial posture at the very beginning (e.g., "[Shot 1] Live-action, cinematic... At the start of the shot, [Subject] is positioned at...").
- Exact Tags: Differentiate between facial likeness and styling using the exact tags provided (e.g., "<Picture 1>"). Do NOT invent new tags or reference off-screen characters.
- Framing Directives: When a Framing Directive is provided in context, utilize the specific anchor and focus subject likenesses provided in the Global Subject Definitions to execute this framing.
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

def generate_prompt_prefix(
    scene_name: Optional[str] = None,
    shot_number: Optional[Any] = None,
    shot_type: Optional[str] = None,
    lens_focal_length: Optional[str] = None,
    camera_movement: Optional[str] = None,
    aspect_ratio: Optional[str] = None
) -> str:
    parts = []
    if scene_name and str(scene_name).strip():
        parts.append(str(scene_name).strip())
    
    raw_shot = str(shot_number).strip() if shot_number is not None else ""
    if raw_shot:
        s_num = raw_shot.zfill(2) if raw_shot.isdigit() else raw_shot
        parts.append(f"Shot {s_num}")
    else:
        parts.append("Shot 01")
        
    if shot_type and str(shot_type).strip() and str(shot_type).strip() != "None":
        parts.append(str(shot_type).strip())
    if lens_focal_length and str(lens_focal_length).strip() and str(lens_focal_length).strip() != "None":
        parts.append(str(lens_focal_length).strip())
    if camera_movement and str(camera_movement).strip() and str(camera_movement).strip() != "None":
        parts.append(str(camera_movement).strip())
    if aspect_ratio and str(aspect_ratio).strip() and str(aspect_ratio).strip() != "None":
        parts.append(str(aspect_ratio).strip())
        
    return " - ".join(parts)

def build_mandatory_header(
    prompt_prefix: Optional[str],
    defs_header: str,
    framing_directive: Optional[str] = None,
    is_scene_ref: bool = False,
    is_single_subject: bool = False
) -> str:
    parts = []
    if prompt_prefix and prompt_prefix.strip():
        parts.append(prompt_prefix.strip())
    if defs_header and defs_header.strip():
        parts.append(defs_header.strip())
    directives = []
    if framing_directive and framing_directive.strip():
        directives.append(framing_directive.strip())
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

def _get_fallback_description(
    basic_stub: str,
    assets: List[Dict[str, Any]],
    framing_directive: Optional[str] = None,
    camera_movement: Optional[str] = None
) -> str:
    tags_preview = " ".join([f"<Picture {i+1}>" for i in range(min(len(assets), 3))])
    framing_stub = f"Framed with {framing_directive.replace('Framing:', '').strip()} " if framing_directive else ""
    cam_str = (camera_movement or "").strip()
    if "locked" in cam_str.lower() or "static" in cam_str.lower():
        camera_stub = "The camera remains completely locked off and static on a tripod."
    elif cam_str:
        camera_stub = f"The camera executes a smooth {cam_str.lower()} with subtle amplitude at slow speed."
    else:
        camera_stub = "The camera pushes in with small amplitude at slow speed."

    return (
        f"[Shot 1] Live-action, cinematic 4K shot based on '{basic_stub}'. {framing_stub}"
        f"Featuring {tags_preview or '<Picture 1>'} with lifelike volumetric lighting, photorealistic textures, "
        f"and ultra-detailed focal continuity. {camera_stub}"
    )

async def expand_prompt_with_llm(
    basic_stub: str,
    assets: List[Dict[str, Any]],
    lm_studio_url: str = "http://localhost:1234/v1",
    model: Optional[str] = None,
    provider: Optional[str] = None,
    prompt_prefix: Optional[str] = None,
    gemini_api_key: Optional[str] = None,
    active_shot: Optional[Dict[str, Any]] = None,
    shot_type: Optional[str] = None,
    camera_movement: Optional[str] = None,
    lens_focal_length: Optional[str] = None,
    aspect_ratio: Optional[str] = None,
    ots_anchor_subject: Optional[str] = None,
    ots_focus_subject: Optional[str] = None,
    ots_side: Optional[str] = None,
    shot_number: Optional[Any] = None,
    scene_name: Optional[str] = None,
    framing_directive: Optional[str] = None,
    characters: Optional[Dict[str, Any]] = None
) -> str:
    """
    Assembly Line prompt expansion:
    1. Mandatory Header (programmatic)
    2. Integrated Multimodal Description (LLM only)
    3. Mandatory Footer (programmatic)
    """
    provider_name = (provider or "lm_studio").lower().strip()
    defs_header = generate_header_definitions(assets)

    effective_shot_type = (active_shot.get("shot_type") if active_shot else None) or shot_type or ""
    anchor = (active_shot.get("ots_anchor_subject") if active_shot else None) or ots_anchor_subject or ""
    focus = (active_shot.get("ots_focus_subject") if active_shot else None) or ots_focus_subject or ""
    side_choice = (active_shot.get("ots_side") if active_shot else None) or ots_side or ""
    is_ots = "over-the-shoulder" in effective_shot_type.lower() or "ots" in effective_shot_type.lower()

    effective_cam = ((active_shot.get("camera_movement") if active_shot else None) or camera_movement or "").strip()
    effective_lens = ((active_shot.get("lens_focal_length") if active_shot else None) or lens_focal_length or "").strip()
    effective_aspect = ((active_shot.get("aspect_ratio") if active_shot else None) or aspect_ratio or "").strip()
    is_static = "locked" in effective_cam.lower() or "static" in effective_cam.lower()

    resolved_framing = (framing_directive or "").strip()
    if not resolved_framing and is_ots and (anchor or focus):
        pos_suffix = f" (positioned on {side_choice})" if side_choice in ["Left", "Right"] else ""
        if anchor and focus:
            resolved_framing = f"Framing: Over-the-shoulder (OTS) angle looking past the shoulder of {anchor} toward {focus}{pos_suffix}."
        elif anchor:
            resolved_framing = f"Framing: Over-the-shoulder (OTS) angle looking past the shoulder of {anchor}{pos_suffix}."
        elif focus:
            resolved_framing = f"Framing: Over-the-shoulder (OTS) angle looking toward {focus}{pos_suffix}."
    
    is_scene_ref = any(
        (a.get("type") or "").lower() in ["scene reference", "location", "environment"]
        for a in assets
    )
    is_single_subject = (not is_ots) and (len([a for a in assets if "location" not in (a.get("type") or "").lower()]) == 1)

    resolved_prefix = (prompt_prefix or "").strip()
    if not resolved_prefix and (scene_name or shot_number or effective_shot_type or effective_lens or effective_cam or effective_aspect):
        resolved_prefix = generate_prompt_prefix(
            scene_name=scene_name,
            shot_number=shot_number,
            shot_type=effective_shot_type,
            lens_focal_length=effective_lens,
            camera_movement=effective_cam,
            aspect_ratio=effective_aspect
        )

    header = build_mandatory_header(resolved_prefix, defs_header, resolved_framing, is_scene_ref, is_single_subject)
    footer = build_mandatory_footer()

    context_str = format_asset_context(assets)
    
    if effective_cam:
        if is_static:
            cam_dir_text = "LOCKED OFF (STATIC) - The camera must remain completely stationary. Strictly FORBID any camera push-in, zoom, pan, tilt, or tracking."
        else:
            cam_dir_text = f"The camera movement is '{effective_cam}'. Execute ONLY this movement without introducing conflicting motions."
        camera_context_block = f"\nCAMERA MOVEMENT DIRECTIVE:\n{cam_dir_text}\n"
    else:
        camera_context_block = ""

    # Optics / Lens & Framing Directives
    lens_instruction = ""
    if effective_lens and effective_lens != "None":
        l_low = effective_lens.lower()
        if "24mm" in l_low or "wide" in l_low:
            lens_instruction = f"Optics / Lens: {effective_lens}. Capture an expansive environmental field of view, deep focus, and sharp contextual background detail with subtle wide-angle perspective depth."
        elif "35mm" in l_low or "natural" in l_low:
            lens_instruction = f"Optics / Lens: {effective_lens}. Render natural human-eye perspective with balanced depth, grounded composition, and realistic environmental scale."
        elif "50mm" in l_low or "standard" in l_low:
            lens_instruction = f"Optics / Lens: {effective_lens}. Deliver classic standard prime optics with crisp subject sharpness and natural, smooth depth-of-field falloff."
        elif "85mm" in l_low or "portrait" in l_low:
            lens_instruction = f"Optics / Lens: {effective_lens}. Emphasize portrait telephoto compression with shallow depth-of-field, prominent subject isolation, and creamy background bokeh."
        elif "135mm" in l_low or "compression" in l_low:
            lens_instruction = f"Optics / Lens: {effective_lens}. Deliver dramatic telephoto perspective compression, pulling background geometry closer with cinematic optical softness behind the subject."
        elif "macro" in l_low or "close-up" in l_low:
            lens_instruction = f"Optics / Lens: {effective_lens}. Deliver ultra-shallow focus plane with magnified micro-textures, intricate surface details, and extreme background softness."
        else:
            lens_instruction = f"Optics / Lens: {effective_lens}. Render authentic depth-of-field and optical perspective consistent with this lens choice."

    aspect_instruction = ""
    if effective_aspect and effective_aspect != "None":
        ar_low = effective_aspect.lower()
        if "2.39:1" in ar_low or "anamorphic" in ar_low or "scope" in ar_low:
            aspect_instruction = f"Framing Canvas: {effective_aspect}. Compose for cinematic anamorphic ultra-widescreen scope with expansive horizontal blocking."
        elif "9:16" in ar_low or "vertical" in ar_low:
            aspect_instruction = f"Framing Canvas: {effective_aspect}. Compose for vertical mobile orientation, framing the subject with deliberate vertical balance and headroom."
        elif "1:1" in ar_low or "square" in ar_low:
            aspect_instruction = f"Framing Canvas: {effective_aspect}. Compose with centered geometric balance tailored to a 1:1 square canvas."
        elif "4:3" in ar_low:
            aspect_instruction = f"Framing Canvas: {effective_aspect}. Compose for classic 4:3 academy framing with tight, focused subject staging."
        else:
            aspect_instruction = f"Framing Canvas: {effective_aspect}. Maintain clean widescreen framing."

    optics_directives = [d for d in [lens_instruction, aspect_instruction] if d]
    optics_context_block = f"\nCINEMATOGRAPHY & OPTICS DIRECTIVE:\n{' '.join(optics_directives)}\n" if optics_directives else ""

    framing_context_block = f"\nFRAMING DIRECTIVE:\n{resolved_framing}\nA Framing Directive is provided; utilize the specific anchor and focus subject likenesses provided in the Global Subject Definitions to execute this framing.\n" if resolved_framing else ""

    camera_constraint_instruction = (
        "The camera is strictly LOCKED OFF / STATIC. The camera must remain completely fixed and motionless with ZERO camera motion. You are STRICTLY FORBIDDEN from describing any camera movement (NO push-ins, NO pull-backs, NO zooms, NO pans, NO tilts, and NO tracking)."
        if is_static
        else f"The camera movement is strictly '{effective_cam}'. Describe camera motion naturally matching ONLY this specified movement. Contradictory camera movements are STRICTLY FORBIDDEN."
        if effective_cam
        else "Describe camera motion naturally (Motion Type + Amplitude + Speed, e.g., 'The camera pushes in with small amplitude at slow speed...')."
    )

    character_context_block = ""
    if characters and isinstance(characters, dict):
        char_lines = []
        for char_name, profile in characters.items():
            is_featured = char_name.lower() in basic_stub.lower()
            for a in assets:
                if a.get("subject_name", "").lower() == char_name.lower():
                    is_featured = True
                    break
            
            if is_featured:
                notes = profile.get("notes", "").strip()
                outfit = profile.get("scene_outfit_ref", "").strip()
                if notes or outfit:
                    char_lines.append(f"- {char_name}:")
                    if notes:
                        char_lines.append(f"  Notes/Bio: {notes}")
                    if outfit:
                        char_lines.append(f"  Scene Wardrobe/Outfit: {outfit}")
        
        if char_lines:
            character_context_block = "\nCHARACTER BIBLE (FEATURED IN THIS SHOT):\n" + "\n".join(char_lines) + "\n"

    custom_system_prompt = f"""You are an expert AI Screenwriter and Prompt Engineer specializing in advanced multimodal video generation frameworks (MiniMax-H3 / Ref2VA pipelines).

Your task is to generate ONLY the integrated_multimodal_description content. Do not generate headers, footers, or subject definitions. Use exact asset tags (<Picture N>, <Video N>) provided in the context.

### Strict Output Constraints:
- Spatial Initialization: Always define the subject's exact spatial position and initial posture at the very beginning (e.g., "[Shot 1] Live-action, cinematic... At the start of the shot, [Subject] is positioned at...").
- Exact Tags: Differentiate between facial likeness and styling using the exact tags provided (e.g., "<Picture 1>"). Do NOT invent new tags or reference off-screen characters.
- Cinematography & Optical Rendering: Reflect the visual characteristics of the selected lens ({effective_lens or "standard"}) and framing ({effective_aspect or "16:9 widescreen"}) in depth-of-field, perspective compression, and environmental sharpness, while strictly adhering to camera motion constraints.
- Character Bible Adherence: Use the provided Character Bible context to ensure consistent physical likeness and wardrobe for featured characters, even if not explicitly described in the stub.
- Framing Directives: When a Framing Directive is provided in context, utilize the specific anchor and focus subject likenesses provided in the Global Subject Definitions to execute this framing.
- Camera Motion Hard Constraint: {camera_constraint_instruction}
- Dialogue: If dialogue is present, format as <d>[Language] Dialogue text</d> with speaker tags like (S1).
- No Boilerplate: Output ONLY the narrative visual description. Do NOT output "Global Subject Definitions:", "overall_soundscape:", or "non_diegetic_music:"."""

    user_content = f"""CREATIVE CONCEPT / STUB:
\"\"\"{basic_stub}\"\"\"

SHOT PLANNING CONTEXT:
{resolved_prefix or "Shot 01"}
{camera_context_block}{optics_context_block}{framing_context_block}{character_context_block}
{context_str}

Generate ONLY the integrated_multimodal_description paragraph incorporating the reference tags naturally while strictly adhering to all camera, optics, and framing constraints."""

    raw_description = ""

    if provider_name == "gemini":
        api_key = gemini_api_key or os.environ.get("GEMINI_API_KEY") or ""
        if not api_key:
            desc = _get_fallback_description(basic_stub, assets, resolved_framing, effective_cam)
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
                            "text": f"System Instructions:\n{custom_system_prompt}\n\nUser Input:\n{user_content}"
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
            raw_description = _get_fallback_description(basic_stub, assets, resolved_framing, effective_cam)

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
                {"role": "system", "content": custom_system_prompt},
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
            raw_description = _get_fallback_description(basic_stub, assets, resolved_framing, effective_cam)

    if not raw_description:
        raw_description = _get_fallback_description(basic_stub, assets, resolved_framing, effective_cam)

    return assemble_final_prompt(header, raw_description, footer)

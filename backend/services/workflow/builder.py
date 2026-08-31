from typing import Dict, Any, Optional
from backend.services.workflow.node_inspector import inspect_workflow_nodes
from backend.services.workflow.injector import inject_and_prepare_workflow

def build_shot_workflow(project_data: Dict[str, Any], shot: Dict[str, Any], scene_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Centralized workflow builder:
    1. Loads the shot's workflow template (or scene default template).
    2. Resolves media slot mappings (numeric and string keys for image slots 0-8, audio 9-10, video 11, and shared assets).
    3. Ingests shot expanded prompt, prompt node ID, sampling steps, megapixels, and frame duration.
    4. Calls inject_and_prepare_workflow to return the fully synthesized, ready-to-run ComfyUI workflow JSON.
    """
    from backend.utils.file_handlers import load_workflow_json, sanitize_project_name

    effective_scene = scene_name or project_data.get("scene_name") or (project_data.get("scene_planning", {}).get("scene_name") if isinstance(project_data.get("scene_planning"), dict) else None) or "scene01"
    clean_scene_name = sanitize_project_name(effective_scene)

    # 1. Determine and load workflow template
    target_wf_name = (
        shot.get("workflow_file")
        or shot.get("workflow_filename")
        or project_data.get("workflow_file")
        or project_data.get("selectedWorkflowFile")
        or "default.json"
    )

    try:
        template_json = load_workflow_json(target_wf_name, scene_name=effective_scene)
    except Exception:
        template_json = {"nodes": [], "links": []}

    # 2. Inspect workflow nodes
    inspected = inspect_workflow_nodes(template_json)
    img_loaders = inspected.get("image_loader_nodes", [])
    vid_loaders = inspected.get("video_loader_nodes", [])
    aud_loaders = inspected.get("audio_loader_nodes", [])
    all_loaders = img_loaders + vid_loaders + aud_loaders
    prompt_nodes = inspected.get("prompt_nodes", [])
    detected_nodes = inspected.get("detected_nodes", {})

    # 3. Resolve effective node mappings
    effective_mappings: Dict[str, str] = {}

    # Scene/project level mappings
    if isinstance(project_data.get("nodeMappings"), dict):
        effective_mappings.update(project_data["nodeMappings"])
    if isinstance(project_data.get("node_mappings"), dict):
        effective_mappings.update(project_data["node_mappings"])

    # Shot level explicit node mappings
    if isinstance(shot.get("node_mappings"), dict):
        effective_mappings.update(shot["node_mappings"])

    # Resolve assigned media slots (checking both numeric int and string keys)
    assigned_slots = shot.get("assigned_slots", {})
    if isinstance(assigned_slots, dict):
        for slot_key, fn in assigned_slots.items():
            if not fn or not isinstance(fn, str) or not fn.strip():
                continue
            clean_fn = fn.strip()
            try:
                slot_idx = int(slot_key)
            except (ValueError, TypeError):
                continue

            # Image Slots 0-8
            if 0 <= slot_idx <= 8:
                if slot_idx < len(img_loaders):
                    effective_mappings[str(img_loaders[slot_idx]["id"])] = clean_fn
                elif slot_idx < len(all_loaders):
                    effective_mappings[str(all_loaders[slot_idx]["id"])] = clean_fn

            # Audio Slots 9-10
            elif slot_idx in [9, 10]:
                aud_idx = slot_idx - 9
                if aud_idx < len(aud_loaders):
                    effective_mappings[str(aud_loaders[aud_idx]["id"])] = clean_fn
                elif slot_idx < len(all_loaders):
                    effective_mappings[str(all_loaders[slot_idx]["id"])] = clean_fn

            # Video Slot 11
            elif slot_idx == 11:
                if len(vid_loaders) > 0:
                    effective_mappings[str(vid_loaders[0]["id"])] = clean_fn
                elif slot_idx < len(all_loaders):
                    effective_mappings[str(all_loaders[slot_idx]["id"])] = clean_fn

            # Fallback for any other slot index
            elif slot_idx < len(all_loaders):
                effective_mappings[str(all_loaders[slot_idx]["id"])] = clean_fn

    # Resolve shared assets fallback
    shared_assets = project_data.get("shared_assets", [])
    if isinstance(shared_assets, list):
        for sa in shared_assets:
            if isinstance(sa, dict) and sa.get("filename"):
                s_idx = sa.get("slot_index")
                sa_fn = sa["filename"].strip()
                if isinstance(s_idx, int):
                    # Check if slot already assigned in shot
                    is_in_shot = (
                        isinstance(assigned_slots, dict)
                        and (s_idx in assigned_slots or str(s_idx) in assigned_slots)
                    )
                    if not is_in_shot:
                        if 0 <= s_idx <= 8 and s_idx < len(img_loaders):
                            node_id = str(img_loaders[s_idx]["id"])
                            if node_id not in effective_mappings:
                                effective_mappings[node_id] = sa_fn
                        elif s_idx in [9, 10] and (s_idx - 9) < len(aud_loaders):
                            node_id = str(aud_loaders[s_idx - 9]["id"])
                            if node_id not in effective_mappings:
                                effective_mappings[node_id] = sa_fn
                        elif s_idx == 11 and len(vid_loaders) > 0:
                            node_id = str(vid_loaders[0]["id"])
                            if node_id not in effective_mappings:
                                effective_mappings[node_id] = sa_fn
                        elif s_idx < len(all_loaders):
                            node_id = str(all_loaders[s_idx]["id"])
                            if node_id not in effective_mappings:
                                effective_mappings[node_id] = sa_fn

    # 4. Ingest prompt, prompt node ID, and generation parameters
    effective_prompt_node_id = (
        shot.get("prompt_node_id")
        or project_data.get("selectedPromptNodeId")
        or project_data.get("prompt_node_id")
        or (str(prompt_nodes[0]["id"]) if prompt_nodes else "")
    )

    # Hero Take and Snapshot Resolution
    takes = shot.get("takes") if isinstance(shot.get("takes"), list) else []
    hero_take_id = shot.get("hero_take_id")
    hero_take = None
    if takes:
        hero_take = next((t for t in takes if isinstance(t, dict) and (t.get("id") == hero_take_id or t.get("is_hero"))), None)
        if not hero_take and len(takes) > 0:
            hero_take = takes[-1]

    effective_prompt = (
        (hero_take.get("expanded_prompt") if hero_take and hero_take.get("expanded_prompt") else None)
        or shot.get("expanded_prompt")
        or shot.get("prompt")
        or shot.get("basic_stub")
        or project_data.get("expanded_prompt")
        or ""
    )

    # Parse generation parameters from nested or flat dictionaries (preferring hero take params if present)
    raw_params = (
        (hero_take.get("generation_params") if hero_take and hero_take.get("generation_params") else None)
        or shot.get("generation_parameters")
        or shot.get("generation_params")
        or shot.get("generationParams")
        or shot.get("parameter_overrides")
        or project_data.get("generation_parameters")
        or project_data.get("generation_params")
        or project_data.get("generationParams")
        or project_data.get("parameter_overrides")
        or {"steps": 30, "megapixels": 0.5, "frames": 81}
    )

    effective_params: Dict[str, Any] = {"steps": 30, "megapixels": 0.5, "frames": 81}
    effective_param_nodes: Dict[str, str] = {
        "steps": str(detected_nodes.get("steps") or ""),
        "megapixels": str(detected_nodes.get("megapixels") or ""),
        "frames": str(detected_nodes.get("frames") or "")
    }

    # Ingest parameter node mappings
    explicit_param_nodes = (
        shot.get("parameter_node_mappings")
        or shot.get("parameterNodeMappings")
        or project_data.get("parameter_node_mappings")
        or project_data.get("parameterNodeMappings")
    )
    if isinstance(explicit_param_nodes, dict):
        for pk, pn in explicit_param_nodes.items():
            if pn:
                effective_param_nodes[pk] = str(pn)

    # Ingest parameter values and nested node IDs
    if isinstance(raw_params, dict):
        for pk, pv in raw_params.items():
            if isinstance(pv, dict):
                if "value" in pv and pv["value"] is not None:
                    effective_params[pk] = pv["value"]
                if "node_id" in pv and pv["node_id"]:
                    effective_param_nodes[pk] = str(pv["node_id"])
            elif pv is not None:
                effective_params[pk] = pv

    # Merge additional direct parameter_overrides if passed
    direct_overrides = shot.get("parameter_overrides") or project_data.get("parameter_overrides")
    if isinstance(direct_overrides, dict):
        effective_params.update(direct_overrides)

    # Shot number, take number, and save video prefix
    shot_num = shot.get("shot_number", 1)
    try:
        shot_num_int = int(shot_num)
        shot_num_str = f"{shot_num_int:02d}"
    except Exception:
        shot_num_str = str(shot_num)

    # Determine Take Number
    take_num = shot.get("take_number")
    if take_num is None:
        if hero_take and hero_take.get("take_number") is not None:
            take_num = hero_take.get("take_number")
        else:
            take_numbers = [
                t.get("take_number")
                for t in takes
                if isinstance(t, dict) and t.get("take_number") is not None
            ]
            take_num = max(take_numbers, default=0) + 1

    save_video_prefix = (
        shot.get("save_video_prefix")
        or project_data.get("save_video_prefix")
        or f"{clean_scene_name}_Shot_{shot_num_str}_Take_{take_num}"
    )

    bypass_missing = (
        shot.get("bypass_missing")
        if "bypass_missing" in shot
        else shot.get("bypassMissing")
        if "bypassMissing" in shot
        else project_data.get("bypass_missing")
        if "bypass_missing" in project_data
        else project_data.get("bypassMissing", True)
    )

    safe_placeholder = (
        shot.get("safe_placeholder")
        or project_data.get("safe_placeholder")
        or "empty.png"
    )

    # 5. Inject and synthesize ready-to-run ComfyUI workflow
    return inject_and_prepare_workflow(
        workflow_data=template_json,
        prompt_node_id=effective_prompt_node_id,
        expanded_prompt=effective_prompt,
        node_mappings=effective_mappings,
        bypass_missing=bool(bypass_missing),
        safe_placeholder=safe_placeholder,
        parameter_overrides=effective_params,
        parameter_node_mappings=effective_param_nodes,
        save_video_prefix=save_video_prefix
    )

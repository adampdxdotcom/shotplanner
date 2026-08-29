import copy
from typing import Dict, Any, List, Optional

def inspect_workflow_nodes(workflow: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parse the flat dictionary keyed by node ID and identify:
    - Text prompt nodes (e.g. PrimitiveStringMultiline, CLIPTextEncode)
    - Image loader nodes (LoadImage, LoadImageMask, etc.)
    - Video loader nodes (LoadVideo, VHS_LoadVideo, etc.)
    - Audio loader nodes (LoadAudio, etc.)
    - Dynamic Workflow Overrides:
        * Sampling Steps: Check for any node whose inputs contain "steps"
        * Megapixels: Check for any node whose inputs contain "megapixels"
        * Duration / Frames: Check for any node whose inputs contain "frames", "length", "num_frames", or "duration"
    """
    prompt_nodes = []
    image_loader_nodes = []
    video_loader_nodes = []
    audio_loader_nodes = []
    other_nodes = []

    detected_nodes = {
        "steps": None,
        "megapixels": None,
        "frames": None
    }

    detected_values = {}

    for node_id, node_data in workflow.items():
        if not isinstance(node_data, dict):
            continue

        class_type = node_data.get("class_type", "")
        meta = node_data.get("_meta", {})
        title = meta.get("title") or f"{class_type} (#{node_id})"
        inputs = node_data.get("inputs", {})

        node_info = {
            "id": str(node_id),
            "class_type": class_type,
            "title": title,
            "inputs": inputs,
        }

        # Check for Prompt Nodes
        if class_type in ["PrimitiveStringMultiline", "CLIPTextEncode", "StringLiteral", "ShowText"]:
            current_value = inputs.get("value", inputs.get("text", ""))
            node_info["current_value"] = current_value if isinstance(current_value, str) else ""
            prompt_nodes.append(node_info)
        # Check for Image Nodes
        elif class_type in ["LoadImage", "LoadImageMask", "LoadImageFromUrl", "LoadImageBase64"]:
            node_info["current_file"] = inputs.get("image", "")
            image_loader_nodes.append(node_info)
        # Check for Video Nodes
        elif class_type in ["LoadVideo", "VHS_LoadVideo", "VHS_LoadVideoPath"]:
            node_info["current_file"] = inputs.get("video", "")
            video_loader_nodes.append(node_info)
        # Check for Audio Nodes
        elif class_type in ["LoadAudio", "VHS_LoadAudio"]:
            node_info["current_file"] = inputs.get("audio", "")
            audio_loader_nodes.append(node_info)
        else:
            other_nodes.append(node_info)

        # 1. Check for Sampling Steps ("steps")
        if detected_nodes["steps"] is None and isinstance(inputs, dict) and "steps" in inputs:
            detected_nodes["steps"] = str(node_id)
            detected_values["steps"] = inputs.get("steps")

        # 2. Check for Megapixels ("megapixels")
        if detected_nodes["megapixels"] is None and isinstance(inputs, dict) and "megapixels" in inputs:
            detected_nodes["megapixels"] = str(node_id)
            detected_values["megapixels"] = inputs.get("megapixels")

        # 3. Check for Duration / Frames ("frames", "length", "num_frames", "duration")
        if detected_nodes["frames"] is None and isinstance(inputs, dict):
            for frame_key in ["frames", "length", "num_frames", "duration", "frame_count"]:
                if frame_key in inputs:
                    detected_nodes["frames"] = str(node_id)
                    detected_values["frames"] = inputs.get(frame_key)
                    break

    return {
        "prompt_nodes": prompt_nodes,
        "image_loader_nodes": image_loader_nodes,
        "video_loader_nodes": video_loader_nodes,
        "audio_loader_nodes": audio_loader_nodes,
        "detected_nodes": detected_nodes,
        "detected_values": detected_values,
        "total_nodes": len(workflow)
    }

def inject_and_prepare_workflow(
    workflow_data: Dict[str, Any],
    prompt_node_id: Optional[str],
    expanded_prompt: str,
    node_mappings: Dict[str, str], # { "node_id": "filename.png" }
    bypass_missing: bool = True,
    safe_placeholder: str = "empty.png",
    parameter_overrides: Optional[Dict[str, Any]] = None,
    parameter_node_mappings: Optional[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Step B & C:
    Injects the expanded prompt into the chosen text node (inputs.value or inputs.text).
    Injects uploaded/renamed asset filenames into their mapped LoadImage/Video/Audio nodes.
    Applies bypass placeholder logic for unmapped loader nodes to prevent ComfyUI execution failure.
    Injects dynamic generation parameter overrides (steps, megapixels, frames/duration) into target nodes.
    """
    modified_wf = copy.deepcopy(workflow_data)

    # 1. Inject Expanded Prompt
    if prompt_node_id and prompt_node_id in modified_wf:
        target_node = modified_wf[prompt_node_id]
        inputs = target_node.get("inputs", {})
        if "value" in inputs or target_node.get("class_type") == "PrimitiveStringMultiline":
            inputs["value"] = expanded_prompt
        elif "text" in inputs or target_node.get("class_type") == "CLIPTextEncode":
            inputs["text"] = expanded_prompt
        else:
            # Fallback
            inputs["value"] = expanded_prompt
        target_node["inputs"] = inputs

    # 2. Inject Asset Mappings & Apply Bypass Logic
    for node_id, node_data in modified_wf.items():
        if not isinstance(node_data, dict):
            continue

        class_type = node_data.get("class_type", "")
        inputs = node_data.get("inputs", {})

        # Image loader node
        if class_type in ["LoadImage", "LoadImageMask"]:
            if str(node_id) in node_mappings and node_mappings[str(node_id)]:
                inputs["image"] = node_mappings[str(node_id)]
            elif bypass_missing and ("image" not in inputs or not inputs["image"]):
                inputs["image"] = safe_placeholder
            elif bypass_missing and inputs.get("image") == "example.png":
                # Replace generic example if unmapped
                inputs["image"] = safe_placeholder

        # Video loader node
        elif class_type in ["LoadVideo", "VHS_LoadVideo"]:
            if str(node_id) in node_mappings and node_mappings[str(node_id)]:
                inputs["video"] = node_mappings[str(node_id)]
            elif bypass_missing and ("video" not in inputs or not inputs["video"]):
                inputs["video"] = safe_placeholder

        # Audio loader node
        elif class_type in ["LoadAudio", "VHS_LoadAudio"]:
            if str(node_id) in node_mappings and node_mappings[str(node_id)]:
                inputs["audio"] = node_mappings[str(node_id)]
            elif bypass_missing and ("audio" not in inputs or not inputs["audio"]):
                inputs["audio"] = safe_placeholder

        node_data["inputs"] = inputs

    # 3. Inject Dynamic Generation Parameter Overrides (Step C)
    if parameter_overrides and parameter_node_mappings:
        # Sampling Steps
        steps_val = parameter_overrides.get("steps")
        steps_node = parameter_node_mappings.get("steps")
        if steps_node and str(steps_node) in modified_wf and steps_val is not None:
            n_inputs = modified_wf[str(steps_node)].setdefault("inputs", {})
            try:
                n_inputs["steps"] = int(steps_val)
            except (ValueError, TypeError):
                n_inputs["steps"] = steps_val

        # Megapixels
        mp_val = parameter_overrides.get("megapixels")
        mp_node = parameter_node_mappings.get("megapixels")
        if mp_node and str(mp_node) in modified_wf and mp_val is not None:
            n_inputs = modified_wf[str(mp_node)].setdefault("inputs", {})
            try:
                n_inputs["megapixels"] = float(mp_val)
            except (ValueError, TypeError):
                n_inputs["megapixels"] = mp_val

        # Duration / Frames
        frames_val = parameter_overrides.get("frames")
        frames_node = parameter_node_mappings.get("frames")
        if frames_node and str(frames_node) in modified_wf and frames_val is not None:
            n_inputs = modified_wf[str(frames_node)].setdefault("inputs", {})
            # Detect existing key name or default to frames
            matched_key = "frames"
            for k in ["frames", "length", "num_frames", "duration", "frame_count"]:
                if k in n_inputs:
                    matched_key = k
                    break
            try:
                n_inputs[matched_key] = int(frames_val)
            except (ValueError, TypeError):
                n_inputs[matched_key] = frames_val

    return modified_wf

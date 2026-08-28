import copy
from typing import Dict, Any, List, Optional

def inspect_workflow_nodes(workflow: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parse the flat dictionary keyed by node ID and identify:
    - Text prompt nodes (e.g. PrimitiveStringMultiline, CLIPTextEncode)
    - Image loader nodes (LoadImage, LoadImageMask, etc.)
    - Video loader nodes (LoadVideo, VHS_LoadVideo, etc.)
    - Audio loader nodes (LoadAudio, etc.)
    """
    prompt_nodes = []
    image_loader_nodes = []
    video_loader_nodes = []
    audio_loader_nodes = []
    other_nodes = []

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

    return {
        "prompt_nodes": prompt_nodes,
        "image_loader_nodes": image_loader_nodes,
        "video_loader_nodes": video_loader_nodes,
        "audio_loader_nodes": audio_loader_nodes,
        "total_nodes": len(workflow)
    }

def inject_and_prepare_workflow(
    workflow_data: Dict[str, Any],
    prompt_node_id: Optional[str],
    expanded_prompt: str,
    node_mappings: Dict[str, str], # { "node_id": "filename.png" }
    bypass_missing: bool = True,
    safe_placeholder: str = "empty.png"
) -> Dict[str, Any]:
    """
    Step B & C:
    Injects the expanded prompt into the chosen text node (inputs.value or inputs.text).
    Injects uploaded/renamed asset filenames into their mapped LoadImage/Video/Audio nodes.
    Applies bypass placeholder logic for unmapped loader nodes to prevent ComfyUI execution failure.
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

    return modified_wf

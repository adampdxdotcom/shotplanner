from typing import Dict, Any, List, Optional

def inspect_workflow_nodes(workflow: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parse standard ComfyUI visual canvas JSON ({"nodes": [...], "links": [...]})
    as well as API format flat dictionary keyed by node ID.
    Identifies:
    - Text prompt nodes (e.g. PrimitiveStringMultiline, CLIPTextEncode)
    - Image loader nodes (LoadImage, LoadImageMask, etc.) - all slots displayed, even if mode is muted/bypassed (mode: 4)
    - Video loader nodes (LoadVideo, VHS_LoadVideo, etc.)
    - Audio loader nodes (LoadAudio, etc.)
    - Dynamic Workflow Overrides (steps, megapixels, frames)
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

    # Case 1: Standard ComfyUI Visual Canvas Format ({"nodes": [...], "links": [...]})
    if isinstance(workflow, dict) and "nodes" in workflow and isinstance(workflow["nodes"], list):
        for node in workflow["nodes"]:
            if not isinstance(node, dict):
                continue

            node_id = str(node.get("id", ""))
            class_type = node.get("type", "")
            meta_title = node.get("title") or node.get("properties", {}).get("Node name for S&R") or f"{class_type} (#{node_id})"
            widgets_values = node.get("widgets_values", [])
            mode = node.get("mode", 0)  # 0: active, 2: muted, 4: bypassed

            node_info = {
                "id": node_id,
                "class_type": class_type,
                "title": meta_title,
                "mode": mode,
                "inputs": {
                    "widgets_values": widgets_values,
                    "inputs": node.get("inputs", [])
                }
            }

            # Check for Prompt Nodes
            if class_type in ["PrimitiveStringMultiline", "CLIPTextEncode", "StringLiteral", "ShowText"] or "prompt" in meta_title.lower():
                current_val = widgets_values[0] if isinstance(widgets_values, list) and len(widgets_values) > 0 else ""
                node_info["current_value"] = current_val if isinstance(current_val, str) else ""
                prompt_nodes.append(node_info)
            # Check for Image Nodes - Display ALL detected slots even if mode is muted/bypassed (mode: 4 or 2)
            elif class_type in ["LoadImage", "LoadImageMask", "LoadImageFromUrl", "LoadImageBase64"] or "image" in class_type.lower():
                current_file = ""
                if isinstance(widgets_values, list) and len(widgets_values) > 0:
                    current_file = widgets_values[0]
                elif isinstance(node.get("widgets_values_named"), dict):
                    current_file = node["widgets_values_named"].get("image", "")
                node_info["current_file"] = current_file if isinstance(current_file, str) else "example.png"
                image_loader_nodes.append(node_info)
            # Check for Video Nodes
            elif class_type in ["LoadVideo", "VHS_LoadVideo", "VHS_LoadVideoPath"]:
                current_file = widgets_values[0] if isinstance(widgets_values, list) and len(widgets_values) > 0 else ""
                node_info["current_file"] = current_file if isinstance(current_file, str) else ""
                video_loader_nodes.append(node_info)
            # Check for Audio Nodes
            elif class_type in ["LoadAudio", "VHS_LoadAudio"]:
                current_file = widgets_values[0] if isinstance(widgets_values, list) and len(widgets_values) > 0 else ""
                node_info["current_file"] = current_file if isinstance(current_file, str) else ""
                audio_loader_nodes.append(node_info)
            else:
                other_nodes.append(node_info)

            # Auto-detect parameters from widgets_values or type
            if detected_nodes["steps"] is None and ("step" in class_type.lower() or "sampler" in class_type.lower() or "videolength" in class_type.lower()):
                detected_nodes["steps"] = node_id
                if isinstance(widgets_values, list) and len(widgets_values) > 0:
                    detected_values["steps"] = widgets_values[0]

            if detected_nodes["megapixels"] is None and ("megapixel" in class_type.lower() or "resolution" in class_type.lower()):
                detected_nodes["megapixels"] = node_id
                if isinstance(widgets_values, list) and len(widgets_values) > 0:
                    detected_values["megapixels"] = widgets_values[0]

            # Broad duration/frame pattern matching
            duration_keywords = ["frame", "length", "duration", "videolength", "emptylatent", "latentvideo", "vhs", "minimax"]
            is_duration_candidate = any(kw in class_type.lower() or kw in meta_title.lower() for kw in duration_keywords)

            if detected_nodes["frames"] is None and is_duration_candidate:
                detected_nodes["frames"] = node_id
                found_val = None
                if "widgets_values_named" in node and isinstance(node["widgets_values_named"], dict):
                    for k in ["frames", "length", "num_frames", "duration", "frame_count", "video_length", "videolength", "latentvideo", "emptylatent", "vhs", "minimax", "value", "int", "count", "amount"]:
                        if k in node["widgets_values_named"] and isinstance(node["widgets_values_named"][k], (int, float)):
                            found_val = node["widgets_values_named"][k]
                            break
                if found_val is None and isinstance(widgets_values, list):
                    if len(widgets_values) > 1 and isinstance(widgets_values[1], (int, float)):
                        found_val = widgets_values[1]
                    elif len(widgets_values) > 0 and isinstance(widgets_values[0], (int, float)):
                        found_val = widgets_values[0]
                if found_val is not None:
                    detected_values["frames"] = found_val

        return {
            "prompt_nodes": prompt_nodes,
            "image_loader_nodes": image_loader_nodes,
            "video_loader_nodes": video_loader_nodes,
            "audio_loader_nodes": audio_loader_nodes,
            "detected_nodes": detected_nodes,
            "detected_values": detected_values,
            "total_nodes": len(workflow["nodes"])
        }

    # Case 2: Flat Dictionary API Format
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

        # 3. Check for Duration / Frames (Broad pattern matching)
        duration_keywords = ["frame", "length", "duration", "videolength", "emptylatent", "latentvideo", "vhs", "minimax"]
        is_duration_candidate = any(kw in class_type.lower() or kw in title.lower() for kw in duration_keywords)

        if detected_nodes["frames"] is None and isinstance(inputs, dict):
            matched_key = None
            for frame_key in ["frames", "length", "num_frames", "duration", "frame_count", "video_length", "videolength", "latentvideo", "emptylatent", "vhs", "minimax", "value", "int"]:
                if frame_key in inputs:
                    matched_key = frame_key
                    break
            if matched_key or is_duration_candidate:
                detected_nodes["frames"] = str(node_id)
                if matched_key and isinstance(inputs.get(matched_key), (int, float)):
                    detected_values["frames"] = inputs.get(matched_key)
                else:
                    for k, v in inputs.items():
                        if isinstance(v, (int, float)):
                            detected_values["frames"] = v
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

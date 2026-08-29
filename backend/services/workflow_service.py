import copy
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

            if detected_nodes["frames"] is None and ("frame" in class_type.lower() or "length" in class_type.lower() or "duration" in class_type.lower()):
                detected_nodes["frames"] = node_id
                if isinstance(widgets_values, list) and len(widgets_values) > 1:
                    detected_values["frames"] = widgets_values[1]
                elif isinstance(widgets_values, list) and len(widgets_values) > 0:
                    detected_values["frames"] = widgets_values[0]

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
    Updates workflow JSON (visual canvas format or API format):
    1. Node Retention (No Graph Pruning):
       Retain all 9 loader nodes and connections.
    2. Clean Default Override:
       For each mapped LoadImage node:
         * Update widgets_values[0] (or inputs["image"]) to assigned asset filename.
         * If node was muted/bypassed (mode: 4 or mode: 2), set mode: 0 (unmuted/active).
       For unmapped LoadImage nodes:
         * Set widgets_values[0] = "empty.png" (or inputs["image"] = "empty.png").
    3. Update Prompt and Generation Parameters.
    """
    modified_wf = copy.deepcopy(workflow_data)
    placeholder = safe_placeholder if safe_placeholder else "empty.png"

    # 1. Check if Visual Canvas format
    if isinstance(modified_wf, dict) and "nodes" in modified_wf and isinstance(modified_wf["nodes"], list):
        for node in modified_wf["nodes"]:
            if not isinstance(node, dict):
                continue

            node_id_str = str(node.get("id", ""))
            class_type = node.get("type", "")
            title = str(node.get("title") or "")

            # Update Prompt Node
            if (prompt_node_id and node_id_str == str(prompt_node_id)) or (not prompt_node_id and class_type == "PrimitiveStringMultiline"):
                if expanded_prompt:
                    if isinstance(node.get("widgets_values"), list) and len(node["widgets_values"]) > 0:
                        node["widgets_values"][0] = expanded_prompt
                    else:
                        node["widgets_values"] = [expanded_prompt]

            # Update Image Loader Nodes
            if class_type in ["LoadImage", "LoadImageMask", "LoadImageFromUrl", "LoadImageBase64"] or node_id_str in node_mappings:
                if node_id_str in node_mappings and node_mappings[node_id_str] and str(node_mappings[node_id_str]).strip():
                    assigned_file = str(node_mappings[node_id_str]).strip()
                    if isinstance(node.get("widgets_values"), list) and len(node["widgets_values"]) > 0:
                        node["widgets_values"][0] = assigned_file
                    else:
                        node["widgets_values"] = [assigned_file, "image"]
                    
                    if "widgets_values_named" in node and isinstance(node["widgets_values_named"], dict):
                        node["widgets_values_named"]["image"] = assigned_file
                    
                    # Unmute if muted or bypassed (mode: 4 or 2 -> mode: 0)
                    if node.get("mode") in [2, 4]:
                        node["mode"] = 0
                else:
                    # Unassigned slot -> clean default override with placeholder
                    if bypass_missing:
                        if isinstance(node.get("widgets_values"), list) and len(node["widgets_values"]) > 0:
                            if not node["widgets_values"][0] or node["widgets_values"][0] == "example.png":
                                node["widgets_values"][0] = placeholder
                        else:
                            node["widgets_values"] = [placeholder, "image"]

            # Video Loader Nodes
            elif class_type in ["LoadVideo", "VHS_LoadVideo", "VHS_LoadVideoPath"]:
                if node_id_str in node_mappings and node_mappings[node_id_str] and str(node_mappings[node_id_str]).strip():
                    assigned_file = str(node_mappings[node_id_str]).strip()
                    if isinstance(node.get("widgets_values"), list) and len(node["widgets_values"]) > 0:
                        node["widgets_values"][0] = assigned_file
                    else:
                        node["widgets_values"] = [assigned_file]
                    if node.get("mode") in [2, 4]:
                        node["mode"] = 0

            # Audio Loader Nodes
            elif class_type in ["LoadAudio", "VHS_LoadAudio"]:
                if node_id_str in node_mappings and node_mappings[node_id_str] and str(node_mappings[node_id_str]).strip():
                    assigned_file = str(node_mappings[node_id_str]).strip()
                    if isinstance(node.get("widgets_values"), list) and len(node["widgets_values"]) > 0:
                        node["widgets_values"][0] = assigned_file
                    else:
                        node["widgets_values"] = [assigned_file]
                    if node.get("mode") in [2, 4]:
                        node["mode"] = 0

            # Generation Parameter Overrides (Visual Node)
            if parameter_overrides and parameter_node_mappings:
                if parameter_node_mappings.get("steps") == node_id_str and parameter_overrides.get("steps") is not None:
                    try:
                        val = int(parameter_overrides["steps"])
                        if isinstance(node.get("widgets_values"), list) and len(node["widgets_values"]) > 0:
                            node["widgets_values"][0] = val
                    except Exception:
                        pass

                if parameter_node_mappings.get("frames") == node_id_str and parameter_overrides.get("frames") is not None:
                    try:
                        val = int(parameter_overrides["frames"])
                        if isinstance(node.get("widgets_values"), list) and len(node["widgets_values"]) > 1:
                            node["widgets_values"][1] = val
                        elif isinstance(node.get("widgets_values"), list) and len(node["widgets_values"]) > 0:
                            node["widgets_values"][0] = val
                    except Exception:
                        pass

        return modified_wf

    # 2. Case: Flat Dictionary API format
    # Inject Expanded Prompt into target prompt node
    if prompt_node_id and str(prompt_node_id) in modified_wf:
        target_node = modified_wf[str(prompt_node_id)]
        inputs = target_node.setdefault("inputs", {})
        if "value" in inputs or target_node.get("class_type") == "PrimitiveStringMultiline":
            inputs["value"] = expanded_prompt
        elif "text" in inputs or target_node.get("class_type") == "CLIPTextEncode":
            inputs["text"] = expanded_prompt
        else:
            inputs["value"] = expanded_prompt

    # Check every node in the graph for loader bypass / asset mapping (retaining all links and nodes)
    for node_id, node_data in modified_wf.items():
        if not isinstance(node_data, dict):
            continue

        class_type = node_data.get("class_type", "")
        inputs = node_data.setdefault("inputs", {})
        str_id = str(node_id)

        # Image loader nodes: Retain all 9 LoadImage nodes and links to Node #136
        if class_type in ["LoadImage", "LoadImageMask", "LoadImageFromUrl", "LoadImageBase64"]:
            if str_id in node_mappings and node_mappings[str_id] and str(node_mappings[str_id]).strip():
                # Asset is mapped
                inputs["image"] = str(node_mappings[str_id]).strip()
            else:
                # No asset mapped or still set to "example.png" -> replace with "empty.png"
                current_img = inputs.get("image", "")
                if not current_img or current_img == "example.png" or bypass_missing:
                    inputs["image"] = placeholder

        # Video loader nodes
        elif class_type in ["LoadVideo", "VHS_LoadVideo", "VHS_LoadVideoPath"]:
            if str_id in node_mappings and node_mappings[str_id] and str(node_mappings[str_id]).strip():
                inputs["video"] = str(node_mappings[str_id]).strip()
            elif bypass_missing and ("video" not in inputs or not inputs["video"] or "default" in str(inputs["video"])):
                inputs["video"] = placeholder

        # Audio loader nodes
        elif class_type in ["LoadAudio", "VHS_LoadAudio"]:
            if str_id in node_mappings and node_mappings[str_id] and str(node_mappings[str_id]).strip():
                inputs["audio"] = str(node_mappings[str_id]).strip()
            elif bypass_missing and ("audio" not in inputs or not inputs["audio"] or "default" in str(inputs["audio"])):
                inputs["audio"] = placeholder

    # Inject Dynamic Generation Parameter Overrides (Step C)
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


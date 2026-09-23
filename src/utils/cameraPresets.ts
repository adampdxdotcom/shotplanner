// Cinematography standard presets and normalization utilities

export const CAMERA_MOVEMENTS = [
  { label: "Locked Off (Static)", value: "Locked Off" },
  { label: "Slow Push In (Dolly In)", value: "Slow Push In" },
  { label: "Pull Out (Dolly Out)", value: "Pull Out" },
  { label: "Pan Left", value: "Pan Left" },
  { label: "Pan Right", value: "Pan Right" },
  { label: "Tilt Up", value: "Tilt Up" },
  { label: "Tilt Down", value: "Tilt Down" },
  { label: "Tracking Shot", value: "Tracking Shot" },
  { label: "Handheld Drift", value: "Handheld Drift" },
  { label: "Orbit Shot", value: "Orbit Shot" },
  { label: "Zoom In", value: "Zoom In" },
  { label: "Zoom Out", value: "Zoom Out" }
];

export const SHOT_TYPES = [
  { label: "Extreme Wide Shot (EWS)", value: "Extreme Wide Shot" },
  { label: "Wide Shot (WS)", value: "Wide Shot" },
  { label: "Medium Wide Shot (MWS)", value: "Medium Wide Shot" },
  { label: "Medium Shot (MS)", value: "Medium Shot" },
  { label: "Medium Close-Up (MCU)", value: "Medium Close-Up" },
  { label: "Close-Up (CU)", value: "Close-Up" },
  { label: "Extreme Close-Up (ECU)", value: "Extreme Close-Up" },
  { label: "Over-the-shoulder (OTS)", value: "Over-the-shoulder (OTS)" },
  { label: "Low Angle", value: "Low Angle" },
  { label: "High Angle", value: "High Angle" },
  { label: "Bird's Eye View", value: "Bird's Eye View" }
];

export const LENS_PRESETS = [
  { label: "24mm Wide-Angle", value: "24mm Wide-Angle" },
  { label: "35mm Natural", value: "35mm Natural" },
  { label: "50mm Standard Prime", value: "50mm Standard Prime" },
  { label: "85mm Portrait Telephoto", value: "85mm Portrait Telephoto" },
  { label: "135mm Cinematic Compression", value: "135mm Cinematic Compression" },
  { label: "Macro / Close-Up", value: "Macro / Close-Up" }
];

export const ASPECT_RATIO_PRESETS = [
  { label: "16:9 Widescreen", value: "16:9 Widescreen" },
  { label: "9:16 Vertical", value: "9:16 Vertical" },
  { label: "2.39:1 Anamorphic", value: "2.39:1 Anamorphic" },
  { label: "4:3 Classic", value: "4:3 Classic" },
  { label: "1:1 Square", value: "1:1 Square" }
];

/**
 * Normalizes any free-form or verbose camera movement string from LLM responses
 * into canonical studio presets.
 */
export function normalizeCameraMovement(raw?: string | null): string {
  if (!raw || typeof raw !== "string") return "Locked Off";
  const str = raw.trim();
  if (!str) return "Locked Off";

  // Check exact preset value match first
  const exact = CAMERA_MOVEMENTS.find(
    cm => cm.value.toLowerCase() === str.toLowerCase() || cm.label.toLowerCase() === str.toLowerCase()
  );
  if (exact) return exact.value;

  const lower = str.toLowerCase();

  // Push in / Dolly in / Zoom in
  if (
    lower.includes("push in") ||
    lower.includes("push-in") ||
    lower.includes("dolly in") ||
    lower.includes("dolly-in") ||
    lower.includes("pushing in") ||
    lower.includes("dolly forward")
  ) {
    return "Slow Push In";
  }

  // Pull out / Dolly out / Dolly back
  if (
    lower.includes("pull out") ||
    lower.includes("pull-out") ||
    lower.includes("dolly out") ||
    lower.includes("dolly-out") ||
    lower.includes("dolly back") ||
    lower.includes("pulling out")
  ) {
    return "Pull Out";
  }

  // Zoom in
  if (lower.includes("zoom in") || lower.includes("zoomin")) {
    return "Zoom In";
  }

  // Zoom out
  if (lower.includes("zoom out") || lower.includes("zoomout")) {
    return "Zoom Out";
  }

  // Pan Left / Right
  if (lower.includes("pan left") || lower.includes("panning left")) {
    return "Pan Left";
  }
  if (lower.includes("pan right") || lower.includes("panning right") || lower.includes("pan")) {
    return lower.includes("left") ? "Pan Left" : "Pan Right";
  }

  // Tilt Up / Down
  if (lower.includes("tilt up") || lower.includes("tilting up")) {
    return "Tilt Up";
  }
  if (lower.includes("tilt down") || lower.includes("tilting down")) {
    return "Tilt Down";
  }

  // Tracking shot / Follow shot
  if (lower.includes("tracking") || lower.includes("track") || lower.includes("follow")) {
    return "Tracking Shot";
  }

  // Handheld / Shaky
  if (lower.includes("handheld") || lower.includes("drift") || lower.includes("organic")) {
    return "Handheld Drift";
  }

  // Orbit / Arc
  if (lower.includes("orbit") || lower.includes("arc") || lower.includes("360")) {
    return "Orbit Shot";
  }

  // Locked off / Static
  if (lower.includes("locked") || lower.includes("static") || lower.includes("fixed") || lower.includes("tripod")) {
    return "Locked Off";
  }

  // If none matched, return original string clean
  return str;
}

/**
 * Normalizes free-form shot type / framing strings into canonical studio presets.
 */
export function normalizeShotType(raw?: string | null): string {
  if (!raw || typeof raw !== "string") return "Medium Shot";
  const str = raw.trim();
  if (!str) return "Medium Shot";

  const exact = SHOT_TYPES.find(
    st => st.value.toLowerCase() === str.toLowerCase() || st.label.toLowerCase() === str.toLowerCase()
  );
  if (exact) return exact.value;

  const lower = str.toLowerCase();

  if (lower.includes("extreme close") || lower.includes("ecu")) return "Extreme Close-Up";
  if (lower.includes("medium close") || lower.includes("mcu")) return "Medium Close-Up";
  if (lower.includes("close-up") || lower.includes("close up") || lower.includes("cu")) return "Close-Up";
  if (lower.includes("extreme wide") || lower.includes("ews")) return "Extreme Wide Shot";
  if (lower.includes("medium wide") || lower.includes("mws")) return "Medium Wide Shot";
  if (lower.includes("wide") || lower.includes("ws")) return "Wide Shot";
  if (lower.includes("over-the-shoulder") || lower.includes("over the shoulder") || lower.includes("ots")) {
    return "Over-the-shoulder (OTS)";
  }
  if (lower.includes("low angle")) return "Low Angle";
  if (lower.includes("high angle")) return "High Angle";
  if (lower.includes("bird") || lower.includes("overhead") || lower.includes("top-down")) return "Bird's Eye View";
  if (lower.includes("medium") || lower.includes("ms")) return "Medium Shot";

  return str;
}

/**
 * Normalizes lens and focal length strings.
 */
export function normalizeLensPreset(raw?: string | null): string {
  if (!raw || typeof raw !== "string") return "50mm Standard Prime";
  const str = raw.trim();
  if (!str) return "50mm Standard Prime";

  const exact = LENS_PRESETS.find(
    lp => lp.value.toLowerCase() === str.toLowerCase() || lp.label.toLowerCase() === str.toLowerCase()
  );
  if (exact) return exact.value;

  const lower = str.toLowerCase();
  if (lower.includes("24mm")) return "24mm Wide-Angle";
  if (lower.includes("35mm")) return "35mm Natural";
  if (lower.includes("50mm") || lower.includes("prime")) return "50mm Standard Prime";
  if (lower.includes("85mm") || lower.includes("portrait")) return "85mm Portrait Telephoto";
  if (lower.includes("135mm") || lower.includes("compression")) return "135mm Cinematic Compression";
  if (lower.includes("macro")) return "Macro / Close-Up";

  return str;
}

/**
 * Normalizes aspect ratio strings.
 */
export function normalizeAspectRatio(raw?: string | null): string {
  if (!raw || typeof raw !== "string") return "16:9 Widescreen";
  const str = raw.trim();
  if (!str) return "16:9 Widescreen";

  const exact = ASPECT_RATIO_PRESETS.find(
    ar => ar.value.toLowerCase() === str.toLowerCase() || ar.label.toLowerCase() === str.toLowerCase()
  );
  if (exact) return exact.value;

  const lower = str.toLowerCase();
  if (lower.includes("9:16") || lower.includes("vertical")) return "9:16 Vertical";
  if (lower.includes("2.39") || lower.includes("anamorphic") || lower.includes("cinemascope")) return "2.39:1 Anamorphic";
  if (lower.includes("4:3") || lower.includes("classic")) return "4:3 Classic";
  if (lower.includes("1:1") || lower.includes("square")) return "1:1 Square";

  return "16:9 Widescreen";
}

/**
 * Normalizes shot changes dictionary from Assistant actions,
 * resolving alias keys and normalizing camera/framing values.
 */
export function normalizeShotChanges(changes: any): Record<string, any> {
  if (!changes || typeof changes !== "object") return {};
  const normalized: Record<string, any> = { ...changes };

  // Alias key mappings for camera movement
  if (normalized.camera && !normalized.camera_movement) {
    normalized.camera_movement = normalized.camera;
    delete normalized.camera;
  }
  if (normalized.movement && !normalized.camera_movement) {
    normalized.camera_movement = normalized.movement;
    delete normalized.movement;
  }
  if (normalized.cameraMovement && !normalized.camera_movement) {
    normalized.camera_movement = normalized.cameraMovement;
    delete normalized.cameraMovement;
  }
  if (normalized.camera_move && !normalized.camera_movement) {
    normalized.camera_movement = normalized.camera_move;
    delete normalized.camera_move;
  }
  if (normalized.cameraMove && !normalized.camera_movement) {
    normalized.camera_movement = normalized.cameraMove;
    delete normalized.cameraMove;
  }

  // Alias key mappings for shot type / framing
  if (normalized.framing && !normalized.shot_type) {
    normalized.shot_type = normalized.framing;
    delete normalized.framing;
  }
  if (normalized.shot && !normalized.shot_type && typeof normalized.shot === "string") {
    normalized.shot_type = normalized.shot;
    delete normalized.shot;
  }
  if (normalized.shotType && !normalized.shot_type) {
    normalized.shot_type = normalized.shotType;
    delete normalized.shotType;
  }
  if (normalized.type && !normalized.shot_type && typeof normalized.type === "string" && normalized.type !== "update_shot") {
    normalized.shot_type = normalized.type;
    delete normalized.type;
  }

  // Alias key mappings for lens
  if (normalized.lens && !normalized.lens_focal_length) {
    normalized.lens_focal_length = normalized.lens;
    delete normalized.lens;
  }
  if (normalized.focal_length && !normalized.lens_focal_length) {
    normalized.lens_focal_length = normalized.focal_length;
    delete normalized.focal_length;
  }
  if (normalized.focalLength && !normalized.lens_focal_length) {
    normalized.lens_focal_length = normalized.focalLength;
    delete normalized.focalLength;
  }
  if (normalized.lensFocalLength && !normalized.lens_focal_length) {
    normalized.lens_focal_length = normalized.lensFocalLength;
    delete normalized.lensFocalLength;
  }

  // Alias key mappings for camera angle
  if (normalized.angle && !normalized.camera_angle) {
    normalized.camera_angle = normalized.angle;
    delete normalized.angle;
  }
  if (normalized.cameraAngle && !normalized.camera_angle) {
    normalized.camera_angle = normalized.cameraAngle;
    delete normalized.cameraAngle;
  }

  // Alias key mappings for prompt stubs
  if (normalized.prompt_stub && !normalized.basic_stub) {
    normalized.basic_stub = normalized.prompt_stub;
    delete normalized.prompt_stub;
  }
  if (normalized.stub && !normalized.basic_stub) {
    normalized.basic_stub = normalized.stub;
    delete normalized.stub;
  }
  if (normalized.action && !normalized.basic_stub && typeof normalized.action === "string") {
    normalized.basic_stub = normalized.action;
    delete normalized.action;
  }

  // Alias key mappings for aspect ratio
  if (normalized.aspectRatio && !normalized.aspect_ratio) {
    normalized.aspect_ratio = normalized.aspectRatio;
    delete normalized.aspectRatio;
  }
  if (normalized.ratio && !normalized.aspect_ratio) {
    normalized.aspect_ratio = normalized.ratio;
    delete normalized.ratio;
  }

  // Alias key mappings for lighting
  if (normalized.lighting && !normalized.lighting_setup) {
    normalized.lighting_setup = normalized.lighting;
    delete normalized.lighting;
  }
  if (normalized.lightingSetup && !normalized.lighting_setup) {
    normalized.lighting_setup = normalized.lightingSetup;
    delete normalized.lightingSetup;
  }

  // Normalize Generation Parameters (Sampling Steps, Megapixels, Total Seconds/Frames)
  let genParams = normalized.generation_params || normalized.generationParams || {};
  if (typeof genParams !== "object" || genParams === null) {
    genParams = {};
  } else {
    genParams = { ...genParams };
  }

  if (genParams.sampling_steps !== undefined && genParams.steps === undefined) {
    genParams.steps = genParams.sampling_steps;
    delete genParams.sampling_steps;
  }
  if (genParams.total_seconds !== undefined && genParams.frames === undefined) {
    genParams.frames = genParams.total_seconds;
    delete genParams.total_seconds;
  }
  if (genParams.seconds !== undefined && genParams.frames === undefined) {
    genParams.frames = genParams.seconds;
    delete genParams.seconds;
  }
  if (genParams.duration !== undefined && genParams.frames === undefined) {
    genParams.frames = genParams.duration;
    delete genParams.duration;
  }

  if (normalized.steps !== undefined && genParams.steps === undefined) {
    genParams.steps = normalized.steps;
    delete normalized.steps;
  }
  if (normalized.sampling_steps !== undefined && genParams.steps === undefined) {
    genParams.steps = normalized.sampling_steps;
    delete normalized.sampling_steps;
  }
  if (normalized.megapixels !== undefined && genParams.megapixels === undefined) {
    genParams.megapixels = normalized.megapixels;
    delete normalized.megapixels;
  }
  if (normalized.frames !== undefined && genParams.frames === undefined) {
    genParams.frames = normalized.frames;
    delete normalized.frames;
  }
  if (normalized.total_seconds !== undefined && genParams.frames === undefined) {
    genParams.frames = normalized.total_seconds;
    delete normalized.total_seconds;
  }
  if (normalized.totalSeconds !== undefined && genParams.frames === undefined) {
    genParams.frames = normalized.totalSeconds;
    delete normalized.totalSeconds;
  }

  const finalGen: Record<string, number> = {};
  if (genParams.steps !== undefined && genParams.steps !== null) {
    const s = parseInt(String(genParams.steps), 10);
    if (!isNaN(s) && s > 0) finalGen.steps = s;
  }
  if (genParams.megapixels !== undefined && genParams.megapixels !== null) {
    const m = parseFloat(String(genParams.megapixels));
    if (!isNaN(m) && m > 0) finalGen.megapixels = m;
  }
  if (genParams.frames !== undefined && genParams.frames !== null) {
    const f = parseFloat(String(genParams.frames));
    if (!isNaN(f) && f > 0) finalGen.frames = f;
  }

  if (Object.keys(finalGen).length > 0) {
    normalized.generation_params = finalGen;
  } else {
    delete normalized.generation_params;
  }
  delete normalized.generationParams;

  // Value normalization using canonical presets
  if (normalized.camera_movement) {
    normalized.camera_movement = normalizeCameraMovement(normalized.camera_movement);
  }
  if (normalized.shot_type) {
    normalized.shot_type = normalizeShotType(normalized.shot_type);
  }
  if (normalized.lens_focal_length) {
    normalized.lens_focal_length = normalizeLensPreset(normalized.lens_focal_length);
  }
  if (normalized.aspect_ratio) {
    normalized.aspect_ratio = normalizeAspectRatio(normalized.aspect_ratio);
  }

  return normalized;
}

import { CivitaiFavorite, CivitaiModelMetadata } from "../types";

const FAVORITES_API_URL = "/api/civitai/favorites";
const LOCAL_STORAGE_KEY = "civitai_saved_favorites_cache";

/**
 * Fetch all saved Civitai favorites from the backend (with localStorage cache fallback)
 */
export async function fetchCivitaiFavorites(): Promise<CivitaiFavorite[]> {
  try {
    const res = await fetch(FAVORITES_API_URL);
    if (res.ok) {
      const data = await res.json();
      const list = Array.isArray(data.favorites) ? data.favorites : Array.isArray(data) ? data : [];
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
      } catch (e) {}
      return list;
    }
  } catch (err) {
    console.warn("[Civitai Favorites] Backend fetch failed, reading from localStorage:", err);
  }

  // Fallback to local storage
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {}

  return [];
}

/**
 * Persist a model to saved favorites
 */
export async function addCivitaiFavorite(
  model: CivitaiModelMetadata | CivitaiFavorite
): Promise<CivitaiFavorite> {
  const versionId = model.version_id;
  if (!versionId) {
    throw new Error("Cannot favorite model without a valid version ID.");
  }

  const anyModel = model as any;
  const nameVal = anyModel.model_name || anyModel.name || "Civitai Model";
  const imgVal = anyModel.preview_image_url || anyModel.image_url || "";
  const sizeVal = anyModel.file_size_formatted || anyModel.file_size || "";
  const triggerWordsVal = anyModel.trained_words || anyModel.trigger_words || anyModel.trainedWords || [];
  const descVal = anyModel.clean_description || anyModel.description || "";

  const payload: CivitaiFavorite = {
    version_id: Number(versionId),
    model_id: Number(anyModel.model_id) || 0,
    name: nameVal,
    model_name: nameVal,
    version_name: anyModel.version_name || "",
    category: anyModel.category || "Checkpoint",
    base_model: anyModel.base_model || "SDXL 1.0",
    image_url: imgVal,
    preview_image_url: imgVal,
    file_size: sizeVal,
    file_size_formatted: sizeVal,
    file_size_bytes: anyModel.file_size_bytes || 0,
    filename: anyModel.filename || "",
    download_url: anyModel.download_url || "",
    default_destination_folder: anyModel.default_destination_folder || "models/checkpoints/",
    suggested_remote_path: anyModel.suggested_remote_path || "",
    trigger_words: triggerWordsVal,
    trained_words: triggerWordsVal,
    trainedWords: triggerWordsVal,
    description: descVal,
    clean_description: descVal,
    download_command: anyModel.download_command || "",
    tags: anyModel.tags || [],
    added_at: new Date().toISOString()
  };

  try {
    const res = await fetch(FAVORITES_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      return data.favorite || payload;
    }
  } catch (err) {
    console.warn("[Civitai Favorites] Save POST failed, updating localStorage:", err);
  }

  // Update local cache
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    const list: CivitaiFavorite[] = cached ? JSON.parse(cached) : [];
    const idx = list.findIndex((f) => String(f.version_id) === String(payload.version_id));
    if (idx >= 0) {
      list[idx] = payload;
    } else {
      list.unshift(payload);
    }
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {}

  return payload;
}

/**
 * Remove a model from favorites by its version ID
 */
export async function removeCivitaiFavorite(versionId: number | string): Promise<boolean> {
  const normId = String(versionId);
  try {
    const res = await fetch(`${FAVORITES_API_URL}/${encodeURIComponent(normId)}`, {
      method: "DELETE"
    });
    if (res.ok) {
      return true;
    }
  } catch (err) {
    console.warn("[Civitai Favorites] Delete request failed:", err);
  }

  // Update local cache
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (cached) {
      const list: CivitaiFavorite[] = JSON.parse(cached);
      const filtered = list.filter((f) => String(f.version_id) !== normId);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch (e) {}

  return true;
}

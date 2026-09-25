import fs from "fs";
import { REMOTE_CONFIG_FILE } from "../config/constants";
import { writeJsonAtomicSync } from "../utils/atomicFs";
import { createScopedLogger } from "../utils/logger";

const log = createScopedLogger("RemoteSettings");

export interface StoredRemoteSettings {
  remote_host?: string;
  ssh_port?: number;
  ssh_username?: string;
  ssh_password?: string;
  ssh_key_path?: string;
  ssh_private_key?: string;
  ssh_public_key?: string;
  remote_comfyui_root?: string;
  comfyui_api_url?: string;
  remote_api_token?: string;
  updated_at?: string;
}

/**
 * Retrieve saved remote server, GPU, and SSH credentials from server storage
 */
export function getStoredRemoteSettings(): StoredRemoteSettings {
  if (fs.existsSync(REMOTE_CONFIG_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(REMOTE_CONFIG_FILE, "utf-8"));
      return data || {};
    } catch (e: any) {
      log.warn("Failed to parse remote_config.json, returning empty settings", { error: e?.message || e });
    }
  }
  return {};
}

/**
 * Atomically persist remote server, GPU, and SSH credentials to server storage
 */
export function saveStoredRemoteSettings(settings: Partial<StoredRemoteSettings>): StoredRemoteSettings {
  const current = getStoredRemoteSettings();
  const updated: StoredRemoteSettings = {
    ...current,
    ...settings,
    updated_at: new Date().toISOString()
  };
  writeJsonAtomicSync(REMOTE_CONFIG_FILE, updated);
  log.info("Persisted remote server and SSH settings", {
    remote_host: updated.remote_host,
    ssh_port: updated.ssh_port,
    has_private_key: Boolean(updated.ssh_private_key)
  });
  return updated;
}

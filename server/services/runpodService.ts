import fs from "fs";
import path from "path";
import nodeFetchModule from "node-fetch";
import { RUNPOD_CONFIG_FILE } from "../config/constants";

const getFetch = (): typeof fetch => {
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch as typeof fetch;
  }
  return ((nodeFetchModule as any).default || nodeFetchModule) as typeof fetch;
};

export function getStoredRunpodApiKey(): string | null {
  if (process.env.RUNPOD_API_KEY && process.env.RUNPOD_API_KEY.trim()) {
    return process.env.RUNPOD_API_KEY.trim();
  }
  try {
    if (fs.existsSync(RUNPOD_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(RUNPOD_CONFIG_FILE, "utf-8"));
      if (data && typeof data.api_key === "string" && data.api_key.trim()) {
        return data.api_key.trim();
      }
    }
  } catch (err) {
    console.error("[RunPod] Error reading runpod_config.json:", err);
  }
  return null;
}

export function saveRunpodApiKey(apiKey: string): void {
  try {
    const dir = path.dirname(RUNPOD_CONFIG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(RUNPOD_CONFIG_FILE, JSON.stringify({ api_key: apiKey.trim() }, null, 2), "utf-8");
  } catch (err) {
    console.error("[RunPod] Error saving runpod_config.json:", err);
  }
}

export function removeRunpodApiKey(): void {
  try {
    if (fs.existsSync(RUNPOD_CONFIG_FILE)) {
      fs.unlinkSync(RUNPOD_CONFIG_FILE);
    }
  } catch (err) {
    console.error("[RunPod] Error removing runpod_config.json:", err);
  }
}

export interface RunpodPodPort {
  ip: string;
  isIpPublic: boolean;
  privatePort: number;
  publicPort: number;
  type: string;
}

export interface RunpodPodItem {
  id: string;
  name: string;
  desiredStatus: string;
  uptimeInSeconds?: number;
  gpuCount?: number;
  gpuDisplayName?: string;
  memoryInGb?: number;
  vcpuCount?: number;
  imageName?: string;
  volumeInGb?: number;
  containerDiskInGb?: number;
  costPerHr?: number;
  ip?: string;
  sshPort?: number;
  comfyUrl?: string;
  proxyUrl?: string;
  ports?: RunpodPodPort[];
}

/**
 * Fetch list of active pods from RunPod GraphQL API
 */
export async function fetchRunpodPods(apiKey?: string): Promise<RunpodPodItem[]> {
  const effectiveKey = (apiKey && apiKey.trim()) || getStoredRunpodApiKey() || "";
  if (!effectiveKey) {
    throw new Error("RunPod API Key is required.");
  }

  if (apiKey && apiKey.trim()) {
    saveRunpodApiKey(apiKey.trim());
  }

  const cleanKey = effectiveKey.trim();
  const graphqlEndpoint = `https://api.runpod.io/graphql?api_key=${cleanKey}`;

  const query = `
    query MyPods {
      myself {
        id
        email
        pods {
          id
          name
          desiredStatus
          imageName
          volumeInGb
          containerDiskInGb
          costPerHr
          gpuCount
          memoryInGb
          vcpuCount
          machine {
            gpuDisplayName
          }
          runtime {
            uptimeInSeconds
            ports {
              ip
              isIpPublic
              privatePort
              publicPort
              type
            }
          }
        }
      }
    }
  `;

  const fetchFn = getFetch();
  const response = await fetchFn(graphqlEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${cleanKey}`
    },
    body: JSON.stringify({ query })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RunPod API HTTP ${response.status}: ${errorText || response.statusText}`);
  }

  const json: any = await response.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(`RunPod API Error: ${json.errors[0].message || JSON.stringify(json.errors)}`);
  }

  const rawPods = json.data?.myself?.pods || [];
  const pods: RunpodPodItem[] = [];

  for (const pod of rawPods) {
    const ports: RunpodPodPort[] = pod.runtime?.ports || [];
    
    // Locate mapped SSH port (privatePort 22)
    const sshMapping = ports.find(p => p.privatePort === 22);
    const ip = sshMapping?.ip;
    const sshPort = sshMapping?.publicPort;

    // Locate mapped ComfyUI port (privatePort 8188)
    const comfyMapping = ports.find(p => p.privatePort === 8188);
    let comfyUrl: string | undefined = undefined;
    if (comfyMapping && comfyMapping.ip && comfyMapping.publicPort) {
      comfyUrl = `http://${comfyMapping.ip}:${comfyMapping.publicPort}`;
    }

    // RunPod standard proxy URL for port 8188
    const proxyUrl = `https://${pod.id}-8188.proxy.runpod.net`;

    pods.push({
      id: pod.id,
      name: pod.name || `Pod ${pod.id}`,
      desiredStatus: pod.desiredStatus || "UNKNOWN",
      uptimeInSeconds: pod.runtime?.uptimeInSeconds || 0,
      gpuCount: pod.gpuCount,
      gpuDisplayName: pod.machine?.gpuDisplayName || (pod.gpuCount ? `${pod.gpuCount}x GPU` : undefined),
      memoryInGb: pod.memoryInGb,
      vcpuCount: pod.vcpuCount,
      imageName: pod.imageName,
      volumeInGb: pod.volumeInGb,
      containerDiskInGb: pod.containerDiskInGb,
      costPerHr: pod.costPerHr,
      ip,
      sshPort,
      comfyUrl: comfyUrl || proxyUrl,
      proxyUrl,
      ports
    });
  }

  return pods;
}

/**
 * Register an SSH Public Key with RunPod user account
 */
export async function addSSHKeyToRunpodAccount(apiKey: string | undefined, publicKey: string): Promise<boolean> {
  const effectiveKey = (apiKey && apiKey.trim()) || getStoredRunpodApiKey() || "";
  if (!effectiveKey) {
    throw new Error("RunPod API Key is required.");
  }
  if (!publicKey || !publicKey.trim()) {
    throw new Error("Public SSH Key is required.");
  }

  if (apiKey && apiKey.trim()) {
    saveRunpodApiKey(apiKey.trim());
  }

  const cleanKey = effectiveKey.trim();
  const cleanPubKey = publicKey.trim();
  const graphqlEndpoint = `https://api.runpod.io/graphql?api_key=${cleanKey}`;

  const mutation = `
    mutation SaveSshKey($key: String!) {
      saveSshKey(key: $key) {
        id
        name
      }
    }
  `;

  const fetchFn = getFetch();
  const response = await fetchFn(graphqlEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${cleanKey}`
    },
    body: JSON.stringify({
      query: mutation,
      variables: { key: cleanPubKey }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RunPod API HTTP ${response.status}: ${errorText || response.statusText}`);
  }

  const json: any = await response.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(`RunPod API Error: ${json.errors[0].message}`);
  }

  return true;
}

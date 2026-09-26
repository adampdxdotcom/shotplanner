import fs from "fs";
import path from "path";
import nodeFetchModule from "node-fetch";
import { RUNPOD_CONFIG_FILE } from "../config/constants";
import { writeJsonAtomicSync } from "../utils/atomicFs";
import { createScopedLogger } from "../utils/logger";

const log = createScopedLogger("RunPodService");

const getFetch = (): typeof fetch => {
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch as typeof fetch;
  }
  return ((nodeFetchModule as any).default || nodeFetchModule) as typeof fetch;
};

export function getStoredRunpodApiKey(): string | null {
  try {
    if (fs.existsSync(RUNPOD_CONFIG_FILE)) {
      const data = JSON.parse(fs.readFileSync(RUNPOD_CONFIG_FILE, "utf-8"));
      if (data && typeof data.api_key === "string" && data.api_key.trim()) {
        return data.api_key.trim();
      }
    }
  } catch (err) {
    log.error("Error reading runpod_config.json", { error: err });
  }

  if (process.env.RUNPOD_API_KEY && process.env.RUNPOD_API_KEY.trim()) {
    return process.env.RUNPOD_API_KEY.trim();
  }
  return null;
}

export function saveRunpodApiKey(apiKey: string): void {
  try {
    writeJsonAtomicSync(RUNPOD_CONFIG_FILE, { api_key: apiKey.trim() });
  } catch (err) {
    log.error("Error saving runpod_config.json", { error: err });
  }
}

export function removeRunpodApiKey(): void {
  try {
    if (fs.existsSync(RUNPOD_CONFIG_FILE)) {
      fs.unlinkSync(RUNPOD_CONFIG_FILE);
    }
  } catch (err) {
    log.error("Error removing runpod_config.json", { error: err });
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

export interface RunpodGpuType {
  id: string;
  displayName: string;
  memoryInGb: number;
  securePrice?: number;
  communityPrice?: number;
  secureSpotPrice?: number;
  communitySpotPrice?: number;
  lowestPrice?: {
    minimumBidPrice?: number;
    uninterruptablePrice?: number;
  };
  stockStatus?: "HIGH" | "MEDIUM" | "LOW" | "OUT_OF_STOCK" | "AVAILABLE";
  isPopular?: boolean;
}

export interface RunpodTemplateItem {
  id: string;
  name: string;
  imageName: string;
  containerDiskInGb?: number;
  volumeInGb?: number;
  volumeMountPath?: string;
  ports?: string;
  env?: Array<{ key: string; value: string }>;
  isServerless?: boolean;
  isPublic?: boolean;
  readme?: string;
  isCurated?: boolean;
  description?: string;
  recommendedCategory?: "comfyui" | "video" | "base";
}

export interface RunpodNetworkVolumeItem {
  id: string;
  name: string;
  size: number;
  dataCenterId: string;
}

export interface RunpodDeployOptions {
  gpuTypeId: string;
  name?: string;
  cloudType?: "COMMUNITY" | "SECURE" | "ALL";
  gpuCount?: number;
  volumeInGb?: number;
  containerDiskInGb?: number;
  volumeMountPath?: string;
  ports?: string;
  templateId?: string;
  imageName?: string;
  networkVolumeId?: string;
  publicKey?: string;
  env?: Record<string, string>;
  isSpot?: boolean;
}

// Curated ComfyUI templates designed for instant one-click deployment
export const CURATED_COMFYUI_TEMPLATES: RunpodTemplateItem[] = [
  {
    id: "curated-comfyui-official",
    name: "ComfyUI Standard (Ports 8188 & 22 Pre-configured)",
    imageName: "runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04",
    containerDiskInGb: 40,
    volumeInGb: 50,
    volumeMountPath: "/workspace",
    ports: "8188/http,22/tcp",
    isCurated: true,
    recommendedCategory: "comfyui",
    description: "Production PyTorch 2.2 + CUDA 12.1 environment with automatic port mapping for ComfyUI web UI and SSH access."
  },
  {
    id: "curated-comfyui-video-wan",
    name: "ComfyUI Video Production (Wan2.1 / SDXL / Extra Storage)",
    imageName: "runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04",
    containerDiskInGb: 50,
    volumeInGb: 100,
    volumeMountPath: "/workspace",
    ports: "8188/http,22/tcp",
    isCurated: true,
    recommendedCategory: "video",
    description: "Expanded 100GB persistent volume tailored for heavy video models (Wan2.1, HunyuanVideo, Cosmos) and LoRA checkpoints."
  },
  {
    id: "curated-pytorch-base",
    name: "Clean PyTorch Base (CUDA 12.1 Devel)",
    imageName: "runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04",
    containerDiskInGb: 30,
    volumeInGb: 40,
    volumeMountPath: "/workspace",
    ports: "8188/http,22/tcp,8888/http",
    isCurated: true,
    recommendedCategory: "base",
    description: "Standard developer workspace with Jupyter and SSH access."
  }
];

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
 * Fetch available GPU types and pricing from RunPod GraphQL API
 */
export async function fetchRunpodGpuTypes(apiKey?: string): Promise<RunpodGpuType[]> {
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
    query GpuTypes {
      gpuTypes {
        id
        displayName
        memoryInGb
        securePrice
        communityPrice
        secureSpotPrice
        communitySpotPrice
        lowestPrice(input: { gpuCount: 1 }) {
          minimumBidPrice
          uninterruptablePrice
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

  const rawGpus: any[] = json.data?.gpuTypes || [];
  const popularIds = [
    "NVIDIA GeForce RTX 4090",
    "NVIDIA RTX 4090",
    "NVIDIA RTX A6000",
    "NVIDIA A100 80GB PCIe",
    "NVIDIA A100-SXM4-80GB",
    "NVIDIA A40",
    "NVIDIA GeForce RTX 3090",
    "NVIDIA RTX 3090"
  ];

  const gpus: RunpodGpuType[] = rawGpus.map((gpu: any) => {
    const isPopular = popularIds.some(p => gpu.id.toLowerCase().includes(p.toLowerCase()) || gpu.displayName?.toLowerCase().includes(p.toLowerCase()));
    
    // Compute stock status heuristic based on prices and lowestPrice availability
    const hasCommunity = typeof gpu.communityPrice === "number" && gpu.communityPrice > 0;
    const hasSecure = typeof gpu.securePrice === "number" && gpu.securePrice > 0;
    const hasLowest = gpu.lowestPrice && (gpu.lowestPrice.uninterruptablePrice || gpu.lowestPrice.minimumBidPrice);
    
    let stockStatus: "HIGH" | "MEDIUM" | "LOW" | "OUT_OF_STOCK" | "AVAILABLE" = "OUT_OF_STOCK";
    if (hasLowest || hasCommunity || hasSecure) {
      stockStatus = "AVAILABLE";
    }

    return {
      id: gpu.id,
      displayName: gpu.displayName || gpu.id,
      memoryInGb: gpu.memoryInGb || 0,
      securePrice: gpu.securePrice,
      communityPrice: gpu.communityPrice,
      secureSpotPrice: gpu.secureSpotPrice,
      communitySpotPrice: gpu.communitySpotPrice,
      lowestPrice: gpu.lowestPrice ? {
        minimumBidPrice: gpu.lowestPrice.minimumBidPrice,
        uninterruptablePrice: gpu.lowestPrice.uninterruptablePrice
      } : undefined,
      stockStatus,
      isPopular
    };
  });

  // Sort by popular first, then VRAM descending, then name
  gpus.sort((a, b) => {
    if (a.isPopular && !b.isPopular) return -1;
    if (!a.isPopular && b.isPopular) return 1;
    if ((b.memoryInGb || 0) !== (a.memoryInGb || 0)) {
      return (b.memoryInGb || 0) - (a.memoryInGb || 0);
    }
    return a.displayName.localeCompare(b.displayName);
  });

  return gpus;
}

/**
 * Fetch pod templates from RunPod account & merge with curated templates
 */
export async function fetchRunpodTemplates(apiKey?: string): Promise<RunpodTemplateItem[]> {
  const effectiveKey = (apiKey && apiKey.trim()) || getStoredRunpodApiKey() || "";
  let userTemplates: RunpodTemplateItem[] = [];

  if (effectiveKey) {
    try {
      const cleanKey = effectiveKey.trim();
      const graphqlEndpoint = `https://api.runpod.io/graphql?api_key=${cleanKey}`;
      const query = `
        query MyPodTemplates {
          myself {
            podTemplates {
              id
              name
              imageName
              containerDiskInGb
              volumeInGb
              volumeMountPath
              ports
              env {
                key
                value
              }
              isServerless
              isPublic
              readme
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

      if (response.ok) {
        const json: any = await response.json();
        if (json.data?.myself?.podTemplates && Array.isArray(json.data.myself.podTemplates)) {
          userTemplates = json.data.myself.podTemplates
            .filter((t: any) => !t.isServerless)
            .map((t: any) => ({
              id: t.id,
              name: t.name || "Custom Template",
              imageName: t.imageName || "",
              containerDiskInGb: t.containerDiskInGb,
              volumeInGb: t.volumeInGb,
              volumeMountPath: t.volumeMountPath || "/workspace",
              ports: t.ports || "8188/http,22/tcp",
              env: t.env || [],
              isServerless: false,
              isPublic: t.isPublic,
              readme: t.readme,
              isCurated: false
            }));
        }
      }
    } catch (err) {
      log.warn("Could not query user podTemplates, returning curated list only", { error: err });
    }
  }

  // Combine curated presets with user templates
  return [...CURATED_COMFYUI_TEMPLATES, ...userTemplates];
}

/**
 * Fetch network volumes available in user's RunPod account
 */
export async function fetchRunpodNetworkVolumes(apiKey?: string): Promise<RunpodNetworkVolumeItem[]> {
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
    query MyNetworkVolumes {
      myself {
        networkVolumes {
          id
          name
          size
          dataCenterId
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

  const volumes: any[] = json.data?.myself?.networkVolumes || [];
  return volumes.map((v: any) => ({
    id: v.id,
    name: v.name || `Volume ${v.id}`,
    size: v.size || 0,
    dataCenterId: v.dataCenterId || ""
  }));
}

/**
 * Deploy a new Pod on RunPod on demand or spot
 */
export async function deployRunpodPod(apiKey: string | undefined, options: RunpodDeployOptions): Promise<any> {
  const effectiveKey = (apiKey && apiKey.trim()) || getStoredRunpodApiKey() || "";
  if (!effectiveKey) {
    throw new Error("RunPod API Key is required.");
  }
  if (apiKey && apiKey.trim()) {
    saveRunpodApiKey(apiKey.trim());
  }

  const cleanKey = effectiveKey.trim();
  const graphqlEndpoint = `https://api.runpod.io/graphql?api_key=${cleanKey}`;

  // Prepare environment variables list
  const envList: Array<{ key: string; value: string }> = [];
  if (options.env) {
    for (const [k, v] of Object.entries(options.env)) {
      if (k && v !== undefined && v !== null) {
        envList.push({ key: k, value: String(v) });
      }
    }
  }

  // Inject SSH public key automatically into container environment if provided
  if (options.publicKey && options.publicKey.trim()) {
    const hasKeyEnv = envList.some(e => e.key === "PUBLIC_KEY");
    if (!hasKeyEnv) {
      envList.push({ key: "PUBLIC_KEY", value: options.publicKey.trim() });
    }
  }

  // Resolve template / image details
  let imageName = options.imageName || "runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04";
  let templateId = options.templateId;
  let ports = options.ports || "8188/http,22/tcp";
  let volumeMountPath = options.volumeMountPath || "/workspace";

  // Check if templateId matches one of our curated templates
  const matchedCurated = CURATED_COMFYUI_TEMPLATES.find(t => t.id === options.templateId);
  if (matchedCurated) {
    imageName = matchedCurated.imageName;
    templateId = undefined; // Use direct image configuration for curated presets
    ports = matchedCurated.ports || ports;
    volumeMountPath = matchedCurated.volumeMountPath || volumeMountPath;
  }

  const inputPayload: Record<string, any> = {
    cloudType: options.cloudType || "ALL",
    gpuCount: options.gpuCount || 1,
    volumeInGb: typeof options.volumeInGb === "number" ? options.volumeInGb : 50,
    containerDiskInGb: typeof options.containerDiskInGb === "number" ? options.containerDiskInGb : 40,
    minVcpuCount: 2,
    minMemoryInGb: 16,
    gpuTypeId: options.gpuTypeId,
    name: options.name || `ComfyUI-${options.gpuTypeId.replace(/[^a-zA-Z0-9]/g, "-")}`,
    imageName,
    ports,
    volumeMountPath
  };

  if (templateId && !templateId.startsWith("curated-")) {
    inputPayload.templateId = templateId;
  }

  if (envList.length > 0) {
    inputPayload.env = envList;
  }

  if (options.networkVolumeId && options.networkVolumeId.trim()) {
    inputPayload.networkVolumeId = options.networkVolumeId.trim();
  }

  const mutation = `
    mutation DeployPod($input: PodFindAndDeployOnDemandInput!) {
      podFindAndDeployOnDemand(input: $input) {
        id
        name
        desiredStatus
        imageName
        costPerHr
        machine {
          gpuDisplayName
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
    body: JSON.stringify({
      query: mutation,
      variables: { input: inputPayload }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RunPod Deploy HTTP ${response.status}: ${errorText || response.statusText}`);
  }

  const json: any = await response.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(`RunPod Deployment Error: ${json.errors[0].message || JSON.stringify(json.errors)}`);
  }

  const deployedPod = json.data?.podFindAndDeployOnDemand;
  if (!deployedPod) {
    throw new Error("No pod returned from deployment request. The GPU might currently be out of stock in the chosen cloud type.");
  }

  return deployedPod;
}

/**
 * Start / Resume an existing paused pod
 */
export async function startRunpodPod(apiKey: string | undefined, podId: string, gpuCount: number = 1): Promise<any> {
  const effectiveKey = (apiKey && apiKey.trim()) || getStoredRunpodApiKey() || "";
  if (!effectiveKey) {
    throw new Error("RunPod API Key is required.");
  }
  if (!podId || !podId.trim()) {
    throw new Error("Pod ID is required.");
  }

  const cleanKey = effectiveKey.trim();
  const graphqlEndpoint = `https://api.runpod.io/graphql?api_key=${cleanKey}`;
  const mutation = `
    mutation ResumePod($input: PodResumeInput!) {
      podResume(input: $input) {
        id
        desiredStatus
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
      variables: { input: { podId: podId.trim(), gpuCount } }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RunPod Start HTTP ${response.status}: ${errorText || response.statusText}`);
  }

  const json: any = await response.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(`RunPod Resume Error: ${json.errors[0].message || JSON.stringify(json.errors)}`);
  }

  return json.data?.podResume;
}

/**
 * Stop / Pause an active running pod
 */
export async function stopRunpodPod(apiKey: string | undefined, podId: string): Promise<any> {
  const effectiveKey = (apiKey && apiKey.trim()) || getStoredRunpodApiKey() || "";
  if (!effectiveKey) {
    throw new Error("RunPod API Key is required.");
  }
  if (!podId || !podId.trim()) {
    throw new Error("Pod ID is required.");
  }

  const cleanKey = effectiveKey.trim();
  const graphqlEndpoint = `https://api.runpod.io/graphql?api_key=${cleanKey}`;
  const mutation = `
    mutation StopPod($input: PodStopInput!) {
      podStop(input: $input) {
        id
        desiredStatus
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
      variables: { input: { podId: podId.trim() } }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RunPod Stop HTTP ${response.status}: ${errorText || response.statusText}`);
  }

  const json: any = await response.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(`RunPod Stop Error: ${json.errors[0].message || JSON.stringify(json.errors)}`);
  }

  return json.data?.podStop;
}

/**
 * Terminate / Delete an existing pod
 */
export async function terminateRunpodPod(apiKey: string | undefined, podId: string): Promise<boolean> {
  const effectiveKey = (apiKey && apiKey.trim()) || getStoredRunpodApiKey() || "";
  if (!effectiveKey) {
    throw new Error("RunPod API Key is required.");
  }
  if (!podId || !podId.trim()) {
    throw new Error("Pod ID is required.");
  }

  const cleanKey = effectiveKey.trim();
  const graphqlEndpoint = `https://api.runpod.io/graphql?api_key=${cleanKey}`;
  const mutation = `
    mutation TerminatePod($input: PodTerminateInput!) {
      podTerminate(input: $input)
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
      variables: { input: { podId: podId.trim() } }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`RunPod Terminate HTTP ${response.status}: ${errorText || response.statusText}`);
  }

  const json: any = await response.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(`RunPod Terminate Error: ${json.errors[0].message || JSON.stringify(json.errors)}`);
  }

  return true;
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

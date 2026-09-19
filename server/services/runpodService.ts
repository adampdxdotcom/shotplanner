import nodeFetchModule from "node-fetch";

const getFetch = (): typeof fetch => {
  if (typeof globalThis.fetch === "function") {
    return globalThis.fetch as typeof fetch;
  }
  return ((nodeFetchModule as any).default || nodeFetchModule) as typeof fetch;
};

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
  memoryInGb?: number;
  vcpuCount?: number;
  ip?: string;
  sshPort?: number;
  comfyUrl?: string;
  proxyUrl?: string;
  ports?: RunpodPodPort[];
}

/**
 * Fetch list of active pods from RunPod GraphQL API
 */
export async function fetchRunpodPods(apiKey: string): Promise<RunpodPodItem[]> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("RunPod API Key is required.");
  }

  const cleanKey = apiKey.trim();
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
          gpuCount
          memoryInGb
          vcpuCount
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
      memoryInGb: pod.memoryInGb,
      vcpuCount: pod.vcpuCount,
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
export async function addSSHKeyToRunpodAccount(apiKey: string, publicKey: string): Promise<boolean> {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("RunPod API Key is required.");
  }
  if (!publicKey || !publicKey.trim()) {
    throw new Error("Public SSH Key is required.");
  }

  const cleanKey = apiKey.trim();
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

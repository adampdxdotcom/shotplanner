import React, { useState, useEffect } from "react";
import { AppConfig, RunpodGpuType, RunpodTemplateItem, RunpodNetworkVolumeItem, RunpodDeployOptions, RunpodCreateWatcherOptions } from "../../types";
import { settingsApi } from "../../api";
import {
  Cpu,
  RefreshCw,
  Zap,
  HardDrive,
  Box,
  DollarSign,
  Layers,
  Key,
  Database,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Filter,
  Check,
  ShieldCheck,
  Search,
  Radio,
  Clock
} from "lucide-react";

interface RunpodDeployPodPanelProps {
  apiKey: string;
  config: AppConfig;
  effectivePublicKey?: string;
  onDeploySuccess: (pod: any) => void;
  onWatcherCreated?: () => void;
  onShowToast?: (text: string, type: "success" | "error" | "info") => void;
  onCancel?: () => void;
}

export const RunpodDeployPodPanel: React.FC<RunpodDeployPodPanelProps> = ({
  apiKey,
  config,
  effectivePublicKey,
  onDeploySuccess,
  onWatcherCreated,
  onShowToast,
  onCancel
}) => {
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [gpus, setGpus] = useState<RunpodGpuType[]>([]);
  const [templates, setTemplates] = useState<RunpodTemplateItem[]>([]);
  const [networkVolumes, setNetworkVolumes] = useState<RunpodNetworkVolumeItem[]>([]);
  
  // Deployment Mode: Immediate deploy vs Queue watcher
  const [deployMode, setDeployMode] = useState<"immediate" | "watcher">("immediate");
  const [maxPricePerHour, setMaxPricePerHour] = useState<string>("");

  // Selection state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("curated-comfyui-official");
  const [customImageName, setCustomImageName] = useState<string>("");
  const [customPorts, setCustomPorts] = useState<string>("8188/http,22/tcp");
  
  const [selectedGpuId, setSelectedGpuId] = useState<string>("NVIDIA GeForce RTX 4090");
  const [cloudType, setCloudType] = useState<"COMMUNITY" | "SECURE" | "ALL">("ALL");
  const [vramFilter, setVramFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  
  // Storage settings
  const [containerDiskInGb, setContainerDiskInGb] = useState<number>(40);
  const [volumeInGb, setVolumeInGb] = useState<number>(50);
  const [selectedNetworkVolumeId, setSelectedNetworkVolumeId] = useState<string>("");
  
  // Deployment options
  const [podName, setPodName] = useState<string>("");
  const [autoInjectSSHKey, setAutoInjectSSHKey] = useState<boolean>(true);
  
  // Submission & Deployment state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deployStep, setDeployStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  // Load catalog on mount or when API key changes
  useEffect(() => {
    loadCatalog();
  }, [apiKey]);

  const loadCatalog = async (force: boolean = false) => {
    const keyToUse = apiKey.trim() || config.runpod_api_key?.trim() || "";
    if (!keyToUse) return;

    setIsLoadingCatalog(true);
    setError(null);

    try {
      const [gpuRes, tplRes, volRes] = await Promise.allSettled([
        settingsApi.getRunpodGpuTypes(keyToUse),
        settingsApi.getRunpodTemplates(keyToUse),
        settingsApi.getRunpodNetworkVolumes(keyToUse)
      ]);

      if (gpuRes.status === "fulfilled" && gpuRes.value?.success && Array.isArray(gpuRes.value.gpus)) {
        setGpus(gpuRes.value.gpus);
        const defaultGpu = gpuRes.value.gpus.find(g => 
          g.id.includes("4090") || g.displayName.includes("4090")
        ) || gpuRes.value.gpus[0];
        if (defaultGpu) {
          setSelectedGpuId(defaultGpu.id);
        }
      }

      if (tplRes.status === "fulfilled" && tplRes.value?.success && Array.isArray(tplRes.value.templates)) {
        setTemplates(tplRes.value.templates);
      }

      if (volRes.status === "fulfilled" && volRes.value?.success && Array.isArray(volRes.value.volumes)) {
        setNetworkVolumes(volRes.value.volumes);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load GPU and Template catalog.");
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const handleSelectTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const chosen = templates.find(t => t.id === tplId);
    if (chosen) {
      if (chosen.containerDiskInGb) setContainerDiskInGb(chosen.containerDiskInGb);
      if (chosen.volumeInGb) setVolumeInGb(chosen.volumeInGb);
      if (chosen.ports) setCustomPorts(chosen.ports);
      if (!podName || podName.startsWith("ComfyUI-") || podName.startsWith("Pod-")) {
        const shortGpu = selectedGpuId.replace(/NVIDIA (GeForce )?/i, "").replace(/\s+/g, "-");
        setPodName(`ComfyUI-${shortGpu}`);
      }
    }
  };

  const filteredGpus = gpus.filter((gpu) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesName = gpu.displayName.toLowerCase().includes(q) || gpu.id.toLowerCase().includes(q);
      if (!matchesName) return false;
    }
    if (vramFilter === "24") {
      return gpu.memoryInGb === 24;
    } else if (vramFilter === "48+") {
      return gpu.memoryInGb >= 48;
    } else if (vramFilter === "budget") {
      const price = gpu.communityPrice || gpu.lowestPrice?.uninterruptablePrice || 999;
      return price < 0.50;
    }
    return true;
  });

  const selectedGpu = gpus.find(g => g.id === selectedGpuId) || filteredGpus[0];

  const getDisplayPrice = (gpu?: RunpodGpuType): { price: string; note: string; numericPrice?: number } => {
    if (!gpu) return { price: "--", note: "" };
    if (cloudType === "COMMUNITY" && gpu.communityPrice) {
      return { price: `$${gpu.communityPrice.toFixed(2)}/hr`, note: "Community Cloud", numericPrice: gpu.communityPrice };
    }
    if (cloudType === "SECURE" && gpu.securePrice) {
      return { price: `$${gpu.securePrice.toFixed(2)}/hr`, note: "Secure Cloud", numericPrice: gpu.securePrice };
    }
    if (gpu.lowestPrice?.uninterruptablePrice) {
      return { price: `$${gpu.lowestPrice.uninterruptablePrice.toFixed(2)}/hr`, note: "Lowest On-Demand", numericPrice: gpu.lowestPrice.uninterruptablePrice };
    }
    if (gpu.communityPrice) {
      return { price: `$${gpu.communityPrice.toFixed(2)}/hr`, note: "Community Cloud", numericPrice: gpu.communityPrice };
    }
    if (gpu.securePrice) {
      return { price: `$${gpu.securePrice.toFixed(2)}/hr`, note: "Secure Cloud", numericPrice: gpu.securePrice };
    }
    return { price: "Dynamic", note: "On Demand" };
  };

  const handleSubmit = async () => {
    if (!selectedGpuId) {
      setError("Please select a GPU hardware type.");
      return;
    }

    const keyToUse = apiKey.trim() || config.runpod_api_key?.trim() || "";
    if (!keyToUse) {
      setError("RunPod API Key is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const pubKey = autoInjectSSHKey ? (effectivePublicKey || config.ssh_public_key || "").trim() : "";
    const name = podName.trim() || `ComfyUI-${selectedGpuId.replace(/[^a-zA-Z0-9]/g, "-")}`;
    const isCustomTemplate = selectedTemplateId === "custom";

    const deployPayload: RunpodDeployOptions = {
      gpuTypeId: selectedGpuId,
      name,
      cloudType,
      gpuCount: 1,
      volumeInGb,
      containerDiskInGb,
      volumeMountPath: "/workspace",
      ports: isCustomTemplate ? (customPorts || "8188/http,22/tcp") : "8188/http,22/tcp",
      publicKey: pubKey || undefined
    };

    if (isCustomTemplate) {
      deployPayload.imageName = customImageName.trim() || "runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04";
    } else {
      deployPayload.templateId = selectedTemplateId;
    }

    if (selectedNetworkVolumeId) {
      deployPayload.networkVolumeId = selectedNetworkVolumeId;
    }

    if (deployMode === "watcher") {
      // Create background auto-deploy queue watcher
      setDeployStep("Registering background auto-deploy queue watcher...");
      const numMaxPrice = maxPricePerHour ? parseFloat(maxPricePerHour) : undefined;

      try {
        const watcherPayload: RunpodCreateWatcherOptions & { runpod_api_key: string } = {
          runpod_api_key: keyToUse,
          gpuTypeId: selectedGpuId,
          gpuDisplayName: selectedGpu?.displayName || selectedGpuId,
          cloudType,
          maxPricePerHour: numMaxPrice && !isNaN(numMaxPrice) ? numMaxPrice : undefined,
          deployOptions: deployPayload
        };

        const res = await settingsApi.createRunpodWatcher(watcherPayload);
        if (res && res.success) {
          onShowToast?.(`Queue Watcher active for ${selectedGpu?.displayName || selectedGpuId}! Checking every 20s.`, "success");
          onWatcherCreated?.();
        } else {
          throw new Error(res?.error || "Failed to register queue watcher");
        }
      } catch (err: any) {
        setError(err.message || "Failed to register watcher.");
        onShowToast?.(err.message || "Failed to register watcher", "error");
      } finally {
        setIsSubmitting(false);
        setDeployStep("");
      }
      return;
    }

    // Immediate on-demand deployment
    setDeployStep("Requesting GPU allocation from RunPod...");
    try {
      setDeployStep("Provisioning container with PyTorch, CUDA & ComfyUI ports...");
      const res = await settingsApi.deployRunpodPod({
        ...deployPayload,
        runpod_api_key: keyToUse
      });

      if (res && res.success && res.pod) {
        setDeployStep("Pod reserved! Initializing network ports & bridge...");
        onShowToast?.(`Pod '${name}' deployed! Waiting for instance boot...`, "success");
        onDeploySuccess(res.pod);
      } else {
        throw new Error(res?.error || "Deployment returned an unsuccessful response.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to deploy pod. The selected GPU may currently be out of stock in this cloud tier.");
      onShowToast?.(err.message || "Pod deployment failed", "error");
    } finally {
      setIsSubmitting(false);
      setDeployStep("");
    }
  };

  return (
    <div className="bg-zinc-50/80 dark:bg-zinc-950/80 border border-blue-200/80 dark:border-blue-900/60 rounded-xl p-4 sm:p-5 space-y-5 shadow-xs transition-colors">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-600 text-white shadow-xs shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                Deploy New RunPod Instance
              </h4>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                ComfyUI Ready (Port 8188 &amp; 22)
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Provision an on-demand GPU pod or queue an automated watcher for out-of-stock GPUs.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadCatalog(true)}
            disabled={isLoadingCatalog}
            className="px-2.5 py-1.5 text-xs font-semibold bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="Refresh GPU catalog and templates"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCatalog ? "animate-spin text-blue-500" : ""}`} />
            <span>Refresh Catalog</span>
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-2.5 py-1.5 text-xs font-semibold bg-zinc-200/80 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Step 1: Template Selection */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
          <Box className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>1. Choose Pod Template</span>
        </label>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {templates.filter(t => t.isCurated).map((tpl) => {
            const isSelected = selectedTemplateId === tpl.id;
            return (
              <div
                key={tpl.id}
                onClick={() => handleSelectTemplate(tpl.id)}
                className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                  isSelected
                    ? "bg-blue-50/90 dark:bg-blue-950/40 border-blue-500 ring-1 ring-blue-500/50 shadow-xs"
                    : "bg-white dark:bg-zinc-900/80 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <div className="flex items-start justify-between gap-1 mb-1">
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    {tpl.name}
                  </span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-2 mb-2">
                  {tpl.description}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap text-[9px] font-mono text-zinc-500 dark:text-zinc-400">
                  <span className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
                    Disk: {tpl.containerDiskInGb}GB / Vol: {tpl.volumeInGb}GB
                  </span>
                  <span className="px-1 py-0.5 rounded bg-blue-100/60 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                    Ports: 8188 &amp; 22
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* User Account Templates Dropdown & Custom Option */}
        <div className="pt-1 flex flex-col sm:flex-row items-center gap-2">
          <select
            value={selectedTemplateId.startsWith("curated-") ? "" : selectedTemplateId}
            onChange={(e) => {
              if (e.target.value) {
                handleSelectTemplate(e.target.value);
              }
            }}
            className="w-full sm:flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:border-blue-500 font-mono"
          >
            <option value="">-- Or select from your RunPod account templates ({templates.filter(t => !t.isCurated).length}) --</option>
            {templates.filter(t => !t.isCurated).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.imageName.split("/").pop()})
              </option>
            ))}
            <option value="custom">-- Custom Docker Image &amp; Ports --</option>
          </select>
        </div>

        {selectedTemplateId === "custom" && (
          <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Docker Image Name</label>
              <input
                type="text"
                placeholder="runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04"
                value={customImageName}
                onChange={(e) => setCustomImageName(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-md px-2.5 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Exposed Ports</label>
              <input
                type="text"
                placeholder="8188/http,22/tcp"
                value={customPorts}
                onChange={(e) => setCustomPorts(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-md px-2.5 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Step 2: GPU Hardware & Pricing Catalog */}
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>2. Select GPU Hardware &amp; Cloud Tier</span>
          </label>
          <div className="flex items-center gap-1.5">
            <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-0.5 text-[10px] font-semibold">
              <button
                type="button"
                onClick={() => setCloudType("ALL")}
                className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                  cloudType === "ALL"
                    ? "bg-blue-600 text-white"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                All Clouds
              </button>
              <button
                type="button"
                onClick={() => setCloudType("COMMUNITY")}
                className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                  cloudType === "COMMUNITY"
                    ? "bg-blue-600 text-white"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                Community (Lowest $)
              </button>
              <button
                type="button"
                onClick={() => setCloudType("SECURE")}
                className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                  cloudType === "SECURE"
                    ? "bg-blue-600 text-white"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
                }`}
              >
                Secure Cloud (Tier 3 DC)
              </button>
            </div>
          </div>
        </div>

        {/* Filters & Search row */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative w-full sm:flex-1">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search GPU model (e.g. 4090, A6000, A100)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500"
            />
          </div>
          <div className="flex items-center gap-1 shrink-0 w-full sm:w-auto">
            {["all", "24", "48+", "budget"].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVramFilter(v)}
                className={`flex-1 sm:flex-none px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer border ${
                  vramFilter === v
                    ? "bg-zinc-800 text-white dark:bg-zinc-100 dark:text-zinc-900 border-zinc-800 dark:border-zinc-100"
                    : "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50"
                }`}
              >
                {v === "all" ? "All VRAM" : v === "24" ? "24GB VRAM" : v === "48+" ? "48GB+ VRAM" : "< $0.50/hr"}
              </button>
            ))}
          </div>
        </div>

        {/* GPU Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2 bg-white/60 dark:bg-zinc-900/60">
          {filteredGpus.map((gpu) => {
            const isSelected = selectedGpuId === gpu.id;
            const priceInfo = getDisplayPrice(gpu);
            const isAvailable = gpu.stockStatus !== "OUT_OF_STOCK";

            return (
              <div
                key={gpu.id}
                onClick={() => setSelectedGpuId(gpu.id)}
                className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? "bg-blue-50/90 dark:bg-blue-950/50 border-blue-500 ring-1 ring-blue-500/50"
                    : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
                }`}
              >
                <div className="flex items-start justify-between gap-1 mb-1.5">
                  <div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block truncate" title={gpu.displayName}>
                      {gpu.displayName}
                    </span>
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                      {gpu.memoryInGb} GB VRAM
                    </span>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                    isAvailable
                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  }`}>
                    {isAvailable ? "In Stock" : "Scarce / Queue"}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800/80 text-[10px] font-mono">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center">
                    <DollarSign className="w-3 h-3 -mr-0.5" />
                    {priceInfo.price}
                  </span>
                  <span className="text-[9px] text-zinc-400">
                    {priceInfo.note}
                  </span>
                </div>
              </div>
            );
          })}
          {filteredGpus.length === 0 && (
            <div className="col-span-full py-6 text-center text-xs text-zinc-400 font-medium">
              No GPUs match your filter criteria. Try clearing the search or filter.
            </div>
          )}
        </div>
      </div>

      {/* Step 3: Storage & Network Volumes */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
          <HardDrive className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>3. Disk Storage &amp; Network Volumes</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
            <div>
              <div className="flex justify-between text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                <span>Container Disk (Root OS &amp; Deps)</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">{containerDiskInGb} GB</span>
              </div>
              <input
                type="range"
                min="20"
                max="100"
                step="5"
                value={containerDiskInGb}
                onChange={(e) => setContainerDiskInGb(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-[11px] font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                <span>Persistent Pod Volume (/workspace)</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">{volumeInGb} GB</span>
              </div>
              <input
                type="range"
                min="20"
                max="250"
                step="10"
                value={volumeInGb}
                onChange={(e) => setVolumeInGb(Number(e.target.value))}
                className="w-full accent-blue-600 cursor-pointer"
              />
            </div>
          </div>

          <div className="p-3 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2 flex flex-col justify-between">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                <Database className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Attach Network Volume (Optional)</span>
              </label>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
                Attach a shared RunPod storage volume to immediately access existing checkpoints and LoRAs.
              </p>
            </div>

            <select
              value={selectedNetworkVolumeId}
              onChange={(e) => setSelectedNetworkVolumeId(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 outline-none focus:border-blue-500 font-mono"
            >
              <option value="">None (Use standalone pod volume)</option>
              {networkVolumes.map((nv) => (
                <option key={nv.id} value={nv.id}>
                  {nv.name} ({nv.size} GB - DC: {nv.dataCenterId})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Step 4: Mode Selection - Immediate Deploy vs Queue Watcher */}
      <div className="p-3.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
        <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span>4. Deployment Strategy</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div
            onClick={() => setDeployMode("immediate")}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
              deployMode === "immediate"
                ? "bg-blue-50/90 dark:bg-blue-950/40 border-blue-500 ring-1 ring-blue-500/50"
                : "bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Deploy Immediately</span>
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              Allocates GPU instantly. Fails if the selected GPU tier is currently out of stock.
            </p>
          </div>

          <div
            onClick={() => setDeployMode("watcher")}
            className={`p-2.5 rounded-lg border cursor-pointer transition-all ${
              deployMode === "watcher"
                ? "bg-blue-50/90 dark:bg-blue-950/40 border-blue-500 ring-1 ring-blue-500/50"
                : "bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <Radio className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Auto-Deploy Queue Watcher</span>
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">
              Monitors RunPod stock every 20s in background and automatically claims the GPU the second it is freed.
            </p>
          </div>
        </div>

        {deployMode === "watcher" && (
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 flex flex-col sm:flex-row items-center gap-3">
            <div className="w-full sm:w-64 space-y-1">
              <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                <span>Max Price Cap (Optional)</span>
              </label>
              <input
                type="number"
                step="0.05"
                placeholder="e.g. 0.44 (Max $/hr)"
                value={maxPricePerHour}
                onChange={(e) => setMaxPricePerHour(e.target.value)}
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-md px-2.5 py-1.5 text-xs font-mono text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500"
              />
            </div>
            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 pt-3">
              Leave blank to accept any listed price for this GPU, or set a cap to wait for low-cost community hosts.
            </p>
          </div>
        )}
      </div>

      {/* Step 5: Pod Name & Auto SSH Injection */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
        <div className="sm:col-span-6 space-y-1">
          <label className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
            Pod Display Name
          </label>
          <input
            type="text"
            placeholder={selectedGpu ? `ComfyUI-${selectedGpu.displayName.replace(/[^a-zA-Z0-9]/g, "-")}` : "ComfyUI-Instance"}
            value={podName}
            onChange={(e) => setPodName(e.target.value)}
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500"
          />
        </div>

        <div className="sm:col-span-6 flex flex-col justify-end pb-1">
          <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoInjectSSHKey}
              onChange={(e) => setAutoInjectSSHKey(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <span className="flex items-center gap-1">
              <Key className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>Auto-inject SSH Public Key for passwordless access</span>
            </span>
          </label>
        </div>
      </div>

      {/* Feedback / Error notifications */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-xs text-red-800 dark:text-red-300 flex items-start gap-2.5 font-medium shadow-2xs">
          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">Deployment Error</p>
            <p className="text-[11px] opacity-90">{error}</p>
          </div>
        </div>
      )}

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">Target Cost:</span>
          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold font-mono">
            {getDisplayPrice(selectedGpu).price}
          </span>
          <span className="text-[10px] text-zinc-400">
            {deployMode === "watcher" ? "(Will deploy when in stock)" : "(Billed per second while active)"}
          </span>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting || !selectedGpuId}
          className={`w-full sm:w-auto px-5 py-2.5 text-xs font-bold text-white rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shrink-0 ${
            deployMode === "watcher"
              ? "bg-emerald-600 hover:bg-emerald-500"
              : "bg-blue-600 hover:bg-blue-500"
          } disabled:opacity-50`}
        >
          {isSubmitting ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{deployStep || "Submitting..."}</span>
            </>
          ) : deployMode === "watcher" ? (
            <>
              <Radio className="w-4 h-4" />
              <span>Start Auto-Deploy Watcher</span>
            </>
          ) : (
            <>
              <Zap className="w-4 h-4" />
              <span>Deploy &amp; Connect Pod</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

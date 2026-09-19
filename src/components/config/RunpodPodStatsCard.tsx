import React from "react";
import { RunpodPodItem } from "../../types";
import { Cpu, HardDrive, Clock, DollarSign, Terminal, Globe, Box, Server, CheckCircle2 } from "lucide-react";

interface RunpodPodStatsCardProps {
  pod: RunpodPodItem;
  isConnected?: boolean;
}

function formatUptime(seconds?: number): string {
  if (!seconds || seconds <= 0) return "Just started";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

export const RunpodPodStatsCard: React.FC<RunpodPodStatsCardProps> = ({ pod, isConnected }) => {
  const gpuLabel = pod.gpuDisplayName || (pod.gpuCount ? `${pod.gpuCount}x GPU` : "GPU Instance");
  const isRunning = pod.desiredStatus === "RUNNING";

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-zinc-900 dark:text-zinc-100 space-y-3.5 shadow-xs transition-colors">
      {/* Pod Header & Main Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-blue-100/80 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 shrink-0">
            <Server className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{pod.name}</h4>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                isRunning
                  ? "bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/60"
                  : "bg-amber-100/80 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 dark:border-amber-800/60"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isRunning ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></span>
                {pod.desiredStatus}
              </span>
              {isConnected && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100/80 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 dark:border-blue-800/60">
                  <CheckCircle2 className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                  Connected
                </span>
              )}
            </div>
            <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
              ID: {pod.id}
            </p>
          </div>
        </div>

        {/* Cost & Uptime Badges */}
        <div className="flex items-center gap-2 text-xs font-mono shrink-0">
          {pod.costPerHr !== undefined && pod.costPerHr > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700/60 text-emerald-700 dark:text-emerald-400 font-semibold">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>${pod.costPerHr.toFixed(2)} / hr</span>
            </div>
          )}

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-200/70 dark:bg-zinc-800/80 border border-zinc-300 dark:border-zinc-700/60 text-zinc-700 dark:text-zinc-300">
            <Clock className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>{formatUptime(pod.uptimeInSeconds)}</span>
          </div>
        </div>
      </div>

      {/* Hardware Specifications Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* GPU */}
        <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
            <Cpu className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            GPU Hardware
          </span>
          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block truncate" title={gpuLabel}>
            {gpuLabel}
          </span>
        </div>

        {/* CPU & Memory */}
        <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
            <Server className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
            vCPU &amp; RAM
          </span>
          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
            {pod.vcpuCount ? `${pod.vcpuCount} vCPUs` : "N/A"} • {pod.memoryInGb ? `${pod.memoryInGb} GB RAM` : "N/A"}
          </span>
        </div>

        {/* Disk & Storage */}
        <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
            <HardDrive className="w-3 h-3 text-teal-600 dark:text-teal-400" />
            Storage Allocation
          </span>
          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
            Disk: {pod.containerDiskInGb || 0} GB • Vol: {pod.volumeInGb || 0} GB
          </span>
        </div>

        {/* Template Image */}
        <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200/80 dark:border-zinc-800/80 space-y-1">
          <span className="text-[10px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
            <Box className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            Container Template
          </span>
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 block truncate font-mono" title={pod.imageName || "Default Image"}>
            {pod.imageName ? pod.imageName.split("/").pop() || pod.imageName : "Standard Pod"}
          </span>
        </div>
      </div>

      {/* Network & Endpoints bar */}
      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800/80 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
        <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800/60">
          <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            SSH Endpoint:
          </span>
          <span className="text-blue-600 dark:text-blue-300 font-bold">
            {pod.ip ? `${pod.ip}:${pod.sshPort || 22}` : "Resolving..."}
          </span>
        </div>

        <div className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800/60">
          <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Globe className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            ComfyUI API:
          </span>
          <span className="text-teal-600 dark:text-teal-300 font-bold truncate max-w-[200px]" title={pod.comfyUrl}>
            {pod.comfyUrl || "Not mapped"}
          </span>
        </div>
      </div>

      {/* Mapped Ports List */}
      {pod.ports && pod.ports.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-1 text-[10px] font-mono">
          <span className="text-zinc-500 dark:text-zinc-400">Mapped Ports:</span>
          {pod.ports.map((p, idx) => (
            <span key={idx} className="px-1.5 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800/80 text-zinc-800 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700/60">
              {p.privatePort} → {p.publicPort} ({p.type})
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

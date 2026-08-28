import React from "react";
import { ToastMessage } from "../types";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { 
  Server, 
  Workflow, 
  Cpu, 
  HardDrive,
  Sparkles,
  Save,
  FolderOpen
} from "lucide-react";

interface NavbarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  toasts?: ToastMessage[];
  onDismissToast?: (id: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeSection, onNavigate, onSaveProject, onLoadProject, toasts = [], onDismissToast }) => {
  return (
    <header className="sticky top-0 z-40 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 px-4 lg:px-8 py-3.5 flex items-start justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-inner">
          <Workflow className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight text-zinc-100">
              ComfyUI Bridge &amp; Orchestrator
            </h1>
            <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
              v1.0 Ready
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Local Assets ⇄ LM Studio Prompt Expansion ⇄ RunPod ComfyUI
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <nav className="hidden md:flex items-center gap-1 bg-zinc-950/60 p-1 rounded-lg border-2 border-zinc-700/80">
          <button
            onClick={() => onNavigate("assets")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeSection === "assets" 
                ? "bg-zinc-800 text-zinc-100 shadow-xs" 
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
          <HardDrive className="w-3.5 h-3.5" />
          1. Assets
        </button>
        <button
          onClick={() => onNavigate("workflow")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
            activeSection === "workflow" 
              ? "bg-zinc-800 text-zinc-100 shadow-xs" 
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Workflow className="w-3.5 h-3.5" />
          2. Workflow &amp; Map
        </button>
        <button
          onClick={() => onNavigate("llm")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
            activeSection === "llm" 
              ? "bg-zinc-800 text-zinc-100 shadow-xs" 
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          3. Prompt LLM
        </button>
        <button
          onClick={() => onNavigate("execute")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
            activeSection === "execute" 
              ? "bg-indigo-600 text-white shadow-xs" 
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          4. Execute
        </button>
      </nav>

      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate("config")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all flex items-center gap-1.5 shadow-xs ${
              activeSection === "config" 
                ? "bg-zinc-800 border-zinc-600 text-white" 
                : "bg-zinc-800/80 border-zinc-700/80 text-zinc-300 hover:bg-zinc-700 hover:text-white"
            }`}
            title="Server Configuration"
          >
            <Server className="w-3.5 h-3.5" />
            <span>Config</span>
          </button>
          <button
            onClick={onLoadProject}
            className="px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800/80 hover:bg-zinc-700 hover:text-white rounded-lg border border-zinc-700/80 transition-all flex items-center gap-1.5 shadow-xs"
            title="Load Project"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Load</span>
          </button>
          <button
            onClick={onSaveProject}
            className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-xs transition-all flex items-center gap-1.5"
            title="Save Project"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
        </div>
        
        {/* Toast Messages Area underneath buttons */}
        {toasts.length > 0 && (
          <div className="flex flex-col items-end gap-2 mt-1 w-full max-w-sm">
            {toasts.map((toast) => (
              <div 
                key={toast.id}
                className={`flex items-start gap-2 w-full p-2.5 rounded-lg border shadow-sm transition-all ${
                  toast.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                  toast.type === "error" ? "bg-red-500/10 border-red-500/20 text-red-400" :
                  "bg-blue-500/10 border-blue-500/20 text-blue-400"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {toast.type === "success" && <CheckCircle2 className="w-4 h-4" />}
                  {toast.type === "error" && <AlertCircle className="w-4 h-4" />}
                  {toast.type === "info" && <Info className="w-4 h-4" />}
                </div>
                <p className="text-xs flex-1 leading-relaxed break-words">{toast.text}</p>
                {onDismissToast && (
                  <button 
                    onClick={() => onDismissToast(toast.id)}
                    className="shrink-0 p-0.5 hover:bg-black/20 rounded transition-colors"
                  >
                    <X className="w-3.5 h-3.5 opacity-70 hover:opacity-100" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </header>
  );
};

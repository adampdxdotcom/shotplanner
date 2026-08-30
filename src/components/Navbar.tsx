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
  FolderOpen,
  Plus
} from "lucide-react";

interface NavbarProps {
  activeSection: string;
  onNavigate: (section: string) => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onNewProject?: () => void;
  toasts?: ToastMessage[];
  onDismissToast?: (id: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeSection, onNavigate, onSaveProject, onLoadProject, onNewProject, toasts = [], onDismissToast }) => {
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
            Local Assets ⇄ LM Studio Prompt Expansion ⇄ Remote ComfyUI
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <nav className="hidden md:flex items-center gap-1 bg-zinc-950/60 p-1 rounded-lg border-2 border-zinc-700/80">
          <button
            onClick={() => onNavigate("scene")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeSection === "scene" 
                ? "bg-zinc-800 text-zinc-100 shadow-xs" 
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            Scene Hub
          </button>
          <button
            onClick={() => onNavigate("assets")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeSection === "assets" 
                ? "bg-zinc-800 text-zinc-100 shadow-xs" 
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
          <HardDrive className="w-3.5 h-3.5" />
          Assets
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
          Workflow
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
          Prompt
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
          Upload
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
          {onNewProject && (
            <button
              onClick={onNewProject}
              className="px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800/80 hover:bg-zinc-700 hover:text-white rounded-lg border border-zinc-700/80 transition-all flex items-center gap-1.5 shadow-xs"
              title="New Scene"
            >
              <Plus className="w-3.5 h-3.5 text-amber-500" />
              <span>New</span>
            </button>
          )}
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
        
        {/* Toast Messages Floating Overlay */}
        {toasts.length > 0 && (
          <div className="fixed top-16 right-4 z-50 flex flex-col items-end gap-2 max-w-sm w-full pointer-events-auto">
            {toasts.map((toast) => (
              <div 
                key={toast.id}
                className={`flex items-start gap-2.5 w-full p-3 rounded-xl border shadow-xl backdrop-blur-md transition-all animate-in slide-in-from-top-2 duration-200 ${
                  toast.type === "success" ? "bg-zinc-900/95 border-emerald-500/50 text-emerald-300 shadow-emerald-950/40" :
                  toast.type === "error" ? "bg-zinc-900/95 border-red-500/50 text-red-300 shadow-red-950/40" :
                  "bg-zinc-900/95 border-indigo-500/50 text-indigo-300 shadow-indigo-950/40"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {toast.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                  {toast.type === "error" && <AlertCircle className="w-4 h-4 text-red-400" />}
                  {toast.type === "info" && <Info className="w-4 h-4 text-indigo-400" />}
                </div>
                <p className="text-xs font-medium flex-1 leading-relaxed break-words text-zinc-100">{toast.text}</p>
                {onDismissToast && (
                  <button 
                    onClick={() => onDismissToast(toast.id)}
                    className="shrink-0 p-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
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

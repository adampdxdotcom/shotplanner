import React from "react";
import { ToastMessage } from "../types";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { 
  Server, 
  Workflow, 
  Cpu, 
  HardDrive,
  Sparkles,
  Save,
  FolderOpen,
  Plus,
  Image,
  Film
} from "lucide-react";

interface NavbarProps {
  projectName?: string;
  isDirty?: boolean;
  activeSection: string;
  onNavigate: (section: string) => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onNewProject?: () => void;
  toasts?: ToastMessage[];
  onDismissToast?: (id: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ 
  projectName = "Untitled Project",
  isDirty = false,
  activeSection, 
  onNavigate, 
  onSaveProject, 
  onLoadProject, 
  onNewProject, 
  toasts = [], 
  onDismissToast 
}) => {
  const activeToast = toasts && toasts.length > 0 ? toasts[0] : null;

  return (
    <header className="sticky top-0 z-40 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 px-4 lg:px-8 py-3.5 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-inner shrink-0">
          <Workflow className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
            {projectName || "Untitled Project"}
            {isDirty && <span className="text-xs text-amber-400 font-normal opacity-75">(Unsaved)</span>}
          </h1>
          
          {/* Toast / Status Area Below Project Name - Single active toast with smooth transition */}
          <div className="relative min-h-[20px] flex items-center mt-0.5 pointer-events-auto max-w-sm sm:max-w-md">
            <AnimatePresence mode="wait">
              {!activeToast ? (
                <motion.div 
                  key="default-title"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="text-[10px] font-bold text-amber-500 uppercase tracking-wider"
                >
                  SHOT PLANNER
                </motion.div>
              ) : (
                <motion.div 
                  key={activeToast.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className={`flex items-center gap-2 px-2 py-0.5 rounded border backdrop-blur-md shadow-xs ${
                    activeToast.type === "success" ? "bg-zinc-900/95 border-emerald-500/50 text-emerald-300" :
                    activeToast.type === "error" ? "bg-zinc-900/95 border-red-500/50 text-red-300" :
                    "bg-zinc-900/95 border-indigo-500/50 text-indigo-300"
                  }`}
                >
                  <div className="shrink-0">
                    {activeToast.type === "success" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                    {activeToast.type === "error" && <AlertCircle className="w-3.5 h-3.5 text-red-400" />}
                    {activeToast.type === "info" && <Info className="w-3.5 h-3.5 text-indigo-400" />}
                  </div>
                  <p className="text-[10px] font-medium leading-normal text-zinc-200 truncate max-w-[220px] sm:max-w-[300px]">
                    {activeToast.text}
                  </p>
                  {onDismissToast && (
                    <button 
                      onClick={() => onDismissToast(activeToast.id)}
                      className="shrink-0 p-0.5 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded transition-colors cursor-pointer ml-1"
                      title="Dismiss notification"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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
            <Film className="w-3.5 h-3.5" />
            Shots
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
        <button
          onClick={() => onNavigate("gallery")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
            activeSection === "gallery" 
              ? "bg-zinc-800 text-zinc-100 shadow-xs border border-zinc-700" 
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Image className="w-3.5 h-3.5 text-amber-400" />
          Gallery
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
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg shadow-xs transition-all flex items-center gap-1.5 border cursor-pointer ${
              isDirty
                ? "bg-amber-600 hover:bg-amber-500 text-white border-amber-500/80 shadow-amber-950/30"
                : "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/80 shadow-emerald-950/30"
            }`}
            title={isDirty ? "Unsaved changes — Click to Save" : "All changes saved — Up to date"}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
        </div>
      </div>
      </div>
    </header>
  );
};

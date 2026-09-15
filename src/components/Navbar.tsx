import React, { useState, useRef, useEffect } from "react";
import { ToastMessage } from "../types";
import { ComfyMonitorState } from "../hooks/useComfyMonitor";
import { CheckCircle2, AlertCircle, Info, X, Sun, Moon, ChevronDown, Radio, Activity } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTheme } from "../context/ThemeContext";
import { 
  Server, 
  Workflow, 
  Cpu, 
  Sparkles,
  Save,
  FolderOpen,
  Plus,
  Image,
  Film,
  Users,
  Layers
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
  monitorState?: ComfyMonitorState;
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
  onDismissToast,
  monitorState
}) => {
  const activeToast = toasts && toasts.length > 0 ? toasts[0] : null;
  const { resolvedTheme, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMenuOpen]);

  return (
    <header className="sticky top-0 z-40 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 px-4 lg:px-8 py-3.5 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center shadow-inner shrink-0">
          <Workflow className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col">
          <h1 className="text-base font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
            {projectName || "Untitled Project"}
            {isDirty && <span className="text-xs text-amber-600 dark:text-amber-400 font-normal opacity-90">(Unsaved)</span>}
          </h1>
          
          {/* Toast & ComfyUI Status Area Below Project Name */}
          <div className="relative min-h-[20px] flex items-center gap-2 mt-0.5 pointer-events-auto max-w-sm sm:max-w-md">
            {/* ComfyUI HUD Status Badge */}
            {monitorState && monitorState.isConnected && (
              <div 
                id="comfy-monitor-hud"
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium border shrink-0 select-none transition-all ${
                  monitorState.isExecuting
                    ? "bg-amber-500/15 text-amber-500 border-amber-500/40 shadow-xs shadow-amber-500/10"
                    : monitorState.queueRemaining > 0
                    ? "bg-sky-500/15 text-sky-400 border-sky-500/40"
                    : "bg-zinc-800/80 text-zinc-400 border-zinc-700/60"
                }`}
                title={
                  monitorState.isExecuting
                    ? `Generating: ${monitorState.maxSteps > 0 ? `Step ${monitorState.currentStep}/${monitorState.maxSteps}` : 'Executing'}`
                    : monitorState.queueRemaining > 0
                    ? `Queue: ${monitorState.queueRemaining} items`
                    : "ComfyUI Connected & Idle"
                }
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  monitorState.isExecuting
                    ? "bg-amber-400 animate-pulse"
                    : monitorState.queueRemaining > 0
                    ? "bg-sky-400 animate-pulse"
                    : "bg-emerald-500"
                }`} />
                <span className="font-semibold uppercase tracking-wider">
                  {monitorState.isExecuting ? (
                    <span>
                      Generating{" "}
                      <span className="font-mono text-[9px] lowercase opacity-90">
                        (Node: {monitorState.activeNodeName || 'KSampler'} {monitorState.maxSteps > 0 ? `${Math.round((monitorState.currentStep / monitorState.maxSteps) * 100)}%` : ''})
                      </span>
                    </span>
                  ) : monitorState.queueRemaining > 0 ? (
                    <span>Queued ({monitorState.queueRemaining})</span>
                  ) : (
                    <span>Idle</span>
                  )}
                </span>
              </div>
            )}

            <AnimatePresence mode="wait">
              {!activeToast ? (
                <motion.div 
                  key="default-title"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider"
                >
                  SHOT PLANNER
                </motion.div>
              ) : (
                <motion.div 
                  key={activeToast.id}
                  id="navbar-toast-pill"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  className={`navbar-toast flex items-center gap-2 px-2.5 py-0.5 rounded-md border shadow-xs backdrop-blur-md transition-colors ${
                    activeToast.type === "success" 
                      ? "bg-emerald-50 border-emerald-300 text-emerald-950 dark:bg-zinc-900/95 dark:border-emerald-500/50 dark:text-emerald-300" :
                    activeToast.type === "error" 
                      ? "bg-red-50 border-red-300 text-red-950 dark:bg-zinc-900/95 dark:border-red-500/50 dark:text-red-300" :
                      "bg-indigo-50 border-indigo-200 text-indigo-950 dark:bg-zinc-900/95 dark:border-indigo-500/50 dark:text-indigo-300"
                  }`}
                >
                  <div className="shrink-0">
                    {activeToast.type === "success" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                    {activeToast.type === "error" && <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />}
                    {activeToast.type === "info" && <Info className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />}
                  </div>
                  <p className="navbar-toast-text text-[11px] font-medium leading-normal text-zinc-900 dark:text-zinc-100 truncate max-w-[220px] sm:max-w-[320px]">
                    {activeToast.text}
                  </p>
                  {onDismissToast && (
                    <button 
                      type="button"
                      onClick={() => onDismissToast(activeToast.id)}
                      className="navbar-toast-close shrink-0 p-0.5 text-zinc-500 hover:text-zinc-900 hover:bg-black/5 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800 rounded transition-colors cursor-pointer ml-1"
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
            Scenes
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
                ? "bg-zinc-800 text-zinc-100 shadow-xs" 
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-indigo-400" />
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
          <button
            onClick={() => onNavigate("staging")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeSection === "staging" 
                ? "bg-zinc-800 text-zinc-100 shadow-xs" 
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            Assets
          </button>
          <button
            onClick={() => onNavigate("cast")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
              activeSection === "cast" 
                ? "bg-zinc-800 text-zinc-100 shadow-xs" 
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            Cast
          </button>
        </nav>

        {/* Unified Project Dropdown Menu */}
        <div className="relative" ref={menuRef}>
          <button
            id="navbar-project-menu-btn"
            type="button"
            onClick={() => setIsMenuOpen(prev => !prev)}
            className={`navbar-project-btn px-3 py-1.5 text-xs font-semibold rounded-lg shadow-xs transition-all flex items-center gap-2 border cursor-pointer ${
              isDirty
                ? "is-dirty bg-amber-600 hover:bg-amber-500 text-white border-amber-500/80 shadow-amber-950/30"
                : "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500/80 shadow-emerald-950/30"
            }`}
            title={isDirty ? "Project Menu — Unsaved changes (Yellow)" : "Project Menu — All changes saved (Green)"}
            aria-expanded={isMenuOpen}
            aria-haspopup="true"
          >
            <div className="flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5 text-white" />
              <span className="text-white font-semibold">Project</span>
              {isDirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
              )}
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-white/90 transition-transform duration-150 ${isMenuOpen ? "rotate-180" : ""}`} />
          </button>

          <AnimatePresence>
            {isMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="navbar-project-dropdown absolute right-0 mt-2 w-56 bg-white/98 text-slate-900 border border-slate-200 rounded-xl shadow-xl py-1.5 z-50 overflow-hidden backdrop-blur-md dark:bg-zinc-900/98 dark:text-zinc-100 dark:border-zinc-700/90"
              >
                {/* File / Project Actions */}
                <div className="dropdown-section-title px-3 py-1 text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Scene File
                </div>

                {onNewProject && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onNewProject();
                    }}
                    className="dropdown-item-btn w-full px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-950 hover:bg-slate-100 dark:text-zinc-200 dark:hover:text-white dark:hover:bg-zinc-800/80 flex items-center gap-2.5 transition-colors text-left cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                    <span>New Scene</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onLoadProject();
                  }}
                  className="dropdown-item-btn w-full px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-950 hover:bg-slate-100 dark:text-zinc-200 dark:hover:text-white dark:hover:bg-zinc-800/80 flex items-center gap-2.5 transition-colors text-left cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>Load Scene...</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onSaveProject();
                  }}
                  className="dropdown-item-btn w-full px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-950 hover:bg-slate-100 dark:text-zinc-200 dark:hover:text-white dark:hover:bg-zinc-800/80 flex items-center justify-between transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Save className={`w-3.5 h-3.5 shrink-0 ${isDirty ? "text-amber-500 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`} />
                    <span>Save Scene</span>
                  </div>
                  {isDirty && (
                    <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 dark:text-amber-400 dark:bg-amber-950/60 dark:border-amber-800/60 px-1.5 py-0.5 rounded">
                      Unsaved
                    </span>
                  )}
                </button>

                {/* Workspace / Settings Divider */}
                <div className="dropdown-divider h-px bg-slate-200 dark:bg-zinc-800 my-1.5 mx-2" />

                <div className="dropdown-section-title px-3 py-1 text-[10px] font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Workspace
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onNavigate("config");
                  }}
                  className={`dropdown-item-btn w-full px-3 py-2 text-xs font-medium flex items-center gap-2.5 transition-colors text-left cursor-pointer ${
                    activeSection === "config"
                      ? "bg-slate-200/90 text-slate-950 dark:bg-zinc-800 dark:text-white font-semibold"
                      : "text-slate-700 hover:text-slate-950 hover:bg-slate-100 dark:text-zinc-200 dark:hover:text-white dark:hover:bg-zinc-800/80"
                  }`}
                >
                  <Server className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span>Server Configuration</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    toggleTheme();
                  }}
                  className="dropdown-item-btn w-full px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-950 hover:bg-slate-100 dark:text-zinc-200 dark:hover:text-white dark:hover:bg-zinc-800/80 flex items-center justify-between transition-colors text-left cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    {resolvedTheme === "dark" ? (
                      <Sun className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                    ) : (
                      <Moon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                    )}
                    <span>Appearance</span>
                  </div>
                  <span className="text-[10px] font-medium text-slate-600 dark:text-zinc-300 capitalize bg-slate-100 dark:bg-zinc-800/80 border border-slate-200 dark:border-zinc-700/60 px-1.5 py-0.5 rounded">
                    {resolvedTheme}
                  </span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

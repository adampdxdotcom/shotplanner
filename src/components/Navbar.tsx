import React from "react";
import { 
  Server, 
  Workflow, 
  Cpu, 
  FileCode2, 
  HardDrive,
  Sparkles
} from "lucide-react";

interface NavbarProps {
  onOpenCodeViewer: () => void;
  activeSection: string;
  onNavigate: (section: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenCodeViewer, activeSection, onNavigate }) => {
  return (
    <header className="sticky top-0 z-40 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 px-4 lg:px-8 py-3.5 flex items-center justify-between shadow-sm">
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

      <nav className="hidden md:flex items-center gap-1 bg-zinc-950/60 p-1 rounded-lg border border-zinc-800/80">
        <button
          onClick={() => onNavigate("config")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
            activeSection === "config" 
              ? "bg-zinc-800 text-zinc-100 shadow-xs" 
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          1. Config
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
          onClick={() => onNavigate("assets")}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 ${
            activeSection === "assets" 
              ? "bg-zinc-800 text-zinc-100 shadow-xs" 
              : "text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" />
          3. Assets
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
          4. Prompt LLM
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
          5. Execute
        </button>
      </nav>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenCodeViewer}
          className="px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-white rounded-lg border border-zinc-700 transition-all flex items-center gap-1.5 shadow-xs"
          title="View Python FastAPI & Docker files"
        >
          <FileCode2 className="w-3.5 h-3.5 text-indigo-400" />
          <span>Backend &amp; Docker Code</span>
        </button>
      </div>
    </header>
  );
};

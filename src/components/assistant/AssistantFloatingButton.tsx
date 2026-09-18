import React from "react";
import { Bot, Sparkles } from "lucide-react";

interface AssistantFloatingButtonProps {
  onClick: () => void;
}

/**
 * Floating button anchored at bottom-right of viewport to summon the AI Production Assistant.
 */
export const AssistantFloatingButton: React.FC<AssistantFloatingButtonProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg hover:shadow-indigo-500/25 transition-all duration-200 cursor-pointer group focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      aria-label="Open AI Production Assistant"
    >
      <div className="relative">
        <Bot className="w-5 h-5 transition-transform group-hover:scale-110" />
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-indigo-600 rounded-full" />
      </div>
      <span className="font-semibold text-sm tracking-wide">Production Assistant</span>
      <Sparkles className="w-4 h-4 text-amber-300 transition-transform group-hover:rotate-12" />
    </button>
  );
};

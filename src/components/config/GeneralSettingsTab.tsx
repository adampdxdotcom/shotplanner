import React from "react";
import { Sun, Moon, Monitor, Sliders, Palette, Check } from "lucide-react";
import { useTheme, ThemeMode } from "../../context/ThemeContext";

export const GeneralSettingsTab: React.FC = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const themes: { id: ThemeMode; label: string; description: string; icon: React.ReactNode }[] = [
    {
      id: "dark",
      label: "Dark Studio",
      description: "Default high-contrast deep slate & zinc workspace. Ideal for low-light film sets and color grading.",
      icon: <Moon className="w-5 h-5 text-indigo-400" />
    },
    {
      id: "light",
      label: "Light Studio",
      description: "Crisp, clean high-contrast light workspace. Reduces eye fatigue in well-lit studio offices.",
      icon: <Sun className="w-5 h-5 text-amber-500" />
    },
    {
      id: "system",
      label: "System Sync",
      description: "Automatically matches your operating system's light or dark mode preference.",
      icon: <Monitor className="w-5 h-5 text-purple-400" />
    }
  ];

  return (
    <div id="general-settings-tab" className="space-y-6">
      {/* Header Banner Card */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-950/80 border border-indigo-700/50 flex items-center justify-center text-indigo-400 shadow-inner">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-100 flex items-center gap-2">
              Appearance &amp; General Preferences
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Customize the Director Workspace theme, display modes, and global visual interface.
            </p>
          </div>
        </div>
      </div>

      {/* Theme Selection Card */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              Theme Mode
            </h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Select your preferred visual atmosphere. Your choice is persisted locally across sessions.
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-medium text-zinc-400 bg-zinc-800/80 border border-zinc-700/60 px-2.5 py-1 rounded-full">
              Active: <span className="text-indigo-400 font-semibold capitalize">{resolvedTheme} Mode</span>
              {theme === "system" && " (System)"}
            </span>
          </div>
        </div>

        {/* 3 Theme Choice Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {themes.map((t) => {
            const isSelected = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={`relative flex flex-col p-4 rounded-xl text-left border-2 transition-all cursor-pointer group ${
                  isSelected
                    ? "bg-zinc-850 border-indigo-500 shadow-md shadow-indigo-950/20"
                    : "bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850/60"
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2.5">
                  <div className={`p-2 rounded-lg ${isSelected ? "bg-indigo-950/80 border border-indigo-700/50" : "bg-zinc-800 text-zinc-400"}`}>
                    {t.icon}
                  </div>
                  {isSelected && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-indigo-400 bg-indigo-950/90 border border-indigo-600/50 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" />
                      Active
                    </span>
                  )}
                </div>

                <div className="font-semibold text-xs text-zinc-100 group-hover:text-white mb-1">
                  {t.label}
                </div>
                <div className="text-[11px] text-zinc-400 leading-relaxed">
                  {t.description}
                </div>
              </button>
            );
          })}
        </div>

        {/* Canvas Protection Note */}
        <div className="p-3.5 rounded-lg bg-zinc-950/60 border border-zinc-800/80 text-[11px] text-zinc-400 flex items-start gap-2.5">
          <span className="text-indigo-400 font-bold text-sm shrink-0">ⓘ</span>
          <p className="leading-relaxed">
            <strong className="text-zinc-200">Director Staging Protection:</strong> The 2D interactive canvas stage, chroma-key mask brush, and visual cutouts maintain calibrated contrast and transparency grid standards across both themes to ensure accurate edge separation during production keying.
          </p>
        </div>
      </div>
    </div>
  );
};

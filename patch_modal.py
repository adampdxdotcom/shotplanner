import re

with open("src/components/ProjectModals.tsx", "r") as f:
    content = f.read()

type_def = """export interface ProjectInfo {
  filename: string;
  display_name: string;
  mtime?: string;
  size?: number;
}

interface LoadProjectModalProps {"""

content = re.sub(r'interface LoadProjectModalProps \{', type_def, content)

state_target = """const [projects, setProjects] = useState<string[]>([]);"""
state_replacement = """const [projects, setProjects] = useState<ProjectInfo[]>([]);"""

content = content.replace(state_target, state_replacement)

fetch_target = """if (data.projects) setProjects(data.projects);"""
fetch_replacement = """if (data.projects) {
            const mapped = data.projects.map((p: any) => 
              typeof p === "string" 
                ? { filename: p, display_name: p.replace(/\\.json$/i, ""), mtime: "", size: 0 } 
                : p
            );
            setProjects(mapped);
          }"""

content = content.replace(fetch_target, fetch_replacement)

# There is a second fetch target in handleZipUpload
content = content.replace("if (listData.projects) setProjects(listData.projects);", """if (listData.projects) {
        const mapped = listData.projects.map((p: any) => 
          typeof p === "string" 
            ? { filename: p, display_name: p.replace(/\\.json$/i, ""), mtime: "", size: 0 } 
            : p
        );
        setProjects(mapped);
      }""")

# Now the rendering part
render_target = """{projects.map((p) => (
                <div key={p} className="flex items-center gap-2 group/row">
                  <button
                    onClick={() => handleLoad(p)}
                    disabled={loadingFile !== null}
                    className="flex-1 text-left px-4 py-3 bg-zinc-950/50 hover:bg-zinc-800 border-2 border-zinc-700/80 hover:border-zinc-700 rounded-lg transition-colors flex items-center justify-between min-w-0"
                  >
                    <span className="text-sm text-zinc-200 truncate">{p}</span>
                    {loadingFile === p ? (
                      <span className="text-xs text-indigo-400">Loading...</span>
                    ) : (
                      <span className="text-[11px] text-zinc-500 group-hover:text-zinc-300 transition-colors">Load</span>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(p);
                    }}
                    disabled={loadingFile !== null}
                    className="p-3 bg-zinc-950/50 hover:bg-red-950/60 text-zinc-500 hover:text-red-400 border-2 border-zinc-700/80 hover:border-red-900/50 rounded-lg transition-colors shrink-0"
                    title="Delete Project"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>
              ))}"""

render_replacement = """{projects.map((p) => {
                const dateStr = p.mtime ? new Date(p.mtime).toLocaleString() : "";
                const sizeStr = p.size ? (p.size / 1024).toFixed(1) + " KB" : "";
                
                return (
                <div key={p.filename} className="flex items-center gap-2 group/row">
                  <button
                    onClick={() => handleLoad(p.filename)}
                    disabled={loadingFile !== null}
                    className="flex-1 text-left px-4 py-3 bg-zinc-950/50 hover:bg-zinc-800 border-2 border-zinc-700/80 hover:border-zinc-700 rounded-lg transition-colors flex items-center justify-between min-w-0"
                  >
                    <div className="flex flex-col truncate">
                      <span className="text-sm text-zinc-200 truncate">{p.display_name}</span>
                      {(dateStr || sizeStr) && (
                        <span className="text-xs text-zinc-500 truncate mt-0.5">
                          {dateStr}{dateStr && sizeStr && " • "}{sizeStr}
                        </span>
                      )}
                    </div>
                    {loadingFile === p.filename ? (
                      <span className="text-xs text-indigo-400 ml-2 shrink-0">Loading...</span>
                    ) : (
                      <span className="text-[11px] text-zinc-500 group-hover:text-zinc-300 transition-colors ml-2 shrink-0">Load</span>
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(p.filename);
                    }}
                    disabled={loadingFile !== null}
                    className="p-3 bg-zinc-950/50 hover:bg-red-950/60 text-zinc-500 hover:text-red-400 border-2 border-zinc-700/80 hover:border-red-900/50 rounded-lg transition-colors shrink-0"
                    title="Delete Project"
                  >
                    <Trash2 className="w-4.5 h-4.5" />
                  </button>
                </div>
              )})}"""

content = content.replace(render_target, render_replacement)

with open("src/components/ProjectModals.tsx", "w") as f:
    f.write(content)

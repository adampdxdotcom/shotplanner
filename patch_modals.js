import fs from 'fs';
let code = fs.readFileSync('src/components/ProjectModals.tsx', 'utf-8');

// Replace lucide-react imports to add Download, Upload
code = code.replace(
  'import { X, Save, FolderOpen, AlertCircle } from "lucide-react";',
  'import { X, Save, FolderOpen, AlertCircle, Download, Upload } from "lucide-react";'
);

// Update SaveProjectModalProps
code = code.replace(
  'interface SaveProjectModalProps {',
  'interface SaveProjectModalProps {\n  currentProjectName?: string;'
);

// Update SaveProjectModal component
code = code.replace(
  'export const SaveProjectModal: React.FC<SaveProjectModalProps> = ({ isOpen, onClose, onSave }) => {',
  'export const SaveProjectModal: React.FC<SaveProjectModalProps> = ({ isOpen, onClose, onSave, currentProjectName }) => {'
);

// Add useEffect to set filename
const useEffectCode = `
  useEffect(() => {
    if (isOpen && currentProjectName) {
      setFilename(currentProjectName);
    } else if (isOpen) {
      setFilename("");
    }
  }, [isOpen, currentProjectName]);
`;
code = code.replace(
  'if (!isOpen) return null;',
  useEffectCode + '\n  if (!isOpen) return null;'
);

// Update handleSave to differentiate Save and Save As
code = code.replace(
  'const handleSave = async () => {',
  `const handleSaveAs = async () => {
    if (!filename.trim()) {
      setError("Please enter a filename.");
      return;
    }
    if (currentProjectName && filename.trim() === currentProjectName) {
      setError("Please choose a different name to save a copy.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(filename.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save project.");
    } finally {
      setSaving(false);
    }
  };

  const handleExportZip = () => {
    if (!currentProjectName) {
      setError("Please save the project first before exporting.");
      return;
    }
    window.location.href = \`/api/projects/\${currentProjectName}/export\`;
  };

  const handleSave = async () => {`
);

// Replace the buttons in SaveProjectModal
const saveButtons = `
        <div className="p-4 border-t border-zinc-800 bg-zinc-950/30 flex justify-between gap-3">
          <button onClick={handleExportZip} className="px-4 py-2 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors flex items-center gap-2 border border-emerald-500/20">
            <Download className="w-3.5 h-3.5" />
            Export Zip
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors">
              Cancel
            </button>
            {currentProjectName && (
              <button 
                onClick={handleSaveAs} 
                disabled={saving}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
              >
                Save As
              </button>
            )}
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors flex items-center gap-2"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
`;

code = code.replace(
  /<div className="p-4 border-t border-zinc-800 bg-zinc-950\/30 flex justify-end gap-3">[\s\S]*?<\/div>\n      <\/div>/m,
  saveButtons.trim() + '\n      </div>'
);


// Update LoadProjectModalProps
code = code.replace(
  'interface LoadProjectModalProps {',
  'interface LoadProjectModalProps {\n  onReloadProjects?: () => void;'
);

// Update LoadProjectModal component
code = code.replace(
  'export const LoadProjectModal: React.FC<LoadProjectModalProps> = ({ isOpen, onClose, onLoad }) => {',
  'export const LoadProjectModal: React.FC<LoadProjectModalProps> = ({ isOpen, onClose, onLoad }) => {\n  const [uploadingZip, setUploadingZip] = useState(false);'
);

const loadButtons = `
  const handleZipUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    setUploadingZip(true);
    setError(null);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/projects/import", {
        method: "POST",
        body: formData
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to import project.");
      }
      const data = await res.json();
      
      // refresh list
      const listRes = await fetch("/api/projects");
      const listData = await listRes.json();
      if (listData.projects) setProjects(listData.projects);
      
      // automatically load it
      if (data.filename) {
        await handleLoad(data.filename);
      }
    } catch (err: any) {
      setError(err.message || "Failed to import zip.");
    } finally {
      setUploadingZip(false);
      e.target.value = ''; // reset
    }
  };

  if (!isOpen) return null;
`;

code = code.replace(
  'if (!isOpen) return null;',
  loadButtons
);

const uploadButtonHtml = `
          <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-indigo-400" />
            Load Project
          </h3>
          <div className="flex items-center gap-2">
            <label className="cursor-pointer px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 rounded-lg transition-colors flex items-center gap-1.5 border border-emerald-500/20">
              <Upload className="w-3.5 h-3.5" />
              {uploadingZip ? "Uploading..." : "Upload Zip"}
              <input type="file" accept=".zip" className="hidden" onChange={handleZipUpload} disabled={uploadingZip} />
            </label>
            <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
`;

code = code.replace(
  /<h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">[\s\S]*?<\/button>/m,
  uploadButtonHtml.trim()
);

fs.writeFileSync('src/components/ProjectModals.tsx', code);

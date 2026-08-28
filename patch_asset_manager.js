import fs from 'fs';
let code = fs.readFileSync('src/components/AssetManagerSection.tsx', 'utf-8');

// 1. Add Edit3, Maximize, X to lucide-react imports
code = code.replace(
  'import {',
  'import {\n  Edit3,\n  Maximize,\n  X,'
);

// 2. Update Props
code = code.replace(
  'onAssetDeleted: (filename: string) => void;',
  'onAssetDeleted: (filename: string) => void;\n  onAssetUpdated: (oldFilename: string, newAsset: MediaAsset) => void;'
);

code = code.replace(
  'onAssetDeleted\n}) => {',
  'onAssetDeleted,\n  onAssetUpdated\n}) => {'
);

// 3. Add Lightbox state and Edit Modal state
const stateAdditions = `
  const [lightboxAsset, setLightboxAsset] = useState<MediaAsset | null>(null);
  
  const [editingAsset, setEditingAsset] = useState<MediaAsset | null>(null);
  const [editSubjectName, setEditSubjectName] = useState<string>("");
  const [editDescription, setEditDescription] = useState<string>("");
  const [editType, setEditType] = useState<string>("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const openEditModal = (asset: MediaAsset) => {
    setEditingAsset(asset);
    setEditSubjectName(asset.subject_name);
    setEditDescription(asset.description);
    setEditType(asset.type);
    setEditFile(null);
    setEditError(null);
  };

  const closeEditModal = () => {
    setEditingAsset(null);
    setEditFile(null);
  };

  const submitEdit = async () => {
    if (!editingAsset) return;
    setIsEditing(true);
    setEditError(null);

    try {
      if (editFile) {
        // Upload new file chunks
        const CHUNK_SIZE = 512 * 1024;
        const totalChunks = Math.ceil(editFile.size / CHUNK_SIZE);
        const uploadId = Date.now().toString() + "_" + Math.random().toString(36).substring(2);
        
        let finalData = null;
        for (let i = 0; i < totalChunks; i++) {
          const chunk = editFile.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          const formData = new FormData();
          formData.append("file", chunk, editFile.name);
          formData.append("upload_id", uploadId);
          formData.append("chunk_index", i.toString());
          formData.append("total_chunks", totalChunks.toString());
          formData.append("original_name", editFile.name);
          formData.append("replace_filename", editingAsset.filename);
          
          if (i === totalChunks - 1) {
            formData.append("media_type", editingAsset.media_type);
            formData.append("type", editType);
            formData.append("subject_name", editSubjectName || "subject");
            formData.append("description", editDescription || "");
          }
          
          const res = await fetch("/api/assets/upload_chunk", {
            method: "POST",
            body: formData
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to upload replacement chunk.");
          if (i === totalChunks - 1) finalData = data;
        }
        
        if (finalData && finalData.asset) {
          onAssetUpdated(editingAsset.filename, finalData.asset);
        } else {
          throw new Error("Failed to get updated asset.");
        }
      } else {
        // Just update metadata
        const res = await fetch(\`/api/assets/\${editingAsset.filename}\`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: editType,
            subject_name: editSubjectName,
            description: editDescription
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to update asset.");
        onAssetUpdated(editingAsset.filename, data.asset);
      }
      closeEditModal();
    } catch (err: any) {
      setEditError(err.message || "Failed to save edits.");
    } finally {
      setIsEditing(false);
    }
  };
`;

code = code.replace(
  'const [uploadError, setUploadError] = useState<string | null>(null);',
  'const [uploadError, setUploadError] = useState<string | null>(null);\n' + stateAdditions
);

// 4. Update the card rendering for images
const cardReplacement = `
              <div 
                key={asset.filename} 
                className="bg-zinc-950 p-3 rounded-xl border-2 border-zinc-700 hover:border-zinc-700 transition-all space-y-2 relative group flex flex-col"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-300 text-[10px] font-mono font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        {asset.type}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(asset)}
                      className="text-zinc-500 hover:text-indigo-400 p-1 rounded transition-colors"
                      title="Edit asset"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(asset.filename)}
                      className="text-zinc-500 hover:text-red-400 p-1 rounded transition-colors"
                      title="Delete asset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {asset.media_type === "image" && asset.preview_url && (
                  <div 
                    className="relative w-full aspect-square bg-zinc-900 rounded-lg overflow-hidden cursor-pointer group/img border border-zinc-800"
                    onClick={() => setLightboxAsset(asset)}
                  >
                    <img src={asset.preview_url} alt={asset.subject_name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                      <Maximize className="w-6 h-6 text-white" />
                    </div>
                  </div>
                )}
`;

code = code.replace(
  /<div \s*key=\{asset.filename\}[\s\S]*?<div className="flex items-start justify-between gap-2">[\s\S]*?<\/div>\s*<\/div>/,
  cardReplacement.trim()
);


// 5. Append Modals
const modals = `
      {/* Edit Modal */}
      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border-2 border-zinc-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                Edit Asset
              </h3>
              <button onClick={closeEditModal} className="text-zinc-400 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto max-h-[70vh]">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Asset Type</label>
                <input
                  type="text"
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500 transition-colors outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Subject Name</label>
                <input
                  type="text"
                  value={editSubjectName}
                  onChange={(e) => setEditSubjectName(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500 transition-colors outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:border-indigo-500 transition-colors outline-none resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Replace File (Optional)</label>
                <input
                  type="file"
                  accept={editingAsset.media_type === "image" ? "image/*" : editingAsset.media_type === "audio" ? "audio/*" : "video/*"}
                  onChange={(e) => setEditFile(e.target.files?.[0] || null)}
                  className="w-full bg-zinc-950 border-2 border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-zinc-200 file:mr-3 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700"
                />
              </div>
              
              {editError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-400">{editError}</p>
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-zinc-800 bg-zinc-950/30 flex justify-end gap-3">
              <button onClick={closeEditModal} className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors">
                Cancel
              </button>
              <button 
                onClick={submitEdit} 
                disabled={isEditing}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                {isEditing ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxAsset && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-12 cursor-zoom-out"
          onClick={() => setLightboxAsset(null)}
        >
          <div className="relative max-w-full max-h-full flex flex-col items-center justify-center">
            <button 
              className="absolute -top-10 right-0 text-white/70 hover:text-white bg-black/50 p-2 rounded-full transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxAsset(null);
              }}
            >
              <X className="w-6 h-6" />
            </button>
            {lightboxAsset.media_type === "image" && lightboxAsset.preview_url && (
              <img 
                src={lightboxAsset.preview_url} 
                alt={lightboxAsset.subject_name} 
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl border border-white/10"
                onClick={(e) => e.stopPropagation()}
              />
            )}
            <div 
              className="mt-4 text-center bg-black/50 px-4 py-2 rounded-xl backdrop-blur-md border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold text-white">{lightboxAsset.subject_name}</h3>
              <p className="text-xs text-zinc-400 mt-1 max-w-lg">{lightboxAsset.description}</p>
            </div>
          </div>
        </div>
      )}
`;

code = code.replace(
  '    </div>\n  );\n};\n',
  modals + '\n    </div>\n  );\n};\n'
);

fs.writeFileSync('src/components/AssetManagerSection.tsx', code);

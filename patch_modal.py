import re

with open("src/components/AssetManagerSection.tsx", "r") as f:
    content = f.read()

# Make sure Search is imported
if ' Search,' not in content:
    content = content.replace('UploadCloud,', 'UploadCloud, Search,')
if ' CheckCircle,' not in content:
    content = content.replace('Trash2,', 'Trash2, CheckCircle,')

# Add helper functions for library view grouping inside the component render
helper_funcs = """
  const libraryAssets = assets.filter(a => 
    uploadModalSlot?.type === "image" 
      ? (a.media_type === "image" || (!a.media_type && !/\.(mp3|wav|ogg|m4a|flac|mp4|mov|webm|mkv)$/i.test(a.filename)) || /\.(png|jpe?g|webp|gif|svg|avif|bmp)$/i.test(a.filename))
      : uploadModalSlot?.type === "audio"
      ? (a.media_type === "audio" || /\.(mp3|wav|ogg|m4a|flac)$/i.test(a.filename))
      : (a.media_type === "video" || /\.(mp4|mov|webm|mkv)$/i.test(a.filename))
  );

  const filteredLibraryAssets = libraryAssets.filter(a => {
    if (librarySearch) {
      const q = librarySearch.toLowerCase();
      if (!(a.subject_name?.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q) || a.filename.toLowerCase().includes(q))) {
        return false;
      }
    }
    if (libraryFilter !== "All") {
      if (libraryFilter === "Headshots" && a.type !== "Headshot") return false;
      if (libraryFilter === "Body References" && a.type !== "Body Reference") return false;
      if (libraryFilter === "Scene / Location" && a.type !== "Scene Reference") return false;
      if (libraryFilter === "Objects" && a.type !== "Object Reference") return false;
    }
    return true;
  });

  const groupedLibraryAssets = filteredLibraryAssets.reduce((acc, asset) => {
    const subject = asset.subject_name || "Uncategorized";
    if (!acc[subject]) acc[subject] = [];
    acc[subject].push(asset);
    return acc;
  }, {} as Record<string, MediaAsset[]>);
"""

# Insert helpers right before `const isImg`
if "const libraryAssets =" not in content:
    content = re.sub(
        r'(  const isImg = \(a: MediaAsset\) =>)',
        helper_funcs + r'\n\1',
        content,
        count=1
    )

# Now, we need to replace the modal body.
# We'll use string replacement carefully.

modal_top = """<div className="bg-zinc-900 border-2 border-zinc-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-amber-400" />
                Assign {uploadModalSlot.type.toUpperCase()} to Slot {uploadModalSlot.index + 1}
              </h3>
              <button onClick={closeUploadModal} className="text-zinc-400 hover:text-white transition-colors" disabled={uploading}>
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="flex border-b border-zinc-800 bg-zinc-950/30">
              <button
                onClick={() => setUploadModalTab("upload")}
                className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${uploadModalTab === "upload" ? "text-amber-400 border-b-2 border-amber-400 bg-zinc-900/50" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                Upload New Asset
              </button>
              <button
                onClick={() => setUploadModalTab("library")}
                className={`flex-1 py-3 text-xs font-semibold uppercase tracking-wider transition-colors ${uploadModalTab === "library" ? "text-amber-400 border-b-2 border-amber-400 bg-zinc-900/50" : "text-zinc-500 hover:text-zinc-300"}`}
              >
                Select from Library
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto max-h-[70vh] min-h-[400px] flex flex-col">
              {uploadModalTab === "upload" ? (
                <div className="space-y-4">"""

modal_bottom = """                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0">
                  {libraryAssets.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-zinc-950/50 rounded-xl border border-zinc-800/50 h-full">
                      <HardDrive className="w-8 h-8 text-zinc-600 mb-3" />
                      <p className="text-sm text-zinc-400">No assets found in library.</p>
                      <button onClick={() => setUploadModalTab("upload")} className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-md text-xs font-medium transition-colors">
                        Switch to Upload Tab
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-4 mb-4 shrink-0">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                          <input
                            type="text"
                            placeholder="Search by subject, description, or filename..."
                            value={librarySearch}
                            onChange={e => setLibrarySearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-zinc-950 border-2 border-zinc-800 focus:border-amber-500 rounded-lg text-sm text-white placeholder-zinc-600 outline-none transition-colors"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {["All", "Headshots", "Body References", "Scene / Location", "Objects"].map(filter => (
                            <button
                              key={filter}
                              onClick={() => setLibraryFilter(filter)}
                              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${libraryFilter === filter ? "bg-zinc-800 text-white border-zinc-600" : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-700"}`}
                            >
                              {filter}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar">
                        {Object.keys(groupedLibraryAssets).length === 0 ? (
                          <div className="text-center py-8 text-zinc-500 text-sm">No assets match your search/filter.</div>
                        ) : (
                          Object.entries(groupedLibraryAssets).map(([subject, assets]) => (
                            <div key={subject} className="space-y-3">
                              <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 sticky top-0 bg-zinc-900/90 backdrop-blur z-10">
                                <h4 className="text-sm font-semibold text-zinc-200">{subject}</h4>
                                <span className="px-2 py-0.5 bg-zinc-800 rounded-full text-[10px] text-zinc-400 font-medium">
                                  {assets.length} {assets.length === 1 ? "Asset" : "Assets"}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {assets.map(asset => (
                                  <div
                                    key={asset.id || asset.filename}
                                    onClick={() => setSelectedLibraryAsset(asset)}
                                    className={`relative aspect-square rounded-lg border-2 cursor-pointer overflow-hidden transition-all group ${selectedLibraryAsset?.filename === asset.filename ? "border-amber-500 ring-2 ring-amber-500/20" : "border-zinc-800 hover:border-zinc-600"}`}
                                  >
                                    {uploadModalSlot?.type === "image" ? (
                                      <img src={getAssetMediaUrl(asset)} className="absolute inset-0 w-full h-full object-cover" alt="" />
                                    ) : uploadModalSlot?.type === "video" ? (
                                      <video src={getAssetMediaUrl(asset)} className="absolute inset-0 w-full h-full object-cover" />
                                    ) : (
                                      <div className="absolute inset-0 bg-zinc-800 flex items-center justify-center">
                                        <Music className="w-8 h-8 text-zinc-500" />
                                      </div>
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 pt-6">
                                      <div className="text-[9px] font-bold text-white uppercase tracking-wider line-clamp-1">{asset.type || "Asset"}</div>
                                      {asset.description && <div className="text-[10px] text-zinc-300 line-clamp-1 mt-0.5">{asset.description}</div>}
                                    </div>
                                    {selectedLibraryAsset?.filename === asset.filename && (
                                      <div className="absolute top-1 right-1 bg-amber-500 rounded-full p-0.5 shadow-lg">
                                        <CheckCircle className="w-3 h-3 text-black" />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      
                      <div className="pt-4 border-t border-zinc-800 flex justify-end gap-3 mt-4 shrink-0">
                        <button onClick={closeUploadModal} className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                          Cancel
                        </button>
                        <button
                          onClick={handleAssignExistingAsset}
                          disabled={!selectedLibraryAsset}
                          className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-2 rounded-md text-sm font-semibold transition-colors flex items-center gap-2 shadow-lg shadow-amber-900/20"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Assign to Slot {uploadModalSlot?.index !== undefined ? uploadModalSlot.index + 1 : ""}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>"""

# Define the start and end of what we want to replace
start_marker = r'<div className="bg-zinc-900 border-2 border-zinc-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">\s*<div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">\s*<h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">\s*<UploadCloud className="w-4 h-4 text-amber-400" />\s*Upload \{uploadModalSlot\.type\.toUpperCase\(\)\} to Slot \{uploadModalSlot\.index \+ 1\}\s*</h3>\s*<button onClick=\{closeUploadModal\} className="text-zinc-400 hover:text-white transition-colors" disabled=\{uploading\}>\s*<X className="w-4 h-4" />\s*</button>\s*</div>\s*<div className="p-4 space-y-4 overflow-y-auto max-h-\[75vh\]">'

end_marker = r'(<input\s*type="file"\s*accept=\{activeTab === "image" \? "image/\*" : activeTab === "audio" \? "audio/\*" : "video/\*"\}\s*onChange=\{handleFileSelect\}\s*disabled=\{isUploadDisabled\}\s*className="hidden"\s*/>\s*</label>\s*</div>\s*)(</div>\s*</div>)'

# Perform replacement of the top
content = re.sub(start_marker, modal_top, content, count=1)

# Perform replacement of the bottom
def replace_bottom(match):
    # keep the input etc., then close the div and add our modal_bottom
    return match.group(1) + modal_bottom

content = re.sub(end_marker, replace_bottom, content, count=1)

with open("src/components/AssetManagerSection.tsx", "w") as f:
    f.write(content)


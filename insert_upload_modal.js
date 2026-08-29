import fs from 'fs';

let content = fs.readFileSync('src/components/AssetManagerSection.tsx', 'utf8');

const uploadModalJsx = `
      {/* Upload Modal */}
      {uploadModalSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border-2 border-zinc-700 rounded-xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-zinc-800 bg-zinc-950/50">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-amber-400" />
                Upload {uploadModalSlot.type.toUpperCase()} to Slot {uploadModalSlot.index + 1}
              </h3>
              <button onClick={closeUploadModal} className="text-zinc-400 hover:text-white transition-colors" disabled={uploading}>
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-4 space-y-4 overflow-y-auto max-h-[75vh]">
              {uploadError && (
                <div className="p-3 rounded-lg bg-red-950/30 border border-red-800/40 text-xs text-red-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1">
                  <span>Asset Semantic Type</span>
                </label>
                {activeTab === "image" ? (
                  <select
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value)}
                    className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                  >
                    <option value="Headshot">Headshot</option>
                    <option value="Body Reference">Body Reference</option>
                    <option value="Scene Reference">Scene Reference</option>
                    <option value="Object Reference">Object Reference</option>
                    <option value="Style Reference">Style Reference</option>
                  </select>
                ) : activeTab === "audio" ? (
                  <select
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value)}
                    className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-emerald-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                  >
                    <option value="Voiceover Audio">Voiceover Audio</option>
                    <option value="Soundtrack / BGM">Soundtrack / BGM</option>
                    <option value="SFX / Ambient">SFX / Ambient</option>
                  </select>
                ) : (
                  <select
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value)}
                    className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 outline-none"
                  >
                    <option value="Motion Reference Video">Motion Reference Video</option>
                    <option value="Style Reference Video">Style Reference Video</option>
                  </select>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1">
                  <User className="w-3 h-3 text-zinc-400" />
                  <span>Subject / Entity Name</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. jackie, cyberpunk_car, tavern"
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-zinc-300 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <AlignLeft className="w-3 h-3 text-zinc-400" />
                    <span>Description (Passed to LLM)</span>
                  </span>
                  <span className="text-[10px] text-amber-400/80 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" /> Context
                  </span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Describe wardrobe, lighting, identity, angles..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-zinc-950 border-2 border-zinc-700 focus:border-amber-500 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-600 outline-none resize-none"
                />
              </div>
              
              <div className="bg-zinc-950 px-3 py-2 rounded-lg border-2 border-zinc-700/80 text-[11px] flex items-center justify-between">
                <span className="text-zinc-400">Renamed File Strategy:</span>
                <span className="font-mono text-amber-300 font-medium truncate max-w-[280px]">
                  {previewFilename}
                </span>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-800">
                <label className={\`relative w-full flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-all \${
                  isUploadDisabled
                    ? "opacity-50 cursor-not-allowed border-zinc-800 bg-zinc-950/30" 
                    : "border-zinc-700 hover:border-amber-500/80 bg-zinc-950/40 hover:bg-zinc-900/60 cursor-pointer"
                }\`}>
                  {uploading ? (
                    <>
                      <Loader2 className="w-8 h-8 mb-2 text-amber-400 animate-spin" />
                      <p className="text-xs font-semibold text-zinc-200 text-center mb-2">
                        Uploading... {uploadProgress}%
                      </p>
                      <div className="w-full max-w-[200px] bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-amber-400 h-1.5 transition-all duration-300 ease-out" 
                          style={{ width: \`\${uploadProgress}%\` }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <UploadCloud className={\`w-8 h-8 mb-2 \${isLimitReached ? "text-zinc-600" : "text-amber-400 animate-pulse"}\`} />
                      <p className="text-xs font-semibold text-zinc-200 text-center">
                        Select {activeTab.toUpperCase()} File
                      </p>
                      <p className="text-[11px] text-zinc-400 text-center mt-1">
                        {isLimitReached 
                          ? \`Max \${currentMax} \${activeTab}(s) reached\` 
                          : isMetadataIncomplete
                          ? "Enter subject name & description first"
                          : \`Click to browse files\`}
                      </p>
                    </>
                  )}
                  <input
                    type="file"
                    accept={activeTab === "image" ? "image/*" : activeTab === "audio" ? "audio/*" : "video/*"}
                    onChange={handleFileSelect}
                    disabled={isUploadDisabled}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
`;

content = content.replace('{/* Edit Modal */}', uploadModalJsx);

fs.writeFileSync('src/components/AssetManagerSection.tsx', content);

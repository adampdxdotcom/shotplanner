import re

with open("src/components/AssetManagerSection.tsx", "r") as f:
    content = f.read()

# 1. Add state variables
state_vars = """  const [uploadModalTab, setUploadModalTab] = useState<"upload" | "library">("upload");
  const [librarySearch, setLibrarySearch] = useState("");
  const [libraryFilter, setLibraryFilter] = useState("All");
  const [selectedLibraryAsset, setSelectedLibraryAsset] = useState<MediaAsset | null>(null);"""

content = re.sub(
    r'(const \[uploadModalSlot, setUploadModalSlot\] = useState<.*?null>\(null\);)',
    r'\1\n' + state_vars,
    content,
    count=1
)

# 2. Modify openUploadModal
openUploadModal_new = """  const openUploadModal = (type: "image" | "audio" | "video", index: number) => {
    setActiveTab(type);
    setAssetType(type === "image" ? "Headshot" : type === "audio" ? "Voiceover Audio" : "Motion Reference Video");
    setSubjectName("");
    setDescription("");
    setUploadError(null);
    setUploadModalSlot({ type, index });
    
    // Default to library tab if there are existing assets of this type
    const hasAssets = assets.some(a => 
      type === "image" 
        ? (a.media_type === "image" || (!a.media_type && !/\.(mp3|wav|ogg|m4a|flac|mp4|mov|webm|mkv)$/i.test(a.filename)))
        : type === "audio"
        ? (a.media_type === "audio" || /\.(mp3|wav|ogg|m4a|flac)$/i.test(a.filename))
        : (a.media_type === "video" || /\.(mp4|mov|webm|mkv)$/i.test(a.filename))
    );
    setUploadModalTab(hasAssets ? "library" : "upload");
    setLibrarySearch("");
    setLibraryFilter("All");
    setSelectedLibraryAsset(null);
  };"""

content = re.sub(
    r'  const openUploadModal = \(type: "image" \| "audio" \| "video", index: number\) => \{[\s\S]*?setUploadModalSlot\(\{ type, index \}\);\n  \};',
    openUploadModal_new,
    content,
    count=1
)

# 3. Add handleAssignExistingAsset
handle_assign_func = """  const handleAssignExistingAsset = () => {
    if (!selectedLibraryAsset || !uploadModalSlot) return;
    onAssetUploaded(selectedLibraryAsset, uploadModalSlot.index, uploadModalSlot.type);
    closeUploadModal();
  };"""

content = re.sub(
    r'(  const closeUploadModal = \(\) => \{\n    setUploadModalSlot\(null\);\n  \};)',
    r'\1\n\n' + handle_assign_func,
    content,
    count=1
)

# 4. Add Search icon import if missing
if 'Search' not in content:
    content = content.replace('UploadCloud,', 'UploadCloud, Search,')

# 5. Replace Modal Rendering
# Find the start of the modal body: `<div className="p-4 space-y-4 overflow-y-auto max-h-[75vh]">`
# Replace to insert the tabs and conditional rendering
with open("src/components/AssetManagerSection.tsx", "w") as f:
    f.write(content)

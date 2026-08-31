export function getAssetMediaUrl(assetOrFilename?: { filename?: string; preview_url?: string } | string | null, useThumbnail: boolean = false): string {
  if (!assetOrFilename) return "";
  
  const filename = typeof assetOrFilename === "string" 
    ? assetOrFilename 
    : assetOrFilename.filename;
    
  if (!filename) return "";
  
  if (useThumbnail) {
    return `/api/uploads/thumb/${encodeURIComponent(filename)}`;
  }
  
  // Canonical route confirmed by backend network requests
  return `/api/uploads/${encodeURIComponent(filename)}`;
}

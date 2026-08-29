export function getAssetMediaUrl(assetOrFilename?: { filename?: string; preview_url?: string } | string | null): string {
  if (!assetOrFilename) return "";
  
  const filename = typeof assetOrFilename === "string" 
    ? assetOrFilename 
    : assetOrFilename.filename;
    
  if (!filename) return "";
  
  // Canonical route confirmed by backend network requests
  return `/api/uploads/${encodeURIComponent(filename)}`;
}

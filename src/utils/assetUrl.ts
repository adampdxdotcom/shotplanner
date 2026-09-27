export function getAssetMediaUrl(
  assetOrFilename?: { filename?: string; preview_url?: string } | string | null,
  useThumbnail: boolean = false
): string {
  if (!assetOrFilename) return "";
  
  // If an asset object with a direct data URI, blob URL, or external URL is passed
  if (typeof assetOrFilename === "object" && assetOrFilename !== null) {
    const rawPreview = assetOrFilename.preview_url;
    if (rawPreview && (
      rawPreview.startsWith("data:") || 
      rawPreview.startsWith("blob:") || 
      rawPreview.startsWith("http://") || 
      rawPreview.startsWith("https://")
    )) {
      return rawPreview;
    }
  }

  const filename = typeof assetOrFilename === "string" 
    ? assetOrFilename 
    : assetOrFilename.filename || assetOrFilename.preview_url;
    
  if (!filename) return "";
  
  if (filename.startsWith("data:") || filename.startsWith("blob:") || filename.startsWith("http://") || filename.startsWith("https://")) {
    return filename;
  }
  
  if (useThumbnail) {
    return `/api/uploads/thumb/${encodeURIComponent(filename)}`;
  }
  
  // Canonical route confirmed by backend network requests
  return `/api/uploads/${encodeURIComponent(filename)}`;
}

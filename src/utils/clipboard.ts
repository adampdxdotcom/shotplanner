/**
 * Cross-browser clipboard copy utility with automatic fallback for insecure HTTP / LAN contexts.
 *
 * @param text The string content to copy to the clipboard
 * @returns Promise<boolean> resolving to true if copied successfully, false otherwise
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof text !== "string") {
    text = String(text ?? "");
  }

  // 1. Primary Attempt: navigator.clipboard API (if available and secure context)
  if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Failed (e.g. non-secure origin, permission denied, iframe restriction) -> fallback
    }
  }

  // 2. Fallback Attempt: Temporary hidden <textarea> element + document.execCommand('copy')
  if (typeof document !== "undefined") {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      // Prevent scrolling and keep invisible
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.width = "2em";
      textArea.style.height = "2em";
      textArea.style.padding = "0";
      textArea.style.border = "none";
      textArea.style.outline = "none";
      textArea.style.boxShadow = "none";
      textArea.style.background = "transparent";
      textArea.style.opacity = "0";
      textArea.setAttribute("readonly", "");
      textArea.setAttribute("aria-hidden", "true");

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, text.length);

      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);

      if (successful) {
        return true;
      }
    } catch (err) {
      console.warn("Fallback execCommand copy failed:", err);
    }
  }

  return false;
}

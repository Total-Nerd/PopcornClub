/**
 * Copies text to the clipboard with fallback for non-secure contexts (e.g. HTTP on local network).
 * @param {string} text - The text to copy to the clipboard
 * @returns {Promise<boolean>} - Whether the copy operation was successful
 */
export const copyToClipboard = async (text) => {
  if (text === undefined || text === null) {
    return false;
  }

  const str = String(text);

  // Modern Clipboard API if supported and available (requires secure context: HTTPS or localhost)
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(str);
      return true;
    } catch (err) {
      console.warn('navigator.clipboard.writeText failed, falling back to execCommand:', err);
    }
  }

  // Fallback using temporary textarea + execCommand('copy') for unsecure contexts (e.g. HTTP LAN hostname/IP)
  if (typeof document !== 'undefined') {
    let textArea = null;
    try {
      textArea = document.createElement('textarea');
      textArea.value = str;

      // Prevent zooming and page scroll jumps
      textArea.style.fontSize = '12pt';
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      textArea.setAttribute('readonly', '');

      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      textArea.setSelectionRange(0, textArea.value.length);

      const successful = document.execCommand('copy');
      return successful;
    } catch (fallbackErr) {
      console.error('Fallback clipboard copy failed:', fallbackErr);
      return false;
    } finally {
      if (textArea && textArea.parentNode) {
        textArea.parentNode.removeChild(textArea);
      }
    }
  }

  return false;
};

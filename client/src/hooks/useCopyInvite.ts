import { useState } from 'react';
import { COPY_FEEDBACK_MS } from '../constants';

/**
 * Copy an invite URL to the clipboard, flashing a `copied` flag for
 * `COPY_FEEDBACK_MS` on success. Prefers the async Clipboard API (only available
 * in a secure context — https or http://localhost) and falls back to a hidden
 * textarea + `execCommand('copy')` for non-secure origins (e.g. http://<LAN-IP>).
 */
export function useCopyInvite(url: string): { copied: boolean; copy: () => Promise<void> } {
  const [copied, setCopied] = useState(false);

  const markCopied = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
  };

  const copy = async () => {
    // Preferred path: async Clipboard API — but it only exists in a secure context
    // (https or http://localhost), so it's undefined when hosting over http://<LAN-IP>.
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
        markCopied();
        return;
      }
    } catch {
      /* fall through to the legacy path below */
    }
    // Fallback for non-secure origins: hidden textarea + execCommand('copy').
    try {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, ta.value.length);
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      if (ok) markCopied();
    } catch {
      /* clipboard genuinely unavailable — the user can still select the code manually */
    }
  };

  return { copied, copy };
}

"use client";

import { useState } from "react";

/** A read-only link with a Copy button. */
export function CopyLink({ url, label, note }: { url: string; label: string; note?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <input
          readOnly
          value={url}
          aria-label={label}
          className="min-h-10 flex-1 rounded-lg border border-line-strong bg-surface px-3 text-[13px]"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          className="min-h-10 cursor-pointer rounded-lg bg-accent px-4 font-medium text-white"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              setCopied(true);
            } catch {
              // Clipboard needs https; the field is still selectable by hand.
            }
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {note && <span className="text-xs text-muted">{note}</span>}
    </div>
  );
}

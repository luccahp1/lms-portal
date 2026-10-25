"use client";

import { useState } from "react";

/** Shows an invite link with a copy button. We don't send email, so the admin shares it themselves. */
export function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-good-bg p-4">
      <span className="font-medium text-good">Invite link ready. Send it to your client however you like (text, email, WhatsApp).</span>
      <div className="flex flex-wrap gap-2">
        <input readOnly value={url} aria-label="Invite link" className="min-h-10 flex-1 rounded-lg border border-line-strong bg-surface px-3 text-[13px]" onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          className="min-h-10 cursor-pointer rounded-lg bg-accent px-4 font-medium text-white"
          onClick={async () => {
            await navigator.clipboard.writeText(url);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <span className="text-xs text-muted">It works once and expires in 14 days.</span>
    </div>
  );
}

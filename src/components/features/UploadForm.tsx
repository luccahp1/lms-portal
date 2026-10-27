"use client";

import { useActionState, useEffect, useRef } from "react";
import { uploadFileAction } from "@/app/actions";
import { Button, FormError } from "@/components/ui";

export function UploadForm({ clientId, allowApproval = false }: { clientId?: string; allowApproval?: boolean }) {
  const [state, action, pending] = useActionState(uploadFileAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={action} className="flex flex-wrap items-center gap-3 rounded-[14px] border border-dashed border-line-strong bg-surface p-4">
      {clientId && <input type="hidden" name="clientId" value={clientId} />}
      <label className="flex flex-1 flex-col gap-1 font-medium">
        <span>Upload a file</span>
        <input name="file" type="file" required className="text-[13px] font-normal text-muted file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-ink" />
      </label>
      {allowApproval && (
        <label className="flex items-center gap-2">
          <input type="checkbox" name="needsApproval" className="size-4 accent-[var(--accent)]" />
          Ask the client to approve
        </label>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Uploading…" : "Upload"}
      </Button>
      <div className="w-full empty:hidden">
        <FormError message={state?.error} />
      </div>
    </form>
  );
}

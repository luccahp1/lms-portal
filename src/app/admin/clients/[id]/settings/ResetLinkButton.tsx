"use client";

import { useActionState } from "react";
import { resetLinkAction } from "@/app/actions";
import { Button } from "@/components/ui";
import { CopyLink } from "@/components/CopyLink";

export function ResetLinkButton({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(resetLinkAction, undefined);
  if (state?.resetUrl) {
    return (
      <div className="w-full">
        <CopyLink
          url={state.resetUrl}
          label="Password reset link"
          note="Send this to them. It works once, expires in 14 days, and logs them out everywhere else."
        />
      </div>
    );
  }
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" variant="secondary" disabled={pending}>
        Password reset link
      </Button>
    </form>
  );
}

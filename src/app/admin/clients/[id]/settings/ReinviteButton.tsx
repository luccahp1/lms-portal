"use client";

import { useActionState } from "react";
import { reinviteAction } from "@/app/actions";
import { Button } from "@/components/ui";
import { InviteLink } from "@/components/InviteLink";

export function ReinviteButton({ userId, label }: { userId: string; label: string }) {
  const [state, action, pending] = useActionState(reinviteAction, undefined);
  if (state?.inviteUrl) return <div className="w-full"><InviteLink url={state.inviteUrl} /></div>;
  return (
    <form action={action}>
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" variant="secondary" disabled={pending}>
        {label}
      </Button>
    </form>
  );
}

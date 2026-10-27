import { findValidInvite } from "@/lib/data/invites";
import { AuthShell } from "../../AuthShell";
import { SetPasswordForm } from "./SetPasswordForm";

export const metadata = { title: "Set your password" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const link = await findValidInvite(token);
  if (!link) {
    return (
      <AuthShell title="Link expired" subtitle="This password link has expired or was already used.">
        <p className="text-muted">Ask your account manager for a new one.</p>
      </AuthShell>
    );
  }
  return (
    <AuthShell title="Set your password" subtitle={`For ${link.email}`}>
      <SetPasswordForm token={token} />
    </AuthShell>
  );
}

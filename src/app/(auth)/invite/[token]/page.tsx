import { findValidInvite } from "@/lib/data/invites";
import { AuthShell } from "../../AuthShell";
import { InviteForm } from "./InviteForm";

export const metadata = { title: "Set your password" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invite = await findValidInvite(token);
  if (!invite) {
    return (
      <AuthShell title="Link expired" subtitle="This invite link has expired or was already used.">
        <p className="text-muted">Ask your account manager to send you a new one.</p>
      </AuthShell>
    );
  }
  return (
    <AuthShell title={`Welcome, ${invite.name.split(" ")[0]}`} subtitle={`Set a password for ${invite.email}.`}>
      <InviteForm token={token} />
    </AuthShell>
  );
}

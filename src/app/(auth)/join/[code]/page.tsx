import { redirect } from "next/navigation";
import Link from "next/link";
import { getViewer, homePath } from "@/lib/auth/session";
import { getAgencyByJoinCode } from "@/lib/data/signups";
import { AuthShell } from "../../AuthShell";
import { SignUpForm } from "./SignUpForm";

export const metadata = { title: "Create your account" };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const viewer = await getViewer();
  if (viewer) redirect(homePath(viewer));
  const { code } = await params;
  const agency = await getAgencyByJoinCode(code);
  if (!agency) {
    return (
      <AuthShell title="Link not valid" subtitle="This sign-up link doesn’t work anymore.">
        <p className="text-muted">Ask your agency for their current sign-up link.</p>
      </AuthShell>
    );
  }
  return (
    <div style={{ "--accent": agency.accentColor } as React.CSSProperties}>
      <AuthShell title="Create your account" subtitle={`Your client portal with ${agency.name}.`}>
        <SignUpForm joinCode={code} />
        <p className="mt-4 text-[13px] text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-accent hover:underline">
            Log in
          </Link>
        </p>
      </AuthShell>
    </div>
  );
}

import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/auth/session";
import { getAgency } from "@/lib/data/clients";
import { listAgencyOpenRequests } from "@/lib/data/requests";
import { listPendingSignups } from "@/lib/data/signups";
import { LiveRefresh } from "@/components/LiveRefresh";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireAdmin();
  // The agency side lives in LMS Dash now (docs/live-updates-and-dash-sync.md). Unset
  // ADMIN_HOME_URL to bring these pages back.
  if (process.env.ADMIN_HOME_URL) redirect(process.env.ADMIN_HOME_URL);
  const [agency, open, pending] = await Promise.all([
    getAgency(viewer),
    listAgencyOpenRequests(viewer),
    listPendingSignups(viewer),
  ]);
  return (
    <AppShell
      agencyName={agency.name}
      accentColor={agency.accentColor}
      subtitle="Agency admin"
      identity={{ title: viewer.name, detail: viewer.email }}
      nav={[
        { href: "/admin", label: "Clients", icon: "clients", exact: true },
        { href: "/admin/requests", label: "Request inbox", icon: "requests", badge: open.filter((r) => r.status === "received").length },
        { href: "/admin/signups", label: "Sign-ups", icon: "signups", badge: pending.length },
      ]}
    >
      <LiveRefresh />
      {children}
    </AppShell>
  );
}

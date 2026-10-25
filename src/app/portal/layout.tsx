import { AppShell } from "@/components/AppShell";
import { requireClient } from "@/lib/auth/session";
import { getAgency, getClient } from "@/lib/data/clients";
import { listRequests } from "@/lib/data/requests";
import { listFiles } from "@/lib/data/files";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireClient();
  const [agency, client, requests, files] = await Promise.all([
    getAgency(viewer),
    getClient(viewer),
    listRequests(viewer),
    listFiles(viewer),
  ]);

  return (
    <AppShell
      agencyName={agency.name}
      accentColor={agency.accentColor}
      subtitle="Client portal"
      identity={{ title: client.name, detail: viewer.name }}
      nav={[
        { href: "/portal", label: "Home", icon: "home", exact: true },
        { href: "/portal/requests", label: "Requests", icon: "requests", badge: requests.filter((r) => r.status === "review").length },
        { href: "/portal/messages", label: "Messages", icon: "messages" },
        { href: "/portal/files", label: "Files & approvals", icon: "files", badge: files.filter((f) => f.approval === "pending").length },
        { href: "/portal/billing", label: "Billing", icon: "billing" },
      ]}
    >
      {children}
    </AppShell>
  );
}

import { AppShell } from "@/components/AppShell";
import { requireClient } from "@/lib/auth/session";
import { getAgency, getClient } from "@/lib/data/clients";
import { listRequests } from "@/lib/data/requests";
import { listFiles } from "@/lib/data/files";

function PreviewBanner({ clientName, personName }: { clientName: string; personName: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-warn/30 bg-warn-bg px-4 py-3 text-[14px] text-warn">
      <span>
        <strong>Preview</strong> of {clientName}, seen as {personName}. Forms are switched off, so nothing you click
        here changes anything.
      </span>
      {/* A plain link, not <Link>: the route handler clears the cookie and redirects. */}
      <a href="/portal/exit-preview" className="font-semibold whitespace-nowrap underline">
        Exit preview
      </a>
    </div>
  );
}

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
      banner={viewer.previewBy && <PreviewBanner clientName={client.name} personName={viewer.name} />}
    >
      {viewer.previewBy ? (
        // Look, don't touch: every form and button in the preview is disabled.
        <fieldset disabled className="contents">
          {children}
        </fieldset>
      ) : (
        children
      )}
    </AppShell>
  );
}

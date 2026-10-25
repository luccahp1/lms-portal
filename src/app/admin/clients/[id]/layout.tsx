import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getClient } from "@/lib/data/clients";
import { listRequests } from "@/lib/data/requests";
import { orNotFound } from "@/lib/page";
import { Tabs } from "@/components/Tabs";

export default async function ClientLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const viewer = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const client = await orNotFound(getClient(viewer, id));
  const requests = await listRequests(viewer, id);
  const base = `/admin/clients/${id}`;

  return (
    <>
      <div>
        <Link href="/admin" className="text-accent hover:underline">
          ← Clients
        </Link>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight">{client.name}</h1>
        <p className="text-[15px] text-muted">{[client.planName, client.websiteUrl].filter(Boolean).join(" · ") || "No plan set"}</p>
      </div>
      <Tabs
        items={[
          { href: base, label: "Updates", exact: true },
          { href: `${base}/requests`, label: "Requests", badge: requests.filter((r) => r.status === "received").length },
          { href: `${base}/messages`, label: "Messages" },
          { href: `${base}/files`, label: "Files" },
          { href: `${base}/billing`, label: "Billing" },
          { href: `${base}/settings`, label: "Settings" },
        ]}
      />
      {children}
    </>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { getClient } from "@/lib/data/clients";
import { listRequests } from "@/lib/data/requests";
import { countOpenTodos } from "@/lib/data/todos";
import { orNotFound } from "@/lib/page";
import { Tabs } from "@/components/Tabs";
import { buttonClass } from "@/components/ui";

export default async function ClientLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const viewer = await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const client = await orNotFound(getClient(viewer, id));
  const [requests, todoCount] = await Promise.all([listRequests(viewer, id), countOpenTodos(viewer, id)]);
  const base = `/admin/clients/${id}`;

  return (
    <>
      <div>
        <Link href="/admin" className="text-accent hover:underline">
          ← Clients
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-semibold tracking-tight">{client.name}</h1>
            <p className="text-[15px] text-muted">{[client.planName, client.websiteUrl].filter(Boolean).join(" · ") || "No plan set"}</p>
          </div>
          <a href={`${base}/preview`} target="_blank" rel="noopener" className={buttonClass("secondary")}>
            View as client
          </a>
        </div>
      </div>
      <Tabs
        items={[
          { href: base, label: "Updates", exact: true },
          { href: `${base}/requests`, label: "Requests", badge: requests.filter((r) => r.status === "received").length },
          { href: `${base}/todos`, label: "To-dos", badge: todoCount },
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

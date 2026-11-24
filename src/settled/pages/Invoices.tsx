"use client";

import { AnimatePresence, motion } from "motion/react";
import { Bell, Copy, CopyPlus, Download, Ellipsis, ExternalLink, FilePlus, FileText, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { api, errorMessage, qs } from "@/settled/lib/api";
import { day, dueText, money } from "@/settled/lib/format";
import { invalidate, useDebounced, useResource } from "@/settled/lib/hooks";
import type { Invoice } from "@/settled/lib/types";
import { spring } from "@/settled/ui/motion";
import { useToast } from "@/settled/ui/toast";
import { Avatar, Button, ButtonLink, Chips, Empty, ErrorState, ListSkeleton, Menu, PageHead, StatusPill, useCopy } from "@/settled/ui/ui";

type Filter = "all" | "draft" | "open" | "incoming" | "overdue" | "paid" | "void";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "open", label: "Open" },
  { value: "incoming", label: "Incoming" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "void", label: "Void" },
];

const PAGE = 50;

function List() {
  const params = useSearchParams();
  const router = useRouter();
  const status = (params.get("status") as Filter) || "all";
  const [q, setQ] = useState(params.get("q") ?? "");
  const term = useDebounced(q.trim(), 250);
  const [pages, setPages] = useState(1);
  const key = "/portal/invoicing/api/invoices" + qs({ status: status === "all" ? undefined : status, q: term, limit: PAGE * pages });
  const res = useResource<{ invoices: Invoice[]; total: number }>(key, { poll: 30_000 });

  const setStatus = (v: Filter) => {
    setPages(1);
    router.replace("/portal/invoicing/invoices" + qs({ status: v === "all" ? undefined : v }), { scroll: false });
  };

  const list = res.data?.invoices;

  return (
    <>
      <PageHead
        title="Invoices"
        sub={res.data ? `${res.data.total} ${status === "all" ? "in total" : FILTERS.find((f) => f.value === status)?.label.toLowerCase()}` : " "}
        actions={
          <ButtonLink href="/portal/invoicing/invoices/new" variant="primary" icon={<FilePlus />}>
            New invoice
          </ButtonLink>
        }
      />
      <div className="toolbar">
        <Chips id="inv-filter" label="Filter by status" value={status} onChange={setStatus} items={FILTERS} scroll />
      </div>
      <div className="toolbar">
        <div className="input-wrap">
          <Search />
          <input className="input" type="search" placeholder="Search by number or customer" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search invoices" />
        </div>
      </div>

      <section className="card list-card">
        {res.error && !list ? (
          <ErrorState message={res.error} onRetry={res.reload} />
        ) : !list ? (
          <ListSkeleton rows={8} />
        ) : list.length === 0 ? (
          term ? (
            <Empty icon={<Search />} title="No matches">
              Nothing matches &ldquo;{term}&rdquo;. Try a customer&apos;s name or an invoice number like INV-1042.
            </Empty>
          ) : (
            <Empty
              icon={<FileText />}
              title={status === "all" ? "No invoices yet" : status === "overdue" ? "Nothing overdue" : status === "paid" ? "Nothing paid yet" : "Nothing here"}
              action={
                status === "all" ? (
                  <ButtonLink href="/portal/invoicing/invoices/new" variant="primary" icon={<FilePlus />}>
                    Create your first invoice
                  </ButtonLink>
                ) : undefined
              }
            >
              {status === "all" ? "Send one in under a minute. When they pay, it marks itself paid." : status === "overdue" ? "Everyone is paid up or not due yet. Nice." : "Invoices in this state will show up here."}
            </Empty>
          )
        ) : (
          <>
            <div className="inv-head" aria-hidden>
              <span>Invoice</span>
              <span>Customer</span>
              <span>Due</span>
              <span>Status</span>
              <span className="r">Amount</span>
              <span />
            </div>
            <motion.ul className="list" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.025 } } }}>
              <AnimatePresence initial={false}>
                {list.map((inv) => (
                  <motion.li
                    key={inv.id}
                    layout
                    variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                    exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={spring}
                  >
                    <InvoiceRow inv={inv} onChanged={() => invalidate("/portal/invoicing/api/invoices", "/portal/invoicing/api/activity")} />
                  </motion.li>
                ))}
              </AnimatePresence>
            </motion.ul>
            {res.data && res.data.total > list.length ? (
              <div style={{ padding: 16, textAlign: "center", borderTop: "1px solid var(--border)" }}>
                <Button onClick={() => setPages((p) => p + 1)}>Show more</Button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}

function InvoiceRow({ inv, onChanged }: { inv: Invoice; onChanged: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const { copy } = useCopy();
  const open = inv.state === "sent" && inv.balanceCents > 0;
  const amount = open ? inv.balanceCents : inv.totalCents;

  const remind = async () => {
    try {
      await api.post(`/portal/invoicing/api/invoices/${inv.id}/remind`);
      toast.good(`Reminder sent to ${inv.customerName}`);
      onChanged();
    } catch (e) {
      toast.bad(errorMessage(e));
    }
  };
  const duplicate = async () => {
    try {
      const d = await api.post<Invoice>(`/portal/invoicing/api/invoices/${inv.id}/duplicate`);
      onChanged();
      router.push("/portal/invoicing/invoices/new?id=" + d.id);
    } catch (e) {
      toast.bad(errorMessage(e));
    }
  };

  return (
    <div className="inv-row">
      <Link href={"/portal/invoicing/invoices/" + inv.id} className="inv-link" aria-label={`${inv.number}, ${inv.customerName}, ${money(amount, inv.currency)}`}>
        <span className="inv-num">
          <span className="bold">{inv.number}</span>
          <span className="tiny faint inv-sub-name">{inv.customerName}</span>
        </span>
        <span className="inv-cust">
          <Avatar name={inv.customerName} size="sm" />
          <span className="ellipsis">{inv.customerName}</span>
        </span>
        <span className={"inv-due small" + (inv.status === "overdue" ? " late-text" : " muted")}>
          {inv.state === "draft" ? "Not sent" : inv.state === "paid" ? "Paid " + (inv.paidAt ? day(new Date(inv.paidAt).toISOString().slice(0, 10)) : "") : inv.state === "void" ? "Void" : dueText(inv.dueOn, inv.daysOverdue)}
        </span>
        <span className="inv-status">
          <StatusPill status={inv.status} />
        </span>
        <span className="inv-amt num">
          {money(amount, inv.currency)}
          {open && inv.paidCents > 0 ? <span className="tiny faint" style={{ display: "block", fontWeight: 500 }}>of {money(inv.totalCents, inv.currency)}</span> : null}
        </span>
      </Link>
      <div className="inv-actions">
        <Menu
          trigger={({ toggle, ref, open: o }) => (
            <button ref={ref} type="button" className="btn btn-ghost btn-icon btn-sm" onClick={toggle} aria-label={`Actions for ${inv.number}`} aria-haspopup="menu" aria-expanded={o}>
              <Ellipsis />
            </button>
          )}
        >
          {(close) => (
            <>
              <Link className="menu-item" role="menuitem" href={"/portal/invoicing/invoices/" + inv.id} onClick={close}>
                <ExternalLink /> Open
              </Link>
              {inv.state !== "draft" ? (
                <button
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    copy(window.location.origin + "/pay/" + inv.payToken);
                    toast.good("Pay link copied");
                    close();
                  }}
                >
                  <Copy /> Copy pay link
                </button>
              ) : null}
              {open && inv.status !== "incoming" ? (
                <button
                  className="menu-item"
                  role="menuitem"
                  onClick={() => {
                    close();
                    remind();
                  }}
                >
                  <Bell /> Send a reminder
                </button>
              ) : null}
              <button
                className="menu-item"
                role="menuitem"
                onClick={() => {
                  close();
                  duplicate();
                }}
              >
                <CopyPlus /> Duplicate
              </button>
              <a className="menu-item" role="menuitem" href={`/portal/invoicing/api/invoices/${inv.id}/pdf?download=1`} onClick={close}>
                <Download /> Download PDF
              </a>
            </>
          )}
        </Menu>
      </div>
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense>
      <List />
    </Suspense>
  );
}

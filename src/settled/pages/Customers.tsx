"use client";

import { AnimatePresence, motion } from "motion/react";
import { Search, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, errorMessage, qs } from "@/settled/lib/api";
import { ago, money } from "@/settled/lib/format";
import { invalidate, useDebounced, useResource } from "@/settled/lib/hooks";
import type { Customer, CustomerWithBalance } from "@/settled/lib/types";
import { spring } from "@/settled/ui/motion";
import { useToast } from "@/settled/ui/toast";
import { Avatar, Button, Dialog, Empty, ErrorState, Input, ListSkeleton, PageHead } from "@/settled/ui/ui";

function List() {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState("");
  const term = useDebounced(q.trim(), 200);
  const res = useResource<{ customers: CustomerWithBalance[] }>("/portal/invoicing/api/customers" + qs({ q: term }));
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (params.get("new") === "1") {
      setAdding(true);
      router.replace("/portal/invoicing/customers", { scroll: false });
    }
  }, [params, router]);

  const list = res.data?.customers;
  const owed = list?.reduce((s, c) => s + c.balanceCents, 0) ?? 0;

  return (
    <>
      <PageHead
        title="Customers"
        sub={list ? `${list.length} ${list.length === 1 ? "customer" : "customers"}${owed ? " · " + money(owed) + " owing" : ""}` : " "}
        actions={
          <Button variant="primary" icon={<UserPlus />} onClick={() => setAdding(true)}>
            Add customer
          </Button>
        }
      />
      <div className="toolbar">
        <div className="input-wrap">
          <Search />
          <input className="input" type="search" placeholder="Search names, emails, companies" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search customers" />
        </div>
      </div>
      <section className="card list-card">
        {res.error && !list ? (
          <ErrorState message={res.error} onRetry={res.reload} />
        ) : !list ? (
          <ListSkeleton />
        ) : list.length === 0 ? (
          term ? (
            <Empty icon={<Search />} title="No matches">
              Nobody matches &ldquo;{term}&rdquo;. Settled also searches the names their payments have come from.
            </Empty>
          ) : (
            <Empty
              icon={<Users />}
              title="No customers yet"
              action={
                <Button variant="primary" icon={<UserPlus />} onClick={() => setAdding(true)}>
                  Add your first customer
                </Button>
              }
            >
              Add them one at a time, or import a CSV from QuickBooks, Wave or a spreadsheet in Setup.
            </Empty>
          )
        ) : (
          <motion.ul className="list" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.03 } } }}>
            <AnimatePresence initial={false}>
              {list.map((c) => (
                <motion.li key={c.id} layout variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }} transition={spring}>
                  <Link href={"/portal/invoicing/customers/" + c.id} className="list-row">
                    <Avatar name={c.name} />
                    <span className="cell-main">
                      <span className="cell-title" style={{ display: "block" }}>
                        {c.name}
                        {c.company && c.company !== c.name ? <span className="faint" style={{ fontWeight: 400 }}> · {c.company}</span> : null}
                      </span>
                      <span className="cell-sub" style={{ display: "block" }}>
                        {c.openInvoices ? `${c.openInvoices} open` : "Nothing open"}
                        {c.lastPaidAt ? " · last paid " + ago(c.lastPaidAt) : ""}
                        {c.email ? <span className="hide-sm"> · {c.email}</span> : null}
                      </span>
                    </span>
                    <span style={{ textAlign: "right" }}>
                      <span className="cell-amount" style={{ display: "block", color: c.balanceCents ? undefined : "var(--text-3)" }}>
                        {c.balanceCents ? money(c.balanceCents) : "Paid up"}
                      </span>
                      {c.overdueCents ? <span className="tiny late-text num">{money(c.overdueCents)} overdue</span> : null}
                    </span>
                  </Link>
                </motion.li>
              ))}
            </AnimatePresence>
          </motion.ul>
        )}
      </section>
      <AddCustomer open={adding} onClose={() => setAdding(false)} onDone={(c) => router.push("/portal/invoicing/customers/" + c.id)} />
    </>
  );
}

function AddCustomer({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (c: Customer) => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: "", company: "", email: "", phone: "", address: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setF({ name: "", company: "", email: "", phone: "", address: "" });
      setError(null);
    }
  }, [open]);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const c = await api.post<Customer>("/portal/invoicing/api/customers", f);
      invalidate("/portal/invoicing/api/customers", "/portal/invoicing/api/me");
      toast.good(`${c.name} added`);
      onClose();
      onDone(c);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a customer"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" busy={busy} onClick={() => submit()}>
            Add customer
          </Button>
        </>
      }
    >
      <form className="stack" onSubmit={submit}>
        <div className="row-fields">
          <Input label="Name" value={f.name} onChange={set("name")} autoComplete="off" />
          <Input label="Company" value={f.company} onChange={set("company")} hint="Optional" autoComplete="off" />
        </div>
        <div className="row-fields">
          <Input label="Email" type="email" value={f.email} onChange={set("email")} hint="Invoices and reminders go here" autoComplete="off" />
          <Input label="Phone" type="tel" value={f.phone} onChange={set("phone")} autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="ac-addr">Address</label>
          <textarea id="ac-addr" className="textarea" rows={2} value={f.address} onChange={set("address")} />
        </div>
        {error ? (
          <div className="notice notice-danger" role="alert">
            {error}
          </div>
        ) : null}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

export default function CustomersPage() {
  return (
    <Suspense>
      <List />
    </Suspense>
  );
}

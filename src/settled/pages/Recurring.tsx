"use client";

import { AnimatePresence, motion } from "motion/react";
import { CalendarClock, Pause, Pencil, Play, Plus, Repeat, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/settled/lib/api";
import { dayLong, EVERY_LABEL, money, todayStr } from "@/settled/lib/format";
import { invalidate, setCached, useResource } from "@/settled/lib/hooks";
import type { Every, Recurring, SettingsOut } from "@/settled/lib/types";
import { spring } from "@/settled/ui/motion";
import { useToast } from "@/settled/ui/toast";
import { Avatar, Button, Dialog, Empty, ErrorState, Field, ListSkeleton, PageHead, Pill, Switch } from "@/settled/ui/ui";
import { CustomerPicker } from "@/settled/parts/CustomerPicker";
import { LineItems, newRow, rowsFromItems, rowsToItems, totalsOf, type Row } from "@/settled/parts/LineItems";

const KEY = "/portal/invoicing/api/recurring";

export default function RecurringPage() {
  const toast = useToast();
  const res = useResource<{ recurring: Recurring[] }>(KEY);
  const settings = useResource<SettingsOut>("/portal/invoicing/api/settings");
  const [editing, setEditing] = useState<Recurring | "new" | null>(null);
  const [deleting, setDeleting] = useState<Recurring | null>(null);
  const taxRate = settings.data?.settings.taxRate ?? 0;

  const toggle = async (r: Recurring) => {
    setCached<{ recurring: Recurring[] }>(KEY, (p) => ({ recurring: (p?.recurring ?? []).map((x) => (x.id === r.id ? { ...x, paused: !x.paused } : x)) }));
    try {
      await api.patch(`${KEY}/${r.id}`, { paused: !r.paused });
      toast.good(r.paused ? "Running again" : "Paused. Nothing goes out until you resume it.");
    } catch (e) {
      toast.bad(errorMessage(e));
    }
    res.reload();
  };

  const remove = async () => {
    if (!deleting) return;
    const r = deleting;
    setDeleting(null);
    setCached<{ recurring: Recurring[] }>(KEY, (p) => ({ recurring: (p?.recurring ?? []).filter((x) => x.id !== r.id) }));
    try {
      await api.del(`${KEY}/${r.id}`);
      toast.good("Schedule deleted. Invoices it already made are kept.");
    } catch (e) {
      toast.bad(errorMessage(e));
      res.reload();
    }
  };

  const list = res.data?.recurring;

  return (
    <>
      <PageHead
        title="Recurring"
        sub="Invoices that send themselves, on schedule"
        actions={
          <Button variant="primary" icon={<Plus />} onClick={() => setEditing("new")}>
            New schedule
          </Button>
        }
      />
      <section className="card list-card">
        {res.error && !list ? (
          <ErrorState message={res.error} onRetry={res.reload} />
        ) : !list ? (
          <ListSkeleton rows={3} />
        ) : list.length === 0 ? (
          <Empty
            icon={<Repeat />}
            title="Nothing on repeat yet"
            action={
              <Button variant="primary" icon={<Plus />} onClick={() => setEditing("new")}>
                Set one up
              </Button>
            }
          >
            A monthly retainer or a weekly cleaning. On the day, Settled makes the invoice and emails it, so nobody has to remember on the 1st.
          </Empty>
        ) : (
          <ul className="list">
            <AnimatePresence initial={false}>
              {list.map((r) => {
                const t = totalsOf(rowsFromItems(r.items), taxRate);
                return (
                  <motion.li key={r.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: r.paused ? 0.62 : 1, y: 0 }} exit={{ opacity: 0, x: -20 }} transition={spring}>
                    <div className="list-row rec-row">
                      <Avatar name={r.customerName} />
                      <span className="cell-main">
                        <span className="cell-title" style={{ display: "block" }}>
                          {r.customerName}
                          <span className="faint" style={{ fontWeight: 400 }}>
                            {" "}
                            · {r.items.map((i) => i.description).filter(Boolean).join(", ") || "No description"}
                          </span>
                        </span>
                        <span className="cell-sub" style={{ display: "block" }}>
                          <CalendarClock style={{ display: "inline", width: 13, height: 13, verticalAlign: -2 }} /> {EVERY_LABEL[r.every]} ·{" "}
                          {r.paused ? "Paused" : "Next " + dayLong(r.nextOn)}
                          {r.autoSend ? "" : " · made as a draft"}
                        </span>
                      </span>
                      {r.paused ? <Pill tone="neutral">Paused</Pill> : null}
                      <span className="cell-amount">{money(t.total)}</span>
                      <div className="hstack" style={{ gap: 2 }}>
                        <Button size="sm" variant="ghost" iconOnly onClick={() => toggle(r)} aria-label={r.paused ? "Resume" : "Pause"} title={r.paused ? "Resume" : "Pause"}>
                          {r.paused ? <Play /> : <Pause />}
                        </Button>
                        <Button size="sm" variant="ghost" iconOnly onClick={() => setEditing(r)} aria-label="Edit" title="Edit">
                          <Pencil />
                        </Button>
                        <Button size="sm" variant="ghost" iconOnly onClick={() => setDeleting(r)} aria-label="Delete" title="Delete">
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </section>

      <ScheduleDialog
        open={!!editing}
        rec={editing === "new" ? null : editing}
        onClose={() => setEditing(null)}
        onSaved={() => invalidate(KEY)}
        taxRate={taxRate}
        taxLabel={settings.data?.settings.taxLabel ?? "Tax"}
      />
      <Dialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete this schedule?"
        description="No more invoices will be made from it. The ones already sent stay as they are."
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button variant="danger" icon={<Trash2 />} onClick={remove}>
              Delete
            </Button>
          </>
        }
      />
    </>
  );
}

function ScheduleDialog({ open, rec, onClose, onSaved, taxRate, taxLabel }: { open: boolean; rec: Recurring | null; onClose: () => void; onSaved: () => void; taxRate: number; taxLabel: string }) {
  const toast = useToast();
  const [customer, setCustomer] = useState<{ id: string; name: string; email: string } | null>(null);
  const [rows, setRows] = useState<Row[]>([newRow()]);
  const [every, setEvery] = useState<Every>("month");
  const [nextOn, setNextOn] = useState(todayStr());
  const [autoSend, setAutoSend] = useState(true);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (rec) {
      setCustomer({ id: rec.customerId, name: rec.customerName, email: "" });
      setRows(rowsFromItems(rec.items));
      setEvery(rec.every);
      setNextOn(rec.nextOn);
      setAutoSend(rec.autoSend);
      setNotes(rec.notes);
    } else {
      setCustomer(null);
      setRows([newRow()]);
      setEvery("month");
      setNextOn(todayStr());
      setAutoSend(true);
      setNotes("");
    }
  }, [open, rec]);

  const save = async () => {
    if (!customer) return setError("Pick who to bill.");
    const items = rowsToItems(rows);
    if (!items.length) return setError("Add at least one line.");
    setBusy(true);
    setError(null);
    try {
      const body = { customerId: customer.id, items, every, nextOn, autoSend, notes };
      if (rec) await api.patch(`${KEY}/${rec.id}`, body);
      else await api.post(KEY, body);
      toast.good(rec ? "Schedule saved" : `Set. The first one goes out ${dayLong(nextOn)}.`);
      onSaved();
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title={rec ? "Edit schedule" : "New recurring invoice"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" busy={busy} onClick={save}>
            {rec ? "Save" : "Start schedule"}
          </Button>
        </>
      }
    >
      <div className="stack">
        <Field label="Bill to">
          <CustomerPicker value={customer?.id ?? null} onChange={setCustomer} />
        </Field>
        <LineItems rows={rows} setRows={setRows} taxRate={taxRate} taxLabel={taxLabel} />
        <div className="row-fields">
          <Field label="How often" htmlFor="rec-every">
            <select id="rec-every" className="select" value={every} onChange={(e) => setEvery(e.target.value as Every)}>
              {Object.entries(EVERY_LABEL).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label={rec ? "Next invoice" : "First invoice"} htmlFor="rec-next">
            <input id="rec-next" type="date" className="input" value={nextOn} onChange={(e) => setNextOn(e.target.value)} />
          </Field>
        </div>
        <div className="switch-row">
          <div>
            <div className="bold small">Email it automatically</div>
            <div className="tiny faint">Off makes a draft for you to check and send.</div>
          </div>
          <Switch checked={autoSend} onChange={setAutoSend} label="Email it automatically" />
        </div>
        <Field label="Notes" htmlFor="rec-notes" hint="Printed on each invoice.">
          <textarea id="rec-notes" className="textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error ? (
          <div className="notice notice-danger" role="alert">
            {error}
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}

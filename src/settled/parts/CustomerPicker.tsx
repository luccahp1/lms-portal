"use client";

import { AnimatePresence, motion } from "motion/react";
import { Check, ChevronDown, Search, UserPlus } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { api, errorMessage } from "@/settled/lib/api";
import { money } from "@/settled/lib/format";
import { invalidate, useResource } from "@/settled/lib/hooks";
import type { Customer, CustomerWithBalance } from "@/settled/lib/types";
import { Avatar, Button, Input } from "@/settled/ui/ui";

/**
 * Pick a customer by typing, or add a new one without leaving the page.
 * Keyboard: type to filter, arrows to move, Enter to choose.
 */
export function CustomerPicker({ value, onChange, autoFocus }: { value: string | null; onChange: (c: { id: string; name: string; email: string } | null) => void; autoFocus?: boolean }) {
  const list = useResource<{ customers: CustomerWithBalance[] }>("/portal/invoicing/api/customers");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(0);
  const [adding, setAdding] = useState<null | { name: string; email: string }>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const lid = useId();

  const all = useMemo(() => list.data?.customers ?? [], [list.data]);
  const chosen = all.find((c) => c.id === value);
  const matches = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (t ? all.filter((c) => [c.name, c.company, c.email].join(" ").toLowerCase().includes(t)) : all).slice(0, 8);
  }, [all, q]);
  const showAdd = q.trim().length > 0 && !all.some((c) => c.name.toLowerCase() === q.trim().toLowerCase());
  const options = matches.length + (showAdd ? 1 : 0);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);
  useEffect(() => setSel(0), [q]);

  const pick = (c: { id: string; name: string; email: string }) => {
    onChange(c);
    setQ("");
    setOpen(false);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setSel((s) => Math.min(options - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!list.data) return; // still loading: never guess "new customer"
      if (sel < matches.length) pick(matches[sel]);
      else if (showAdd) setAdding({ name: q.trim(), email: "" });
    } else if (e.key === "Escape") setOpen(false);
  };

  const create = async () => {
    if (!adding) return;
    setBusy(true);
    setErr(null);
    try {
      const c = await api.post<Customer>("/portal/invoicing/api/customers", adding);
      invalidate("/portal/invoicing/api/customers");
      setAdding(null);
      pick({ id: c.id, name: c.name, email: c.email });
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (adding) {
    return (
      <motion.div className="cp-new" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
        <div className="hstack" style={{ marginBottom: 12 }}>
          <UserPlus style={{ width: 18, height: 18, color: "var(--primary-text)" }} />
          <span className="bold">New customer</span>
        </div>
        <div className="row-fields">
          <Input label="Name" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} autoFocus />
          <Input
            label="Email"
            type="email"
            value={adding.email}
            onChange={(e) => setAdding({ ...adding, email: e.target.value })}
            hint="Where the invoice goes"
            error={err}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                create();
              }
            }}
          />
        </div>
        <div className="hstack" style={{ marginTop: 12 }}>
          <Button variant="primary" size="sm" onClick={create} busy={busy}>
            Add customer
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>
            Cancel
          </Button>
        </div>
      </motion.div>
    );
  }

  if (chosen && !open) {
    return (
      <button type="button" className="cp-chosen" onClick={() => setOpen(true)} aria-label={`Customer: ${chosen.name}. Change`}>
        <Avatar name={chosen.name} />
        <span className="grow" style={{ textAlign: "left" }}>
          <span className="bold" style={{ display: "block" }}>
            {chosen.name}
          </span>
          <span className="small faint">{chosen.email || "No email yet"}</span>
        </span>
        {chosen.balanceCents > 0 ? <span className="small muted num">Owes {money(chosen.balanceCents)}</span> : null}
        <span className="small link">Change</span>
      </button>
    );
  }

  return (
    <div className="cp" ref={box}>
      <div className="input-wrap">
        <Search />
        <input
          className="input"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder="Search customers or type a new name"
          role="combobox"
          aria-expanded={open}
          aria-controls={lid}
          aria-label="Customer"
          aria-activedescendant={open ? `${lid}-${sel}` : undefined}
          autoFocus={autoFocus}
          autoComplete="off"
          style={{ paddingRight: 36 }}
        />
        <ChevronDown style={{ position: "absolute", right: 12, left: "auto", width: 16, height: 16, color: "var(--text-3)", pointerEvents: "none" }} />
      </div>
      <AnimatePresence>
        {open && options > 0 ? (
          <motion.ul
            id={lid}
            role="listbox"
            className="cp-list"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.1 } }}
            transition={{ duration: 0.14 }}
          >
            {matches.map((c, i) => (
              <li
                key={c.id}
                id={`${lid}-${i}`}
                role="option"
                aria-selected={i === sel}
                className="cp-opt"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(c)}
                onMouseMove={() => setSel(i)}
              >
                <Avatar name={c.name} size="sm" />
                <span className="grow ellipsis">
                  {c.name}
                  {c.email ? <span className="faint small"> · {c.email}</span> : null}
                </span>
                {c.id === value ? <Check style={{ width: 16, height: 16, color: "var(--primary-text)" }} /> : null}
              </li>
            ))}
            {showAdd ? (
              <li
                id={`${lid}-${matches.length}`}
                role="option"
                aria-selected={sel === matches.length}
                className="cp-opt cp-add"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setAdding({ name: q.trim(), email: "" })}
                onMouseMove={() => setSel(matches.length)}
              >
                <span className="ico" style={{ ["--ic" as string]: "var(--primary-text)", width: 28, height: 28 }}>
                  <UserPlus />
                </span>
                <span>
                  Add <strong>{q.trim()}</strong> as a new customer
                </span>
              </li>
            ) : null}
          </motion.ul>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

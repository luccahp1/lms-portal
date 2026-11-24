"use client";

import { AnimatePresence, motion } from "motion/react";
import { CornerDownLeft, FilePlus, FileText, Home, Inbox, ListChecks, Repeat, Search, Settings, Upload, UserPlus, Users, Wallet } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, qs } from "@/settled/lib/api";
import { money } from "@/settled/lib/format";
import { useDebounced } from "@/settled/lib/hooks";
import type { CustomerWithBalance, Invoice } from "@/settled/lib/types";
import { spring } from "@/settled/ui/motion";
import { Avatar, StatusPill, stlLayer } from "@/settled/ui/ui";

interface Item {
  key: string;
  group: string;
  label: string;
  sub?: string;
  href: string;
  icon: React.ReactNode;
  right?: React.ReactNode;
}

const ACTIONS: Item[] = [
  { key: "a-new", group: "Actions", label: "New invoice", href: "/portal/invoicing/invoices/new", icon: <FilePlus /> },
  { key: "a-cust", group: "Actions", label: "Add a customer", href: "/portal/invoicing/customers?new=1", icon: <UserPlus /> },
  { key: "a-pay", group: "Actions", label: "Record a payment", href: "/portal/invoicing/payments?record=1", icon: <Wallet /> },
  { key: "a-bank", group: "Actions", label: "Import a bank statement", href: "/portal/invoicing/payments?import=1", icon: <Upload /> },
  { key: "g-dash", group: "Go to", label: "Dashboard", href: "/portal/invoicing", icon: <Home /> },
  { key: "g-inv", group: "Go to", label: "Invoices", href: "/portal/invoicing/invoices", icon: <FileText /> },
  { key: "g-in", group: "Go to", label: "Money in", href: "/portal/invoicing/inbox", icon: <Inbox /> },
  { key: "g-cus", group: "Go to", label: "Customers", href: "/portal/invoicing/customers", icon: <Users /> },
  { key: "g-pay", group: "Go to", label: "Payments", href: "/portal/invoicing/payments", icon: <Wallet /> },
  { key: "g-rec", group: "Go to", label: "Recurring", href: "/portal/invoicing/recurring", icon: <Repeat /> },
  { key: "g-set", group: "Go to", label: "Setup", href: "/portal/invoicing/setup", icon: <ListChecks /> },
  { key: "g-stg", group: "Go to", label: "Settings", href: "/portal/invoicing/settings", icon: <Settings /> },
];

export function CommandPalette({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate: (href: string) => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [found, setFound] = useState<{ customers: CustomerWithBalance[]; invoices: Invoice[] } | null>(null);
  const [mounted, setMounted] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const term = useDebounced(q.trim(), 150);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) {
      setQ("");
      setSel(0);
      setFound(null);
    }
  }, [open]);

  useEffect(() => {
    if (!term) {
      setFound(null);
      return;
    }
    const ac = new AbortController();
    api
      .get<{ customers: CustomerWithBalance[]; invoices: Invoice[] }>("/portal/invoicing/api/search" + qs({ q: term }), { signal: ac.signal })
      .then(setFound)
      .catch(() => null);
    return () => ac.abort();
  }, [term]);

  const items = useMemo<Item[]>(() => {
    const t = q.trim().toLowerCase();
    const acts = ACTIONS.filter((a) => !t || a.label.toLowerCase().includes(t));
    const inv: Item[] = (found?.invoices ?? []).map((i) => ({
      key: i.id,
      group: "Invoices",
      label: `${i.number} · ${i.customerName}`,
      sub: money(i.totalCents, i.currency),
      href: "/portal/invoicing/invoices/" + i.id,
      icon: <FileText />,
      right: <StatusPill status={i.status} days={i.daysOverdue} />,
    }));
    const cus: Item[] = (found?.customers ?? []).map((c) => ({
      key: c.id,
      group: "Customers",
      label: c.name,
      sub: c.balanceCents ? "Owes " + money(c.balanceCents) : c.email || c.company,
      href: "/portal/invoicing/customers/" + c.id,
      icon: <Avatar name={c.name} size="sm" />,
    }));
    return t ? [...inv, ...cus, ...acts] : acts;
  }, [q, found]);

  useEffect(() => setSel(0), [items.length, q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const go = (it: Item | undefined) => {
    if (!it) return;
    onClose();
    onNavigate(it.href);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(items.length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(items[sel]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!mounted) return null;
  let lastGroup = "";
  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} onClick={onClose} />
          <div className="cmdk-wrap">
            <motion.div
              className="cmdk"
              role="dialog"
              aria-modal="true"
              aria-label="Search and commands"
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98, transition: { duration: 0.12 } }}
              transition={spring}
            >
              <div className="cmdk-input">
                <Search aria-hidden />
                <input
                  ref={input}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={onKey}
                  placeholder="Search invoices and customers, or jump anywhere"
                  aria-label="Search"
                  role="combobox"
                  aria-expanded="true"
                  aria-controls="cmdk-list"
                  aria-activedescendant={items[sel] ? "cmdk-" + items[sel].key : undefined}
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                />
                <span className="kbd">Esc</span>
              </div>
              <div className="cmdk-list" id="cmdk-list" role="listbox" ref={listRef}>
                {items.length === 0 ? (
                  <div className="cmdk-empty">{term && !found ? "Searching…" : `Nothing matches "${q}".`}</div>
                ) : (
                  items.map((it, i) => {
                    const head = it.group !== lastGroup ? (lastGroup = it.group) : null;
                    return (
                      <div key={it.key}>
                        {head ? <div className="cmdk-group">{head}</div> : null}
                        <div
                          id={"cmdk-" + it.key}
                          data-i={i}
                          role="option"
                          aria-selected={i === sel}
                          className="cmdk-item"
                          onMouseMove={() => setSel(i)}
                          onClick={() => go(it)}
                        >
                          {i === sel ? <motion.span className="cmdk-hl" layoutId="cmdk-hl" transition={{ type: "spring", stiffness: 600, damping: 45 }} /> : null}
                          <span className="cmdk-ico">{it.icon}</span>
                          <span className="grow">
                            <span className="ellipsis" style={{ display: "block" }}>
                              {it.label}
                            </span>
                            {it.sub ? <span className="tiny faint">{it.sub}</span> : null}
                          </span>
                          {it.right}
                          {i === sel ? <CornerDownLeft className="cmdk-enter" aria-hidden /> : null}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="cmdk-foot">
                <span>
                  <span className="kbd">↑</span> <span className="kbd">↓</span> to move
                </span>
                <span>
                  <span className="kbd">Enter</span> to open
                </span>
              </div>
            </motion.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>,
    stlLayer(),
  );
}

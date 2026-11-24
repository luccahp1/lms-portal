"use client";

import { MotionConfig, motion } from "motion/react";
import { FilePlus, FileText, Home, Inbox, ListChecks, Repeat, Search, Settings, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useResource } from "@/settled/lib/hooks";
import type { Me, Summary } from "@/settled/lib/types";
import { Num, ProgressRing, spring } from "@/settled/ui/motion";
import { ToastProvider } from "@/settled/ui/toast";
import { CommandPalette } from "./CommandPalette";

/*
  The Invoicing section of the client portal. The portal's own sidebar and band stay around it;
  this adds Settled's section bar (with the Money in count), Ctrl/Cmd+K search, and the providers
  every Settled screen expects. Everything inside renders under .stl for its styles.
*/

interface ShellCtx {
  /** The signed-in portal person (Settled sees the portal as one owner key, so it has no names). */
  person: string;
  me: Me | undefined;
  summary: Summary | undefined;
  openSearch: () => void;
}
const Ctx = createContext<ShellCtx>({ person: "", me: undefined, summary: undefined, openSearch: () => {} });
export const useShell = () => useContext(Ctx);

export const BASE = "/portal/invoicing";
export const SUMMARY_KEY = BASE + "/api/summary";
export const ME_KEY = BASE + "/api/me";

const NAV = [
  { href: BASE, label: "Overview", icon: Home, exact: true },
  { href: BASE + "/invoices", label: "Invoices", icon: FileText },
  { href: BASE + "/inbox", label: "Money in", icon: Inbox, badge: true },
  { href: BASE + "/customers", label: "Customers", icon: Users },
  { href: BASE + "/payments", label: "Payments", icon: Wallet },
  { href: BASE + "/recurring", label: "Recurring", icon: Repeat },
  { href: BASE + "/setup", label: "Setup", icon: ListChecks, setup: true },
  { href: BASE + "/settings", label: "Settings", icon: Settings },
];

function isActive(path: string, href: string, exact?: boolean) {
  return exact ? path === href : path === href || path.startsWith(href + "/");
}

export function Frame({ children, preview, person }: { children: React.ReactNode; preview?: boolean; person: string }) {
  const path = usePathname();
  const router = useRouter();
  const me = useResource<Me>(ME_KEY);
  const summary = useResource<Summary>(SUMMARY_KEY, { poll: 20_000 });
  const [searchOpen, setSearchOpen] = useState(false);
  const bar = useRef<HTMLElement>(null);
  const review = summary.data?.needsReviewCount ?? 0;
  const setupPct = me.data?.setupPercent ?? 100;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Keep the current section in view on phones, where the bar scrolls sideways.
  useEffect(() => {
    bar.current?.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [path]);

  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <Ctx.Provider value={{ person, me: me.data, summary: summary.data, openSearch: () => setSearchOpen(true) }}>
          <div className="stl stl-frame">
            <div className="sbar">
              <nav className="sbar-nav" aria-label="Invoicing" ref={bar}>
                {NAV.map((n) => {
                  const on = isActive(path, n.href, n.exact);
                  return (
                    <Link key={n.href} href={n.href} className="sbar-item" aria-current={on ? "page" : undefined}>
                      {on ? <motion.span className="sbar-active" layoutId="sbar-active" transition={spring} /> : null}
                      <n.icon className="sbar-ico" />
                      <span>{n.label}</span>
                      {n.badge && review > 0 ? (
                        <motion.span className="sbar-badge" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={spring}>
                          <Num value={review} format="int" countUp={false} />
                        </motion.span>
                      ) : null}
                      {n.setup && setupPct < 100 ? (
                        <span className="sbar-ring" title={`Setup ${setupPct}% done`}>
                          <ProgressRing value={setupPct / 100} size={18} stroke={3} />
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
              <div className="sbar-tools">
                <button type="button" className="search-btn sbar-search" onClick={() => setSearchOpen(true)} aria-label="Search invoices and customers">
                  <Search />
                  <span className="sbar-search-t">Search</span>
                  <span className="kbd sbar-kbd">Ctrl K</span>
                </button>
                {!preview ? (
                  <Link href={BASE + "/invoices/new"} className="btn btn-primary btn-sm">
                    <FilePlus /> <span>New invoice</span>
                  </Link>
                ) : null}
              </div>
            </div>
            <div className="stl-body">{children}</div>
          </div>
          <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} onNavigate={(href) => router.push(href)} />
        </Ctx.Provider>
      </ToastProvider>
    </MotionConfig>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function Tabs({ items }: { items: { href: string; label: string; exact?: boolean; badge?: number }[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Client sections" className="flex gap-1 overflow-x-auto border-b border-line">
      {items.map((t) => {
        const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px flex min-h-11 items-center gap-2 border-b-2 px-3 whitespace-nowrap ${
              active ? "border-accent font-semibold text-ink" : "border-transparent font-medium text-muted hover:text-ink"
            }`}
          >
            {t.label}
            {!!t.badge && <span className="rounded-full bg-accent px-2 text-xs font-semibold text-white">{t.badge}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

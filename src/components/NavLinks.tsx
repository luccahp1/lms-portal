"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

export type NavItem = { href: string; label: string; icon: IconName; badge?: number; exact?: boolean };

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-0.5">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-10 flex-[1_1_150px] items-center gap-2.5 rounded-lg px-3 ${
              active ? "bg-subtle font-semibold text-ink" : "font-medium text-[#55555f] hover:bg-subtle/60"
            }`}
          >
            <Icon name={item.icon} />
            <span className="flex-1">{item.label}</span>
            {!!item.badge && (
              <span className="rounded-full bg-accent px-2 text-xs font-semibold text-white">{item.badge}</span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

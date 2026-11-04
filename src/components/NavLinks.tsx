"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "./icons";

export type NavItem = { href: string; label: string; icon: IconName; badge?: number; exact?: boolean };

export function NavLinks({ items, group }: { items: NavItem[]; group?: string }) {
  const pathname = usePathname();
  return (
    <>
      {group && <div className="k-side__grp k-mono">{group}</div>}
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className="k-nav">
            <Icon name={item.icon} />
            <span>{item.label}</span>
            {!!item.badge && <span className="k-nav__badge">{item.badge}</span>}
          </Link>
        );
      })}
    </>
  );
}

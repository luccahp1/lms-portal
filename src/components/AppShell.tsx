import { logout } from "@/app/(auth)/actions";
import { initials } from "@/lib/format";
import { Icon } from "./icons";
import { NavLinks, type NavItem } from "./NavLinks";

export function AppShell({
  agencyName,
  accentColor,
  subtitle,
  identity,
  nav,
  children,
}: {
  agencyName: string;
  accentColor: string;
  subtitle: string;
  identity: { title: string; detail: string };
  nav: NavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-wrap" style={{ "--accent": accentColor } as React.CSSProperties}>
      <nav
        aria-label="Main"
        className="flex flex-[1_1_220px] flex-col gap-5 border-r border-line bg-surface px-4 py-5 md:max-w-[260px]"
      >
        <div className="flex items-center gap-2.5 px-2 py-1">
          <div className="flex size-8 items-center justify-center rounded-lg bg-accent text-[13px] font-bold text-white">
            {initials(agencyName)}
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-semibold">{agencyName}</span>
            <span className="text-xs text-muted">{subtitle}</span>
          </div>
        </div>
        <div className="flex items-center gap-2.5 rounded-[10px] border border-line px-3 py-2.5">
          <div className="flex size-7 items-center justify-center rounded-full bg-subtle text-xs font-semibold text-ink-2">
            {initials(identity.title)}
          </div>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[13px] font-semibold">{identity.title}</span>
            <span className="truncate text-xs text-muted">{identity.detail}</span>
          </div>
        </div>
        <NavLinks items={nav} />
        <form action={logout} className="mt-auto">
          <button
            type="submit"
            className="flex min-h-10 w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 font-medium text-[#55555f] hover:bg-subtle"
          >
            <Icon name="logout" />
            Log out
          </button>
        </form>
      </nav>
      <main className="min-w-0 flex-[999_1_560px] px-4 pt-8 pb-12 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-6">{children}</div>
      </main>
    </div>
  );
}

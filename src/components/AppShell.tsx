import { logout } from "@/app/(auth)/actions";
import { initials } from "@/lib/format";
import { Icon } from "./icons";
import { KitMotion, MenuButton, Scrim, ThemeToggle } from "./KitClient";
import { NavLinks, type NavItem } from "./NavLinks";

/**
 * The same shell as LMS Dash: the dark brand band with the forest rule, the account chip top
 * right, the left nav with its active bar, and the page on a light canvas. Built from src/kit.
 */
export function AppShell({
  agencyName,
  subtitle,
  identity,
  nav,
  banner,
  dashboardUrl,
  children,
}: {
  agencyName: string;
  /** Kept for the admin layout; the kit colours come from the shared tokens. */
  accentColor?: string;
  subtitle: string;
  identity: { title: string; detail: string };
  nav: NavItem[];
  /** Shown above the page, e.g. the "View as client" notice. */
  banner?: React.ReactNode;
  /** The client's own job dashboard, when they have one: an "Open your dashboard" link in the nav. */
  dashboardUrl?: string | null;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="k-band">
        <MenuButton />
        <a className="k-brand" href="/portal" aria-label={`${agencyName} home`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mark.svg" alt="" width={30} height={31} />
          <span className="k-brand__text">
            <span className="k-brand__wm">{agencyName}</span>
            <span className="k-brand__sub">{subtitle}</span>
          </span>
        </a>
        <span className="k-band__sp" />
        <span className="k-live" id="live" title="Updates by themselves">
          <i />
          <span>LIVE</span>
        </span>
        <ThemeToggle />
        <div className="k-chip">
          <button type="button" disabled title={identity.detail}>
            <span className="k-av">{initials(identity.title)}</span>
            <span className="k-chip__t">
              <small>Your account</small>
              <span>{identity.title}</span>
            </span>
          </button>
        </div>
      </header>
      <div className="k-shell">
        <nav className="k-side" id="side" aria-label="Main">
          <NavLinks items={nav} group={subtitle === "Client portal" ? "Your portal" : "Agency"} />
          {dashboardUrl && (
            <>
              <div className="k-side__grp k-mono">Your tools</div>
              {/* Another site with its own login, so a plain link in a new tab, not a nav item. */}
              <a href={dashboardUrl} target="_blank" rel="noopener" className="k-nav">
                <Icon name="home" />
                <span>Open your dashboard</span>
              </a>
            </>
          )}
          <div className="k-side__foot">
            <div className="k-side__grp k-mono">Other</div>
            <form action={logout}>
              <button type="submit" className="k-nav">
                <Icon name="logout" />
                <span>Log out</span>
              </button>
            </form>
          </div>
        </nav>
        <Scrim />
        <main className="k-main" id="main">
          <div className="flex flex-col gap-6">
            {banner}
            {children}
          </div>
        </main>
      </div>
      <KitMotion />
    </>
  );
}

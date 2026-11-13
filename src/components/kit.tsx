// React pieces for the shared LMS kit (classes in src/kit/kit.css). Same markup as LMS Dash's
// kCard / kTile / kHead in app/static/client.js, so both apps look and read the same.
import Link from "next/link";
import { charts } from "@/lib/charts";

export type SectionColour = "jay" | "forest" | "violet" | "amber" | "coral";

const ICONS = {
  home: <path d="M3 11 12 4l9 7v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  req: (
    <>
      <path d="M4 5h16v11H8l-4 4z" />
      <path d="M8 9h8M8 12h5" />
    </>
  ),
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />,
  todo: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="m3 6 1.5 1.5L7 5M3 12l1.5 1.5L7 11M3 18l1.5 1.5L7 17" />
    </>
  ),
  report: (
    <>
      <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
      <path d="M14 3v5h5M9 17v-3M12 17v-5M15 17v-2" />
    </>
  ),
  rank: (
    <>
      <path d="M3 17 9 11l4 4 8-8" />
      <path d="M15 7h6v6" />
    </>
  ),
  file: (
    <>
      <path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <path d="m9 13 2 2 4-4" />
    </>
  ),
  brand: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="8.5" cy="10" r="1.3" />
      <circle cx="12" cy="7.5" r="1.3" />
      <circle cx="15.5" cy="10" r="1.3" />
      <path d="M12 21a2.5 2.5 0 0 1 0-5h1.5a2 2 0 0 0 2-2" />
    </>
  ),
  bill: (
    <>
      <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  web: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5M12 7v5l3 2" />
    </>
  ),
  arrow: <path d="M7 17 17 7M8 7h9v9" />,
  check: <path d="m5 12 5 5 9-10" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
} as const;

export type KitIconName = keyof typeof ICONS;

export function KitIcon({ name, className }: { name: KitIconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}

/** Markup from the chart helpers. It is built from numbers and escaped labels only. */
export function Svg({ html, className }: { html: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** A number that counts up from 0 when it comes into view. */
export function Count({ value, format = "int", suf = "" }: { value: number; format?: "int" | "money" | "cents" | "pct" | "dec1"; suf?: string }) {
  return <span dangerouslySetInnerHTML={{ __html: charts.count(value, { format, suf }) }} />;
}

export function KitHead({
  kicker,
  title,
  sub,
  actions,
}: {
  kicker?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="k-ph">
      <div>
        {kicker && <div className="k-ph__k k-mono">{kicker}</div>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="k-acts">{actions}</div>}
    </header>
  );
}

export function KitCard({
  c = "forest",
  icon,
  title,
  sub,
  span = "k-s6",
  go,
  end,
  children,
  still = false,
}: {
  c?: SectionColour;
  icon: KitIconName;
  title: React.ReactNode;
  sub?: React.ReactNode;
  span?: string;
  go?: string;
  end?: React.ReactNode;
  children?: React.ReactNode;
  still?: boolean;
}) {
  return (
    <section className={`k-card k-c-${c} k-reveal ${span} ${still ? "k-card--still" : ""}`}>
      <div className="k-ch">
        <div className="k-ic">
          <KitIcon name={icon} />
        </div>
        <div className="k-ch__t">
          <h2>{title}</h2>
          {sub && <div className="k-ch__sub">{sub}</div>}
        </div>
        {(end || go) && (
          <div className="k-ch__end">
            {end}
            {go && (
              <Link className="k-go" href={go} aria-label={`Open ${typeof title === "string" ? title : "section"}`}>
                <KitIcon name="arrow" />
              </Link>
            )}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

export function KitTile({ label, children, delta, href }: { label: string; children: React.ReactNode; delta?: React.ReactNode; href?: string }) {
  const inner = (
    <>
      <span className="k-tile__l k-mono">{label}</span>
      <span className="k-tile__v">{children}</span>
      {delta}
    </>
  );
  return href ? (
    <Link className="k-tile" href={href}>
      {inner}
    </Link>
  ) : (
    <div className="k-tile">{inner}</div>
  );
}

export function Delta({ dir = "flat", children }: { dir?: "up" | "down" | "flat"; children: React.ReactNode }) {
  return (
    <span className={`k-tile__d k-${dir}`}>
      {dir === "up" ? "↗" : dir === "down" ? "↘" : "→"} {children}
    </span>
  );
}

/** Change against an earlier number, worded the same way as LMS Dash. */
export function Change({ cur, prev, than }: { cur: number; prev: number | null; than?: string }) {
  if (prev === null) return null;
  const d = cur - prev;
  if (!d) return <Delta>same{than ? ` as ${than}` : ""}</Delta>;
  const p = prev ? Math.round((Math.abs(d) / prev) * 100) : 0;
  return (
    <Delta dir={d > 0 ? "up" : "down"}>
      {p && prev >= 5 ? `${p}%` : Math.abs(d)} {d > 0 ? "more" : "fewer"}
      {than ? ` than ${than}` : ""}
    </Delta>
  );
}

export type PillTone = "good" | "warn" | "bad" | "jay" | "violet" | "mute";

export function KitPill({ tone = "mute", children }: { tone?: PillTone; children: React.ReactNode }) {
  return <span className={`k-pill k-pill--${tone}`}>{children}</span>;
}

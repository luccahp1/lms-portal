import { formatDate } from "@/lib/format";

// Small pieces shared by Home, Reports and Rankings. Plain server components, inline SVG.

export function ChangeBadge({ value, invert = false, label }: { value: number | null; invert?: boolean; label?: string }) {
  if (value === null) return <span className="text-[13px] text-muted">Nothing earlier to compare with yet</span>;
  const good = invert ? value < 0 : value > 0;
  const flat = value === 0;
  const tone = flat ? "bg-subtle text-ink-2" : good ? "bg-good-bg text-good" : "bg-warn-bg text-warn";
  const arrow = flat ? "" : value > 0 ? "▲ " : "▼ ";
  return (
    <span className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
        {arrow}
        {value > 0 ? "+" : ""}
        {value}%
      </span>
      {label}
    </span>
  );
}

export function StatTile({
  label,
  value,
  change,
  changeLabel,
}: {
  label: string;
  value: string;
  change?: number | null;
  changeLabel?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-surface p-5">
      <span className="text-[13px] font-medium text-muted">{label}</span>
      <span className="text-[26px] font-semibold tracking-tight">{value}</span>
      {change !== undefined && <ChangeBadge value={change} label={changeLabel} />}
    </div>
  );
}

/** Daily bars: visits, with leads marked as dots on top. */
export function DailyChart({ series }: { series: { day: string; visits: number; leads: number }[] }) {
  const max = Math.max(1, ...series.map((d) => d.visits));
  const w = 720;
  const h = 160;
  const pad = { top: 12, bottom: 22, left: 4, right: 4 };
  const bw = (w - pad.left - pad.right) / Math.max(series.length, 1);
  const y = (v: number) => pad.top + (h - pad.top - pad.bottom) * (1 - v / max);
  const ticks = series.filter((_, i) => i === 0 || i === series.length - 1 || i % 7 === 0);
  return (
    <figure className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-40 w-full" role="img" aria-label="Visits per day">
        <line x1={pad.left} x2={w - pad.right} y1={h - pad.bottom} y2={h - pad.bottom} stroke="var(--color-line-strong)" />
        {series.map((d, i) => {
          const x = pad.left + i * bw;
          return (
            <g key={d.day}>
              <title>{`${formatDate(d.day)}: ${d.visits} visits${d.leads ? `, ${d.leads} leads` : ""}`}</title>
              <rect
                x={x + bw * 0.15}
                y={y(d.visits)}
                width={bw * 0.7}
                height={Math.max(0, h - pad.bottom - y(d.visits))}
                rx={2}
                fill="var(--accent)"
                opacity={0.85}
              />
              {d.leads > 0 && <circle cx={x + bw / 2} cy={y(d.visits) - 6} r={3.5} fill="var(--color-good)" />}
            </g>
          );
        })}
        {ticks.map((d) => {
          const i = series.indexOf(d);
          return (
            <text key={d.day} x={pad.left + i * bw + bw / 2} y={h - 6} textAnchor="middle" fontSize="11" fill="var(--color-muted)">
              {Number(d.day.slice(8, 10))}
            </text>
          );
        })}
      </svg>
      <figcaption className="flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-accent" /> Visits per day
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full bg-good" /> Day with a call, email or quote request
        </span>
      </figcaption>
    </figure>
  );
}

/** Horizontal bars for a ranked list (sources, pages). */
export function BarList({ rows, unit }: { rows: { name: string; n: number }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.name} className="flex flex-col gap-1">
          <div className="flex justify-between gap-3 text-[14px]">
            <span className="truncate">{r.name}</span>
            <span className="shrink-0 text-muted">
              {r.n} {unit}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-subtle">
            <div className="h-1.5 rounded-full bg-accent" style={{ width: `${(r.n / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function positionText(position: number | null | undefined) {
  if (position === undefined) return "—";
  if (position === null || position === 0 || position > 30) return "Not in top 30";
  return `#${position}`;
}

/** Movement between two positions. Lower is better; 0 means not found. */
export function rankMove(prev: number | undefined, cur: number | undefined) {
  if (prev === undefined || cur === undefined) return null;
  const p = prev || 99;
  const c = cur || 99;
  if (p === c) return { text: "No change", tone: "neutral" as const };
  if (c < p) return { text: prev === 0 ? "New in top 30" : `Up ${p - c}`, tone: "good" as const };
  return { text: cur === 0 ? "Dropped out" : `Down ${c - p}`, tone: "warn" as const };
}

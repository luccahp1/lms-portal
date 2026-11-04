import { formatDate } from "@/lib/format";
import { charts } from "@/lib/charts";
import { Count, Svg } from "@/components/kit";

// Small pieces shared by Home, Reports and Rankings. Plain server components, inline SVG.

export function ChangeBadge({ value, invert = false, label }: { value: number | null; invert?: boolean; label?: string }) {
  if (value === null) return <span className="k-tile__d k-flat">Nothing earlier to compare with yet</span>;
  const good = invert ? value < 0 : value > 0;
  const dir = value === 0 ? "flat" : good ? "up" : "down";
  return (
    <span className={`k-tile__d k-${dir}`}>
      {value === 0 ? "→" : value > 0 ? "↗" : "↘"} {value > 0 ? "+" : ""}
      {value}% {label}
    </span>
  );
}

/** A kit number tile. value is shown as given; pass count to have it count up. */
export function StatTile({
  label,
  value,
  count,
  change,
  changeLabel,
}: {
  label: string;
  value: string;
  count?: number;
  change?: number | null;
  changeLabel?: string;
}) {
  return (
    <div className="k-tile">
      <span className="k-tile__l k-mono">{label}</span>
      <span className="k-tile__v">{count === undefined ? value : <Count value={count} />}</span>
      {change !== undefined && <ChangeBadge value={change} label={changeLabel} />}
    </div>
  );
}

/** Visits a day as the kit's area chart, with leads dashed. */
export function DailyChart({ series }: { series: { day: string; visits: number; leads: number }[] }) {
  const labels = series.map((d, i) => (i === 0 || i === series.length - 1 || i % 7 === 0 ? formatDate(d.day).replace(/, \d{4}$/, "") : ""));
  return (
    <figure className="flex flex-col gap-2">
      <Svg
        html={charts.area(
          series.map((d) => d.visits),
          { h: 170, labels, second: series.map((d) => d.leads), label: "Visits and leads a day" },
        )}
      />
      <figcaption className="k-legend">
        <span>
          <i />
          Visits a day
        </span>
        <span>
          <i className="dash" />
          Calls, emails and quote requests
        </span>
      </figcaption>
    </figure>
  );
}

export function BarList({ rows, unit }: { rows: { name: string; n: number }[]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return <Svg html={charts.bars(rows.map((r) => ({ label: r.name, pct: (r.n / max) * 100, note: `${r.n} ${unit}` })))} />;
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

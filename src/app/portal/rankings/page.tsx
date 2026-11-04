import { requireClient } from "@/lib/auth/session";
import { listRankings } from "@/lib/data/rankings";
import { describeForecast, forecastKeyword, type ForecastPoint, type RankPoint } from "@/lib/forecast";
import { formatMonthKey } from "@/lib/format";
import { Card, CardTitle, Empty, PageHeader, Pill } from "@/components/ui";
import { positionText } from "@/components/features/Results";

export const metadata = { title: "Rankings forecast" };

const MONTHS_AHEAD = 3;
const CHART_MAX = 40;

function short(month: string) {
  return formatMonthKey(month).replace(/ \d{4}$/, "").slice(0, 3);
}

/** Position over time: real months as a solid line, the forecast dashed with its range shaded. */
function ForecastChart({ history, forecast }: { history: RankPoint[]; forecast: ForecastPoint[] }) {
  const w = 360;
  const h = 150;
  const pad = { top: 10, right: 10, bottom: 22, left: 34 };
  const months = [...history.map((p) => p.month), ...forecast.map((p) => p.month)];
  const x = (i: number) => pad.left + ((w - pad.left - pad.right) * i) / Math.max(months.length - 1, 1);
  // Log scale: the gap between #1 and #3 matters as much as #10 to #30.
  const y = (pos: number | null) => {
    const p = pos === null || pos === 0 ? CHART_MAX : Math.min(pos, CHART_MAX);
    return pad.top + ((h - pad.top - pad.bottom) * Math.log(p)) / Math.log(CHART_MAX);
  };
  const real = history.map((p, i) => `${x(i)},${y(p.position)}`).join(" ");
  const lastReal = history.length - 1;
  const ahead = [`${x(lastReal)},${y(history[lastReal]!.position)}`, ...forecast.map((p, i) => `${x(lastReal + 1 + i)},${y(p.likely)}`)].join(" ");
  const band = [
    `${x(lastReal)},${y(history[lastReal]!.position)}`,
    ...forecast.map((p, i) => `${x(lastReal + 1 + i)},${y(p.best)}`),
    ...[...forecast].reverse().map((p, i) => `${x(lastReal + forecast.length - i)},${y(p.worst)}`),
  ].join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label="Position history and forecast">
      {[1, 3, 10, 30].map((t) => (
        <g key={t}>
          <line x1={pad.left} x2={w - pad.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
          <text x={pad.left - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--color-muted)">
            #{t}
          </text>
        </g>
      ))}
      <polygon points={band} fill="var(--accent)" opacity={0.1} />
      <polyline points={ahead} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="5 4" />
      <polyline points={real} fill="none" stroke="var(--accent)" strokeWidth={2.5} />
      {history.map((p, i) => (
        <circle key={p.month} cx={x(i)} cy={y(p.position)} r={3.5} fill="var(--accent)" />
      ))}
      {months.map((m, i) => (
        <text key={m} x={x(i)} y={h - 6} textAnchor="middle" fontSize="10" fill="var(--color-muted)">
          {short(m)}
        </text>
      ))}
    </svg>
  );
}

export default async function RankingsPage() {
  const viewer = await requireClient();
  const rankings = await listRankings(viewer);
  const rows = rankings
    .filter((k) => k.history.length > 0)
    .map((k) => {
      const forecast = forecastKeyword(k.history, MONTHS_AHEAD);
      const current = k.history.at(-1)!.position;
      const end = forecast.at(-1)!;
      return { ...k, forecast, current, end, summary: describeForecast(current, end.likely) };
    });
  // Searches we're found for first, best position first; not found yet at the end.
  rows.sort((a, b) => (a.current || 99) - (b.current || 99));
  const onPageOne = rows.filter((r) => r.end.likely !== null && r.end.likely <= 10).length;
  const nowPageOne = rows.filter((r) => r.current > 0 && r.current <= 10).length;
  const horizon = rows[0]?.end.month;

  return (
    <>
      <PageHeader
        title="Rankings forecast"
        subtitle="Where you show up on Google today, and where we expect you to be over the next few months."
      />

      {rows.length === 0 ? (
        <Card>
          <Empty>We’re setting up the searches we track for you. The forecast appears after the first month of rankings.</Empty>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-surface p-5">
              <span className="text-[13px] font-medium text-muted">On Google’s first page now</span>
              <span className="text-[26px] font-semibold tracking-tight">
                {nowPageOne} <span className="text-base font-normal text-muted">of {rows.length}</span>
              </span>
            </div>
            <div className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-surface p-5">
              <span className="text-[13px] font-medium text-muted">Expected by {horizon ? formatMonthKey(horizon) : "—"}</span>
              <span className="text-[26px] font-semibold tracking-tight">
                {onPageOne} <span className="text-base font-normal text-muted">of {rows.length}</span>
              </span>
            </div>
            <div className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-surface p-5">
              <span className="text-[13px] font-medium text-muted">Months of real data so far</span>
              <span className="text-[26px] font-semibold tracking-tight">{Math.max(...rows.map((r) => r.history.length))}</span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {rows.map((r) => (
              <Card key={r.keyword} className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="font-semibold">{r.keyword}</h2>
                    <p className="text-[13px] text-muted">
                      Now {positionText(r.current)} · {formatMonthKey(r.end.month)}: likely {positionText(r.end.likely)}
                      {r.end.likely !== null && r.end.best !== null && r.end.best !== r.end.likely && ` (range #${r.end.best} to ${positionText(r.end.worst).replace("Not in top 30", "30+")})`}
                    </p>
                  </div>
                  <Pill tone={r.end.likely !== null && (r.current === 0 || r.end.likely < r.current) ? "good" : "neutral"}>{r.summary}</Pill>
                </div>
                <ForecastChart history={r.history} forecast={r.forecast} />
              </Card>
            ))}
          </div>

          <Card>
            <CardTitle>How this forecast works</CardTitle>
            <div className="flex flex-col gap-2 text-[14px] text-ink-2">
              <p>
                It starts from where each search ranks today and how local searches usually move when the website and
                Google profile get steady monthly work: searches on page two tend to climb fastest, the top three move slowly,
                and a search you aren’t found for yet usually takes a few months to break into the top 30.
              </p>
              <p>
                Every month we check your real positions, and the forecast leans more on your own trend as that history
                grows. The shaded band is the likely range.
              </p>
              <p className="text-muted">
                It’s an estimate, not a promise. Google changes its results all the time, and nobody can guarantee a position.
              </p>
            </div>
          </Card>
        </>
      )}
    </>
  );
}

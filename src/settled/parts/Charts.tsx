"use client";

import { motion, useInView } from "motion/react";
import { useRef, useState } from "react";
import { money, moneyCompact, moneyShort, monthLabel } from "@/settled/lib/format";
import { ease } from "@/settled/ui/motion";

/** 12 months of money in. Bars grow in once, left to right; hover or focus shows the value. */
export function MonthlyChart({ data, currency = "CAD" }: { data: { month: string; cents: number }[]; currency?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -60px 0px" });
  const [hover, setHover] = useState<number | null>(null);
  // A floor of $1,000 keeps the scale sensible for a new business.
  const max = Math.max(100_000, ...data.map((d) => d.cents));
  // A rounded top for the scale so gridlines land on friendly numbers.
  const step = niceStep(max / 3);
  const top = Math.max(step * 3, step * Math.ceil(max / step));
  const lines = [0, top / 3, (2 * top) / 3, top];
  const last = data.length - 1;
  const total = data.reduce((s, d) => s + d.cents, 0);

  return (
    <div className="mchart" ref={ref}>
      <div className="mchart-plot" role="img" aria-label={`Money in over the last 12 months, ${money(total, currency)} in total.`}>
        <div className="mchart-grid" aria-hidden>
          {lines
            .slice()
            .reverse()
            .map((v) => (
              <div key={v} className="mchart-line">
                <span>{moneyShort(v, currency)}</span>
              </div>
            ))}
        </div>
        {total === 0 ? <p className="mchart-empty small faint">Money you receive shows up here, month by month.</p> : null}
        <div className="mchart-bars">
          {data.map((d, i) => {
            const h = (d.cents / top) * 100;
            const on = hover === i;
            return (
              <button
                key={d.month}
                type="button"
                className="mchart-col"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${monthLabel(d.month)}: ${money(d.cents, currency)}`}
              >
                <motion.span
                  className={"mchart-bar" + (i === last ? " now" : "")}
                  style={{ height: `${Math.max(d.cents ? 2 : 0, h)}%`, originY: 1 }}
                  initial={{ scaleY: 0 }}
                  animate={inView ? { scaleY: 1 } : { scaleY: 0 }}
                  transition={{ duration: 0.7, ease, delay: 0.05 + i * 0.04 }}
                />
                {on ? (
                  <motion.span className="mchart-tip num" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.14 }} style={{ bottom: `calc(${h}% + 8px)` }}>
                    {money(d.cents, currency)}
                  </motion.span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mchart-x" aria-hidden>
        {data.map((d, i) => (
          <span key={d.month} className={i === last ? "now" : ""}>
            {monthLabel(d.month).slice(0, 3)}
          </span>
        ))}
      </div>
    </div>
  );
}

function niceStep(v: number): number {
  if (v <= 0) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

const AGING_COLORS = ["var(--st-sent)", "var(--st-partial)", "#d9792b", "var(--st-overdue)", "#8f2a1e"];

/** One stacked bar of who owes what by age, with a legend underneath. */
export function AgingBar({ aging, currency = "CAD" }: { aging: { label: string; cents: number; count: number }[]; currency?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const total = aging.reduce((s, a) => s + a.cents, 0);
  return (
    <div ref={ref}>
      <div className="aging" role="img" aria-label={aging.map((a) => `${a.label}: ${money(a.cents, currency)}`).join(", ")}>
        {total === 0 ? <span className="aging-empty" /> : null}
        {aging.map((a, i) =>
          a.cents > 0 ? (
            <motion.span
              key={a.label}
              className="aging-seg"
              style={{ background: AGING_COLORS[i], flexGrow: a.cents, originX: 0 }}
              initial={{ scaleX: 0, opacity: 0 }}
              animate={inView ? { scaleX: 1, opacity: 1 } : {}}
              transition={{ duration: 0.6, ease, delay: 0.1 + i * 0.08 }}
            />
          ) : null,
        )}
      </div>
      <div className="aging-legend">
        {aging.map((a, i) => (
          <div key={a.label} className="aging-key">
            <span className="aging-dot" style={{ background: AGING_COLORS[i] }} />
            <span className="grow">
              <span className="tiny faint" style={{ display: "block" }}>
                {a.label}
              </span>
              <span className="small bold num">{moneyShort(a.cents, currency)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Expected money by week, as small columns. The first is what is already late. */
export function ExpectedBars({ expected, currency = "CAD" }: { expected: { label: string; cents: number }[]; currency?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });
  const max = Math.max(1, ...expected.map((e) => e.cents));
  return (
    <div className="expected" ref={ref}>
      {expected.map((e, i) => (
        <div key={e.label} className="expected-col">
          <span className="tiny bold num" title={money(e.cents, currency)}>{e.cents ? moneyCompact(e.cents) : "–"}</span>
          <div className="expected-track">
            <motion.span
              className={"expected-bar" + (i === 0 ? " late" : "")}
              style={{ height: `${(e.cents / max) * 100}%`, originY: 1 }}
              initial={{ scaleY: 0 }}
              animate={inView ? { scaleY: 1 } : {}}
              transition={{ duration: 0.6, ease, delay: 0.1 + i * 0.06 }}
            />
          </div>
          <span className="tiny faint expected-label">{e.label}</span>
        </div>
      ))}
    </div>
  );
}

"use client";

/* Motion building blocks shared by every page: springs, count-ups, the drawn check. */

import { animate, motion, useInView, useReducedMotion, type Transition } from "motion/react";
import { useEffect, useRef } from "react";
import { money, moneyShort } from "@/settled/lib/format";

export const spring: Transition = { type: "spring", stiffness: 420, damping: 36, mass: 0.9 };
export const springSoft: Transition = { type: "spring", stiffness: 260, damping: 30 };
export const ease = [0.22, 1, 0.36, 1] as const;

/** Fade and rise; used for page sections and list items. */
export const rise = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease } },
};

export const stagger = (gap = 0.04, delay = 0) => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

type Fmt = "money" | "moneyShort" | "int" | "decimal1" | "percent";

function fmt(v: number, kind: Fmt, currency: string): string {
  switch (kind) {
    case "money":
      return money(Math.round(v), currency);
    case "moneyShort":
      return moneyShort(Math.round(v), currency);
    case "decimal1":
      return v.toFixed(1);
    case "percent":
      return Math.round(v * 100) + "%";
    default:
      return Math.round(v).toLocaleString("en-CA");
  }
}

/**
 * A number that counts up the first time it is seen and tweens when it
 * changes. It writes straight to the DOM, so a tween never re-renders React.
 * Tabular figures keep the width steady while it moves.
 */
export function Num({
  value,
  format = "money",
  currency = "CAD",
  countUp = true,
  duration = 0.9,
  className,
}: {
  value: number;
  format?: Fmt;
  currency?: string;
  countUp?: boolean;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (shown.current === null && !inView && countUp && !reduce) return;
    const from = shown.current ?? (countUp && !reduce ? 0 : value);
    if (reduce || from === value) {
      shown.current = value;
      el.textContent = fmt(value, format, currency);
      return;
    }
    const c = animate(from, value, {
      duration: shown.current === null ? duration : 0.6,
      ease,
      onUpdate: (v) => {
        shown.current = v;
        el.textContent = fmt(v, format, currency);
      },
      onComplete: () => {
        shown.current = value;
      },
    });
    return () => c.stop();
  }, [value, format, currency, inView, countUp, reduce, duration]);

  return (
    <span ref={ref} className={"num " + (className ?? "")}>
      {fmt(countUp && !reduce ? 0 : value, format, currency)}
    </span>
  );
}

/** A check mark that draws itself. */
export function CheckDraw({ size = 14, stroke = 2.6, delay = 0, play = true }: { size?: number; stroke?: number; delay?: number; play?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <motion.path
        d="M4.5 12.5l5 5L19.5 7"
        stroke="currentColor"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={play ? { pathLength: 0, opacity: 0 } : false}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ pathLength: { duration: 0.42, ease, delay }, opacity: { duration: 0.1, delay } }}
      />
    </svg>
  );
}

/** A ring that fills to `value` (0..1). */
export function ProgressRing({ value, size = 64, stroke = 7, children }: { value: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flex: "none" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }} aria-hidden>
        <circle className="ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} fill="none" />
        <motion.circle
          className="ring-fill"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, value))) }}
          transition={{ duration: 0.9, ease }}
        />
      </svg>
      {children ? <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>{children}</div> : null}
    </div>
  );
}

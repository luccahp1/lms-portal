// Typed access to the shared kit's chart helpers (src/kit/charts.js, synced from LMS Dash).
// They return SVG/HTML strings drawn at their final state; KitMotion animates them in.
import "@/kit/charts.js";

type CountOptions = { format?: "int" | "money" | "cents" | "pct" | "dec1" | "compact"; pre?: string; suf?: string; tag?: string };

export type KitCharts = {
  esc: (v: unknown) => string;
  fmt: Record<string, (v: number) => string>;
  count: (value: number, opts?: CountOptions) => string;
  area: (
    values: number[],
    opts?: { w?: number; h?: number; labels?: string[] | null; second?: number[] | null; label?: string; yFormat?: string },
  ) => string;
  spark: (values: number[]) => string;
  gauge: (percent: number, label: string, valueSvg: string) => string;
  ring: (percent: number, label: string, text: string) => string;
  bars: (items: { label: string; pct: number; note?: string }[]) => string;
  vbars: (values: number[], labels: string[], opts?: { hi?: number; title?: (v: number) => string }) => string;
};

export const charts = (globalThis as unknown as { LMSCharts: KitCharts }).LMSCharts;

import { describe, expect, it } from "vitest";
import type { StatRow } from "@/db/schema";
import { change, channelOf, reportMonths, reportPeriods, summarise } from "@/lib/reports";
import { baselineStep, describeForecast, forecastKeyword, observedSlope } from "@/lib/forecast";
import { balance } from "@/lib/data/invoices";

const row = (day: string, kind: string, n = 1, extra: Partial<StatRow> = {}): StatRow => ({
  day,
  kind,
  page: "",
  source: "",
  detail: "",
  n,
  ...extra,
});

describe("reports", () => {
  it("groups referrers the same way LMS Dash does", () => {
    expect(channelOf("")).toBe("direct");
    expect(channelOf("www.google.ca")).toBe("search");
    expect(channelOf("bing.com")).toBe("search");
    expect(channelOf("chatgpt.com")).toBe("ai");
    expect(channelOf("m.facebook.com")).toBe("social");
    expect(channelOf("example.org")).toBe("other");
  });

  it("totals a period: visits, views, leads, sources, pages and quote services", () => {
    const rows = [
      row("2026-10-01", "visit", 3, { source: "www.google.com" }),
      row("2026-10-02", "visit", 2),
      row("2026-10-02", "view", 4, { page: "/" }),
      row("2026-10-02", "view", 1, { page: "/storage" }),
      row("2026-10-02", "call", 1, { detail: "905-699-1046" }),
      row("2026-10-03", "quote", 1, { detail: "Storage trailer" }),
      row("2026-10-03", "directions", 2),
      row("2026-11-01", "visit", 9), // outside the period
    ];
    const s = summarise(rows, { start: "2026-10-01", end: "2026-10-31" });
    expect(s).toMatchObject({ visits: 5, views: 5, calls: 1, quotes: 1, directions: 2, leads: 2 });
    expect(s.series).toHaveLength(31);
    expect(s.series[1]).toEqual({ day: "2026-10-02", visits: 2, leads: 1 });
    expect(s.pages[0]).toEqual({ name: "/", n: 4 });
    expect(s.channels.map((c) => c.key)).toEqual(["search", "direct"]);
    expect(s.services).toEqual([{ name: "Storage trailer", n: 1 }]);
  });

  it("compares a month in progress with the same days of last month", () => {
    expect(reportPeriods("2026-11", "2026-11-03")).toEqual({
      current: { start: "2026-11-01", end: "2026-11-03" },
      previous: { start: "2026-10-01", end: "2026-10-03" },
      partial: true,
    });
    expect(reportPeriods("2026-10", "2026-11-03")).toEqual({
      current: { start: "2026-10-01", end: "2026-10-31" },
      previous: { start: "2026-09-01", end: "2026-09-30" },
      partial: false,
    });
    // 31st of a month against a 30-day month: capped at the end of last month.
    expect(reportPeriods("2026-12", "2026-12-31").previous).toEqual({ start: "2026-11-01", end: "2026-11-30" });
  });

  it("works out percent change and the months a report exists for", () => {
    expect(change(165, 100)).toBe(65);
    expect(change(50, 100)).toBe(-50);
    expect(change(10, 0)).toBeNull();
    expect(reportMonths("2026-10-23", "2026-11-03")).toEqual(["2026-11", "2026-10"]);
    expect(reportMonths(null, "2026-11-03")).toEqual(["2026-11"]);
  });
});

describe("ranking forecast", () => {
  it("baseline: page two climbs fastest, the top 3 slowly, #1 holds", () => {
    expect(baselineStep(1)).toBe(1);
    expect(29 - baselineStep(29)).toBeGreaterThan(3 - baselineStep(3));
    expect(baselineStep(13)).toBeLessThan(13);
    expect(baselineStep(35)).toBeLessThan(35);
  });

  it("forecasts three months with a range that widens, never better than #1", () => {
    const f = forecastKeyword([{ month: "2026-10", position: 29 }]);
    expect(f.map((p) => p.month)).toEqual(["2026-11", "2026-12", "2027-01"]);
    for (const p of f) {
      expect(p.likely).not.toBeNull();
      expect(p.best!).toBeLessThanOrEqual(p.likely!);
      expect(p.best!).toBeGreaterThanOrEqual(1);
    }
    expect(f[2]!.likely!).toBeLessThan(29);
    const spread = (i: number) => (f[i]!.worst ?? 31) - f[i]!.best!;
    expect(spread(2)).toBeGreaterThanOrEqual(spread(0));
  });

  it("a search we aren't found for stays out of the top 30 at first", () => {
    const f = forecastKeyword([{ month: "2026-10", position: 0 }]);
    expect(f[0]!.likely).toBeNull();
    expect(describeForecast(0, f[2]!.likely)).toMatch(/top 30/);
  });

  it("leans on the real trend once there is history", () => {
    expect(observedSlope([{ month: "2026-10", position: 5 }])).toBeNull();
    const falling = [
      { month: "2026-08", position: 4 },
      { month: "2026-09", position: 8 },
      { month: "2026-10", position: 14 },
    ];
    expect(observedSlope(falling)!).toBeGreaterThan(0);
    const withTrend = forecastKeyword(falling, 1)[0]!.likely!;
    const baselineOnly = forecastKeyword([{ month: "2026-10", position: 14 }], 1)[0]!.likely!;
    expect(withTrend).toBeGreaterThan(baselineOnly);
  });
});

describe("balance", () => {
  it("counts sent invoices as owing, splits out overdue, ignores drafts", () => {
    const b = balance(
      [
        { status: "sent", amountCents: 125000, dueOn: "2026-10-27" },
        { status: "sent", amountCents: 36500, dueOn: "2026-11-16" },
        { status: "draft", amountCents: 9999, dueOn: "2026-10-01" },
        { status: "paid", amountCents: 5000, dueOn: "2026-10-01" },
      ],
      "2026-11-03",
    );
    expect(b).toEqual({ owing: 161500, overdue: 125000, overdueCount: 1, paid: 5000, nextDue: "2026-11-16" });
  });
});

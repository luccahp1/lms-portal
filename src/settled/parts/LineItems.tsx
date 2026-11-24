"use client";

import { AnimatePresence, Reorder, useDragControls } from "motion/react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { useRef } from "react";
import { inputToCents, money } from "@/settled/lib/format";
import type { LineItem } from "@/settled/lib/types";
import { Num, spring } from "@/settled/ui/motion";
import { Button } from "@/settled/ui/ui";

export interface Row {
  key: string;
  description: string;
  quantity: string;
  unit: string;
  taxable: boolean;
}

let n = 0;
export const newRow = (p: Partial<Row> = {}): Row => ({ key: "r" + ++n + Date.now(), description: "", quantity: "1", unit: "", taxable: true, ...p });

export function rowsFromItems(items: LineItem[]): Row[] {
  return items.map((it) => newRow({ description: it.description, quantity: String(it.quantity), unit: (it.unitCents / 100).toFixed(2), taxable: it.taxable }));
}

export function rowAmount(r: Row): number {
  const q = Number(r.quantity) || 0;
  const u = inputToCents(r.unit) ?? 0;
  return Math.round(q * u);
}

/** What the API takes; empty rows are dropped. */
export function rowsToItems(rows: Row[]) {
  return rows
    .filter((r) => r.description.trim() || inputToCents(r.unit))
    .map((r) => ({ description: r.description.trim(), quantity: Number(r.quantity) || 1, unitCents: inputToCents(r.unit) ?? 0, taxable: r.taxable }));
}

export function totalsOf(rows: Row[], taxRate: number) {
  let sub = 0;
  let taxable = 0;
  for (const r of rows) {
    const a = rowAmount(r);
    sub += a;
    if (r.taxable) taxable += a;
  }
  const tax = Math.round((taxable * taxRate) / 100);
  return { sub, tax, total: sub + tax };
}

const COLS = ["description", "quantity", "unit"] as const;

/**
 * The line editor. Keyboard: Enter moves to the same field on the next line
 * (and adds one at the end), Alt+Up/Down moves a line, Ctrl+Backspace on an
 * empty description removes it. Lines can also be dragged by their handle.
 */
export function LineItems({ rows, setRows, taxRate, taxLabel, currency = "CAD" }: { rows: Row[]; setRows: (r: Row[]) => void; taxRate: number; taxLabel: string; currency?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const t = totalsOf(rows, taxRate);

  const focus = (row: number, col: string) =>
    requestAnimationFrame(() => box.current?.querySelector<HTMLInputElement>(`[data-row="${row}"][data-col="${col}"]`)?.focus());

  const update = (i: number, p: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const remove = (i: number) => {
    const next = rows.filter((_, j) => j !== i);
    setRows(next.length ? next : [newRow()]);
    focus(Math.max(0, i - 1), "description");
  };
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = rows.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, i: number, col: (typeof COLS)[number]) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (i === rows.length - 1) setRows([...rows, newRow({ taxable: rows[i].taxable })]);
      focus(i + 1, col);
    } else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      const d = e.key === "ArrowUp" ? -1 : 1;
      move(i, d);
      focus(i + d, col);
    } else if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !e.altKey && col !== "description") {
      e.preventDefault();
      focus(i + (e.key === "ArrowUp" ? -1 : 1), col);
    } else if (e.key === "Backspace" && (e.ctrlKey || e.metaKey) && col === "description" && !rows[i].description && rows.length > 1) {
      e.preventDefault();
      remove(i);
    }
  };

  return (
    <div className="lines" ref={box}>
      <div className="lines-head" aria-hidden>
        <span />
        <span>Description</span>
        <span className="r">Qty</span>
        <span className="r">Price</span>
        <span className="r">Amount</span>
        <span />
      </div>
      <Reorder.Group axis="y" values={rows} onReorder={setRows} as="div" className="lines-body">
        <AnimatePresence initial={false}>
          {rows.map((r, i) => (
            <LineRow key={r.key} row={r} i={i} count={rows.length} update={update} remove={remove} onKey={onKey} taxRate={taxRate} taxLabel={taxLabel} currency={currency} />
          ))}
        </AnimatePresence>
      </Reorder.Group>
      <div className="lines-foot">
        <Button
          size="sm"
          variant="ghost"
          icon={<Plus />}
          onClick={() => {
            setRows([...rows, newRow({ taxable: rows[rows.length - 1]?.taxable ?? true })]);
            focus(rows.length, "description");
          }}
        >
          Add a line
        </Button>
        <span className="tiny faint hide-sm">Enter for a new line · Alt+↑↓ to move</span>
      </div>
      <div className="lines-totals" aria-live="polite">
        <div>
          <span>Subtotal</span>
          <Num value={t.sub} currency={currency} countUp={false} />
        </div>
        {taxRate > 0 ? (
          <div>
            <span>
              {taxLabel || "Tax"} ({taxRate}%)
            </span>
            <Num value={t.tax} currency={currency} countUp={false} />
          </div>
        ) : null}
        <div className="lines-total">
          <span>Total</span>
          <Num value={t.total} currency={currency} countUp={false} />
        </div>
      </div>
    </div>
  );
}

function LineRow({
  row,
  i,
  count,
  update,
  remove,
  onKey,
  taxRate,
  taxLabel,
  currency,
}: {
  row: Row;
  i: number;
  count: number;
  update: (i: number, p: Partial<Row>) => void;
  remove: (i: number) => void;
  onKey: (e: React.KeyboardEvent<HTMLInputElement>, i: number, col: (typeof COLS)[number]) => void;
  taxRate: number;
  taxLabel: string;
  currency: string;
}) {
  const controls = useDragControls();
  const amt = rowAmount(row);
  return (
    <Reorder.Item
      value={row}
      as="div"
      className="line"
      dragListener={false}
      dragControls={controls}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.14 } }}
      transition={spring}
      whileDrag={{ scale: 1.015, boxShadow: "var(--shadow-lg)", zIndex: 5 }}
    >
      <button type="button" className="line-grip" onPointerDown={(e) => controls.start(e)} aria-label={`Drag line ${i + 1} to reorder`} tabIndex={-1}>
        <GripVertical />
      </button>
      <input
        className="input line-desc"
        value={row.description}
        placeholder={i === 0 ? "What you did, e.g. Spring cleanup" : "Description"}
        onChange={(e) => update(i, { description: e.target.value })}
        onKeyDown={(e) => onKey(e, i, "description")}
        data-row={i}
        data-col="description"
        aria-label={`Line ${i + 1} description`}
      />
      <input
        className="input line-qty num"
        value={row.quantity}
        inputMode="decimal"
        onChange={(e) => update(i, { quantity: e.target.value.replace(/[^\d.]/g, "") })}
        onKeyDown={(e) => onKey(e, i, "quantity")}
        onFocus={(e) => e.target.select()}
        data-row={i}
        data-col="quantity"
        aria-label={`Line ${i + 1} quantity`}
      />
      <div className="input-wrap line-unit">
        <span className="input-prefix">$</span>
        <input
          className="input num"
          value={row.unit}
          inputMode="decimal"
          placeholder="0.00"
          onChange={(e) => update(i, { unit: e.target.value.replace(/[^\d.,]/g, "") })}
          onBlur={() => {
            const c = inputToCents(row.unit);
            if (c !== null) update(i, { unit: (c / 100).toFixed(2) });
          }}
          onKeyDown={(e) => onKey(e, i, "unit")}
          onFocus={(e) => e.target.select()}
          data-row={i}
          data-col="unit"
          aria-label={`Line ${i + 1} price`}
        />
      </div>
      <span className="line-amt num">{money(amt, currency)}</span>
      <div className="line-tools">
        {taxRate > 0 ? (
          <button
            type="button"
            className={"line-tax" + (row.taxable ? " on" : "")}
            aria-pressed={row.taxable}
            onClick={() => update(i, { taxable: !row.taxable })}
            title={row.taxable ? `${taxLabel || "Tax"} applies` : `No ${taxLabel || "tax"} on this line`}
            aria-label={`${taxLabel || "Tax"} on line ${i + 1}`}
          >
            {taxLabel || "Tax"}
          </button>
        ) : null}
        <button type="button" className="line-del" onClick={() => remove(i)} aria-label={`Remove line ${i + 1}`} disabled={count === 1 && !row.description && !row.unit}>
          <Trash2 />
        </button>
      </div>
    </Reorder.Item>
  );
}

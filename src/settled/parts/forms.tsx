"use client";

/*
  Settings forms shared by Setup and Settings. Each one saves itself and calls
  onSaved, so the setup checklist can tick and the settings page can refresh.
*/

import { AnimatePresence, motion } from "motion/react";
import { Check, ImageUp, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/settled/lib/api";
import type { OrgSettings, ReminderPlan, SettingsOut } from "@/settled/lib/types";
import { spring } from "@/settled/ui/motion";
import { useToast } from "@/settled/ui/toast";
import { Button, Field, Input, Switch } from "@/settled/ui/ui";

export async function patchSettings(patch: Partial<OrgSettings>): Promise<SettingsOut> {
  const r = await api.patch<SettingsOut>("/portal/invoicing/api/settings", patch);
  if (r.refused?.length) throw new Error("Settled could not save: " + r.refused.join(", ") + ". Check those and try again.");
  return r;
}

function useSaver(onSaved?: () => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const save = async (patch: Partial<OrgSettings>, msg = "Saved") => {
    setBusy(true);
    setError(null);
    try {
      await patchSettings(patch);
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      toast.good(msg);
      onSaved?.();
      return true;
    } catch (e) {
      setError(errorMessage(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, saved, save };
}

export function SaveButton({ busy, saved, label = "Save" }: { busy: boolean; saved: boolean; label?: string }) {
  return (
    <Button type="submit" variant="primary" busy={busy}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span key={saved ? "s" : "n"} className="hstack" style={{ gap: 6 }} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
          {saved ? <Check /> : null}
          {saved ? "Saved" : label}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <div className="notice notice-danger" role="alert">
      {error}
    </div>
  ) : null;
}

/* ── Business details ─────────────────────────────────────── */

export function ProfileForm({ s, onSaved, compact }: { s: OrgSettings; onSaved?: () => void; compact?: boolean }) {
  const [f, setF] = useState({ businessName: s.businessName, email: s.email, phone: s.phone, address: s.address, website: s.website });
  const { busy, error, saved, save } = useSaver(onSaved);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        save(f, "Business details saved");
      }}
    >
      <div className="row-fields">
        <Input label="Business name" value={f.businessName} onChange={set("businessName")} autoComplete="organization" />
        <Input label="Email" type="email" value={f.email} onChange={set("email")} hint="Replies to your invoices come here" autoComplete="email" />
      </div>
      <div className="row-fields">
        <Input label="Phone" type="tel" value={f.phone} onChange={set("phone")} autoComplete="tel" />
        {!compact ? <Input label="Website" value={f.website} onChange={set("website")} placeholder="yourbusiness.ca" /> : null}
      </div>
      <Field label="Address" htmlFor="pf-addr">
        <textarea id="pf-addr" className="textarea" rows={2} value={f.address} onChange={set("address")} autoComplete="street-address" />
      </Field>
      <ErrorLine error={error} />
      <div>
        <SaveButton busy={busy} saved={saved} />
      </div>
    </form>
  );
}

/* ── Logo and colour ──────────────────────────────────────── */

const SWATCHES = ["#0d5f4e", "#1e40af", "#7c2d12", "#6d28d9", "#0f766e", "#be123c", "#334155", "#a16207"];

/** Reads an image, shrinks it in a canvas until it fits under ~300 KB, and returns a data URL. */
export async function logoToDataUrl(file: File): Promise<string> {
  if (!/^image\/(png|jpeg|jpg|webp|gif|svg\+xml)$/.test(file.type)) throw new Error("Use a PNG or JPEG image.");
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("That image could not be read."));
      i.src = url;
    });
    const LIMIT = 290_000;
    let max = 640;
    for (let attempt = 0; attempt < 6; attempt++) {
      const scale = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max));
      const w = Math.max(1, Math.round((img.naturalWidth || max) * scale));
      const h = Math.max(1, Math.round((img.naturalHeight || max) * scale));
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      const png = c.toDataURL("image/png");
      if (png.length * 0.75 < LIMIT) return png;
      const jpg = (() => {
        const c2 = document.createElement("canvas");
        c2.width = w;
        c2.height = h;
        const x = c2.getContext("2d")!;
        x.fillStyle = "#fff";
        x.fillRect(0, 0, w, h);
        x.drawImage(img, 0, 0, w, h);
        return c2.toDataURL("image/jpeg", 0.86);
      })();
      if (jpg.length * 0.75 < LIMIT) return jpg;
      max = Math.round(max * 0.75);
    }
    throw new Error("That image is too large. Try a smaller one.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function BrandingForm({ s, onSaved, onChange }: { s: OrgSettings; onSaved?: () => void; onChange?: (v: { logo: string; brandColor: string }) => void }) {
  const [logo, setLogo] = useState(s.logo);
  const [color, setColor] = useState(s.brandColor || "#0d5f4e");
  const [reading, setReading] = useState(false);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const { busy, error, saved, save } = useSaver(onSaved);
  useEffect(() => onChange?.({ logo, brandColor: color }), [logo, color, onChange]);

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setReading(true);
    setFileErr(null);
    try {
      setLogo(await logoToDataUrl(f));
    } catch (e) {
      setFileErr(errorMessage(e));
    } finally {
      setReading(false);
    }
  };

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        save({ logo, brandColor: color }, "Branding saved");
      }}
    >
      <div className="brand-row">
        <label className="logo-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => (e.preventDefault(), pick(e.dataTransfer.files?.[0]))}>
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
          <AnimatePresence mode="wait">
            {logo ? (
              <motion.img key={logo.slice(-40)} src={logo} alt="Your logo" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={spring} />
            ) : (
              <motion.span key="empty" className="logo-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <ImageUp />
                <span className="small">{reading ? "Reading…" : "Add your logo"}</span>
              </motion.span>
            )}
          </AnimatePresence>
        </label>
        <div className="stack-sm grow">
          <span className="small muted">PNG or JPEG. Settled resizes it for you. Shown on invoices, emails and the pay page.</span>
          {logo ? (
            <div>
              <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => setLogo("")}>
                Remove logo
              </Button>
            </div>
          ) : null}
          {fileErr ? <span className="field-error">{fileErr}</span> : null}
        </div>
      </div>
      <div className="field">
        <span className="label">Brand colour</span>
        <div className="swatches" role="radiogroup" aria-label="Brand colour">
          {SWATCHES.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={color.toLowerCase() === c} aria-label={c} className="swatch" style={{ background: c }} onClick={() => setColor(c)}>
              {color.toLowerCase() === c ? <Check /> : null}
            </button>
          ))}
          <label className="swatch swatch-custom" title="Pick any colour">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Custom colour" />
          </label>
          <span className="mono small faint">{color}</span>
        </div>
      </div>
      <ErrorLine error={error} />
      <div>
        <SaveButton busy={busy} saved={saved} />
      </div>
    </form>
  );
}

/* ── Tax ─────────────────────────────────────────────────── */

const TAX_PRESETS = [
  { label: "Ontario HST 13%", taxLabel: "HST", taxRate: 13 },
  { label: "Atlantic HST 15%", taxLabel: "HST", taxRate: 15 },
  { label: "GST 5%", taxLabel: "GST", taxRate: 5 },
  { label: "Quebec GST+QST 14.975%", taxLabel: "GST+QST", taxRate: 14.975 },
  { label: "No tax", taxLabel: "Tax", taxRate: 0 },
];

export function TaxForm({ s, onSaved }: { s: OrgSettings; onSaved?: () => void }) {
  const [f, setF] = useState({ taxLabel: s.taxLabel, taxRate: String(s.taxRate), taxNumber: s.taxNumber });
  const { busy, error, saved, save } = useSaver(onSaved);
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        save({ taxLabel: f.taxLabel, taxRate: Number(f.taxRate) || 0, taxNumber: f.taxNumber }, "Tax saved");
      }}
    >
      <div className="chips">
        {TAX_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className="chip"
            aria-pressed={f.taxLabel === p.taxLabel && Number(f.taxRate) === p.taxRate}
            onClick={() => setF((x) => ({ ...x, taxLabel: p.taxLabel, taxRate: String(p.taxRate) }))}
          >
            {f.taxLabel === p.taxLabel && Number(f.taxRate) === p.taxRate ? <span className="chip-bg" /> : null}
            <span>{p.label}</span>
          </button>
        ))}
      </div>
      <div className="row-fields">
        <Input label="Name on invoices" value={f.taxLabel} onChange={(e) => setF({ ...f, taxLabel: e.target.value })} />
        <Input label="Rate (%)" inputMode="decimal" value={f.taxRate} onChange={(e) => setF({ ...f, taxRate: e.target.value.replace(/[^\d.]/g, "") })} />
        <Input label="Your tax number" value={f.taxNumber} onChange={(e) => setF({ ...f, taxNumber: e.target.value })} placeholder="123456789 RT0001" hint={Number(f.taxRate) ? "Printed on every invoice" : "Not needed with no tax"} />
      </div>
      <ErrorLine error={error} />
      <div>
        <SaveButton busy={busy} saved={saved} />
      </div>
    </form>
  );
}

/* ── e-Transfer address ──────────────────────────────────── */

export function EtransferForm({ s, onSaved }: { s: OrgSettings; onSaved?: () => void }) {
  const [email, setEmail] = useState(s.etransferEmail || s.email);
  const [note, setNote] = useState(s.paymentNote);
  const { busy, error, saved, save } = useSaver(onSaved);
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        save({ etransferEmail: email, paymentNote: note }, "e-Transfer details saved");
      }}
    >
      <Input label="e-Transfer email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} hint="The address registered with your bank for Interac e-Transfer, ideally with Autodeposit on." />
      <Field label="Other ways to pay (optional)" htmlFor="et-note" hint="Printed on invoices. For example: Cheques payable to Olsen Landscaping.">
        <textarea id="et-note" className="textarea" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <ErrorLine error={error} />
      <div>
        <SaveButton busy={busy} saved={saved} />
      </div>
    </form>
  );
}

/* ── Reminders ───────────────────────────────────────────── */

const BEFORE = [7, 3, 1];
const AFTER = [1, 3, 7, 14, 30, 45, 60];

export function RemindersForm({ s, onSaved }: { s: OrgSettings; onSaved?: () => void }) {
  const [r, setR] = useState<ReminderPlan>(s.reminders);
  const [receipts, setReceipts] = useState(s.sendReceipts);
  const { busy, error, saved, save } = useSaver(onSaved);
  const toggle = (k: "before" | "after", d: number) =>
    setR((x) => ({ ...x, [k]: x[k].includes(d) ? x[k].filter((v) => v !== d) : [...x[k], d].sort((a, b) => a - b) }));
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        save({ reminders: r, sendReceipts: receipts }, "Reminders saved");
      }}
    >
      <div className="switch-row">
        <div>
          <div className="bold small">Send polite reminders</div>
          <div className="tiny faint">Each one stops the moment the invoice is paid, or while an e-Transfer is on its way.</div>
        </div>
        <Switch checked={r.enabled} onChange={(v) => setR({ ...r, enabled: v })} label="Send polite reminders" />
      </div>
      <motion.div className="stack" animate={{ opacity: r.enabled ? 1 : 0.45 }} style={{ pointerEvents: r.enabled ? "auto" : "none" }}>
        <div className="field">
          <span className="label">Before the due date</span>
          <div className="chips">
            {BEFORE.map((d) => (
              <button key={d} type="button" className="chip" aria-pressed={r.before.includes(d)} onClick={() => toggle("before", d)}>
                {r.before.includes(d) ? <span className="chip-bg" /> : null}
                <span>{d === 1 ? "1 day" : `${d} days`} before</span>
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="label">After it&apos;s due</span>
          <div className="chips">
            {AFTER.map((d) => (
              <button key={d} type="button" className="chip" aria-pressed={r.after.includes(d)} onClick={() => toggle("after", d)}>
                {r.after.includes(d) ? <span className="chip-bg" /> : null}
                <span>{d === 1 ? "1 day" : `${d} days`} late</span>
              </button>
            ))}
          </div>
        </div>
        <ReminderTimeline r={r} />
      </motion.div>
      <div className="switch-row">
        <div>
          <div className="bold small">Email a receipt when they pay</div>
          <div className="tiny faint">A short thank-you with what was paid.</div>
        </div>
        <Switch checked={receipts} onChange={setReceipts} label="Email a receipt when they pay" />
      </div>
      <ErrorLine error={error} />
      <div>
        <SaveButton busy={busy} saved={saved} />
      </div>
    </form>
  );
}

function ReminderTimeline({ r }: { r: ReminderPlan }) {
  const span = 60 + 7;
  const pos = (d: number) => ((d + 7) / span) * 100;
  return (
    <div className="rem-line" aria-hidden>
      <span className="rem-axis" />
      <span className="rem-due" style={{ left: pos(0) + "%" }}>
        <span>Due</span>
      </span>
      <AnimatePresence>
        {r.before.map((d) => (
          <motion.span key={"b" + d} className="rem-dot before" style={{ left: pos(-d) + "%" }} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring} />
        ))}
        {r.after.map((d) => (
          <motion.span key={"a" + d} className="rem-dot" style={{ left: pos(d) + "%" }} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring} />
        ))}
      </AnimatePresence>
    </div>
  );
}

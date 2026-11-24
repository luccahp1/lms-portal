"use client";

import { AnimatePresence, motion } from "motion/react";
import { Download } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useState } from "react";
import { errorMessage } from "@/settled/lib/api";
import { todayStr, addDaysStr } from "@/settled/lib/format";
import { invalidate, useResource } from "@/settled/lib/hooks";
import type { SettingsOut, SetupInfo } from "@/settled/lib/types";
import { InvoiceDoc } from "@/settled/ui/InvoiceDoc";
import { useToast } from "@/settled/ui/toast";
import { Field, Input, PageHead, Sk, Switch, Tabs } from "@/settled/ui/ui";
import { EtransferAuto, StripeConnect, type AutoData } from "@/settled/parts/connect";
import { BrandingForm, EtransferForm, ProfileForm, RemindersForm, SaveButton, TaxForm, patchSettings } from "@/settled/parts/forms";
import { ME_KEY } from "@/settled/shell/Frame";

type Tab = "business" | "paid" | "reminders";
const KEY = "/portal/invoicing/api/settings";

function Settings() {
  const params = useSearchParams();
  const router = useRouter();
  const raw = params.get("tab");
  const tab: Tab = raw === "paid" || raw === "reminders" ? raw : "business";
  const res = useResource<SettingsOut>(KEY);
  const setTab = (t: Tab) => router.replace("/portal/invoicing/settings?tab=" + t, { scroll: false });
  const refresh = () => {
    res.reload();
    invalidate(ME_KEY, "/portal/invoicing/api/setup");
  };

  const items: { value: Tab; label: string }[] = [
    { value: "business", label: "Business" },
    { value: "paid", label: "Getting paid" },
    { value: "reminders", label: "Reminders and receipts" },
  ];

  return (
    <>
      <PageHead
        title="Settings"
        sub="How your invoices look, how you get paid, and what goes out on its own."
        actions={
          <>
            <a className="btn btn-sm" href="/portal/invoicing/api/exports/invoices.csv">
              <Download /> Invoices CSV
            </a>
            <a className="btn btn-sm" href="/portal/invoicing/api/exports/payments.csv">
              <Download /> Payments CSV
            </a>
          </>
        }
      />
      <div style={{ marginBottom: 20 }}>
        <Tabs id="settings-tabs" label="Settings" value={tab} onChange={setTab} items={items} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }} className="settings-body">
          {!res.data ? (
            <div className="stack">
              <Sk h={220} r={16} />
              <Sk h={160} r={16} />
            </div>
          ) : tab === "business" ? (
            <BusinessTab s={res.data} onSaved={refresh} />
          ) : tab === "paid" ? (
            <PaidTab s={res.data} onSaved={refresh} />
          ) : (
            <Card title="Reminders and receipts" sub="What goes out on its own, and when.">
              <RemindersForm s={res.data.settings} onSaved={refresh} />
            </Card>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="card card-pad">
      <h2 className="card-title">{title}</h2>
      {sub ? <p className="card-sub" style={{ marginBottom: 18 }}>{sub}</p> : <div style={{ height: 14 }} />}
      {children}
    </section>
  );
}

function BusinessTab({ s, onSaved }: { s: SettingsOut; onSaved: () => void }) {
  const st = s.settings;
  const [brand, setBrand] = useState({ logo: st.logo, brandColor: st.brandColor });
  const onChange = useCallback((v: { logo: string; brandColor: string }) => setBrand(v), []);
  const today = todayStr();
  const sample = {
    number: (st.invoicePrefix || "INV-") + "1042",
    issuedOn: today,
    dueOn: addDaysStr(today, st.termsDays),
    currency: st.currency,
    items: [
      { description: "Spring cleanup", quantity: 1, unitCents: 42000, taxable: true, amountCents: 42000 },
      { description: "Mulch, 3 yards", quantity: 3, unitCents: 6500, taxable: true, amountCents: 19500 },
    ],
    subtotalCents: 61500,
    taxCents: Math.round((61500 * st.taxRate) / 100),
    totalCents: 61500 + Math.round((61500 * st.taxRate) / 100),
    paidCents: 0,
    balanceCents: 61500 + Math.round((61500 * st.taxRate) / 100),
    notes: "Thanks for your business!",
  };
  return (
    <div className="settings-grid">
      <div className="stack-lg">
        <Card title="Business details" sub="On every invoice and email.">
          <ProfileForm s={st} onSaved={onSaved} />
        </Card>
        <Card title="Logo and colour" sub="Your invoices, emails and pay page look like yours. The preview updates as you go.">
          <BrandingForm s={st} onSaved={onSaved} onChange={onChange} />
        </Card>
        <Card title="Tax">
          <TaxForm s={st} onSaved={onSaved} />
        </Card>
        <InvoiceOptions s={s} onSaved={onSaved} />
      </div>
      <aside className="settings-preview">
        <span className="label" style={{ display: "block", marginBottom: 8 }}>
          Preview
        </span>
        <div className="preview-scale">
          <InvoiceDoc
            business={{ name: st.businessName, email: st.email, phone: st.phone, address: st.address, website: st.website, logo: brand.logo, brandColor: brand.brandColor, taxLabel: st.taxLabel, taxRate: st.taxRate, taxNumber: st.taxNumber, footer: st.footer }}
            customer={{ name: "Jane Smith", email: "jane@example.com" }}
            invoice={sample}
          />
        </div>
      </aside>
    </div>
  );
}

function InvoiceOptions({ s, onSaved }: { s: SettingsOut; onSaved: () => void }) {
  const toast = useToast();
  const st = s.settings;
  const [f, setF] = useState({ invoicePrefix: st.invoicePrefix, termsDays: String(st.termsDays), footer: st.footer });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <Card title="Invoice defaults">
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await patchSettings({ invoicePrefix: f.invoicePrefix, termsDays: Number(f.termsDays) || 0, footer: f.footer });
            setSaved(true);
            setTimeout(() => setSaved(false), 1600);
            onSaved();
          } catch (err) {
            toast.bad(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="row-fields">
          <Input label="Number prefix" value={f.invoicePrefix} onChange={(e) => setF({ ...f, invoicePrefix: e.target.value })} hint="INV- gives INV-1042" />
          <Input label="Due after (days)" inputMode="numeric" value={f.termsDays} onChange={(e) => setF({ ...f, termsDays: e.target.value.replace(/\D/g, "") })} hint="0 means due on receipt" />
        </div>
        <Field label="Footer" htmlFor="inv-footer" hint="Small print at the bottom of every invoice.">
          <textarea id="inv-footer" className="textarea" rows={2} value={f.footer} onChange={(e) => setF({ ...f, footer: e.target.value })} />
        </Field>
        <div>
          <SaveButton busy={busy} saved={saved} />
        </div>
      </form>
    </Card>
  );
}

function PaidTab({ s, onSaved }: { s: SettingsOut; onSaved: () => void }) {
  const toast = useToast();
  const setup = useResource<SetupInfo>("/portal/invoicing/api/setup", { poll: 10_000 });
  const auto = setup.data?.steps.find((x) => x.id === "etransfer_auto")?.data as AutoData | undefined;
  const [autoMatch, setAutoMatch] = useState(s.settings.autoMatch);
  return (
    <div className="stack-lg" style={{ maxWidth: 860 }}>
      <Card title="e-Transfer" sub="Where customers send money, printed on every invoice.">
        <EtransferForm s={s.settings} onSaved={onSaved} />
      </Card>
      <Card title="Mark e-Transfers paid automatically" sub="Pick one. Either way Settled follows each transfer until it's deposited, and tells you if one never arrives.">
        {auto ? <EtransferAuto data={auto} onChanged={() => (setup.reload(), onSaved())} /> : <Sk h={180} />}
        <div className="switch-row" style={{ marginTop: 12 }}>
          <div>
            <div className="bold small">Match payments by itself when it&apos;s sure</div>
            <div className="tiny faint">Off sends every payment to Money in for you to confirm.</div>
          </div>
          <Switch
            checked={autoMatch}
            label="Match payments by itself"
            onChange={async (v) => {
              setAutoMatch(v);
              try {
                await patchSettings({ autoMatch: v });
                onSaved();
              } catch (e) {
                setAutoMatch(!v);
                toast.bad(errorMessage(e));
              }
            }}
          />
        </div>
      </Card>
      <Card title="Cards and bank debit" sub="Optional. A Pay button on every invoice, through your own Stripe account.">
        <StripeConnect connected={s.connected.stripe} testMode={s.connected.stripeTestMode} onChanged={onSaved} />
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <Settings />
    </Suspense>
  );
}

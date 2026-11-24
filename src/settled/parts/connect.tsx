"use client";

/* Getting paid automatically: Gmail with an app password, forwarding, and Stripe. */

import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, Check, CreditCard, Forward, KeyRound, Mail, MailSearch, Plug, ShieldCheck, Sparkles, Unplug } from "lucide-react";
import { useState } from "react";
import { api, errorMessage } from "@/settled/lib/api";
import { ago, plural } from "@/settled/lib/format";
import type { ScanResult, SettingsOut } from "@/settled/lib/types";
import { Num, ease, spring } from "@/settled/ui/motion";
import { useToast } from "@/settled/ui/toast";
import { Button, CopyField, Field, Input, Pill } from "@/settled/ui/ui";
import { patchSettings } from "@/settled/parts/forms";

export interface AutoData {
  mailboxConnected: boolean;
  mailboxUser: string | null;
  search: string;
  lastScan: { last_run_at: number | null; last_error: string | null } | null;
  forwardTo: string | null;
  gmailFilter: string;
  confirmation: { code: string; link: string; at: number } | null;
  seenOne: boolean;
}

/** The two ways in, side by side. */
export function EtransferAuto({ data, onChanged }: { data: AutoData; onChanged: () => void }) {
  const [way, setWay] = useState<"gmail" | "forward">(data.forwardTo && data.seenOne && !data.mailboxConnected ? "forward" : "gmail");
  return (
    <div className="stack">
      <div className="ways" role="radiogroup" aria-label="How Settled gets your e-Transfer emails">
        <button type="button" role="radio" aria-checked={way === "gmail"} className="way" onClick={() => setWay("gmail")}>
          {way === "gmail" ? <motion.span className="way-bg" layoutId="way-bg" transition={spring} /> : null}
          <span className="way-ico">
            <Mail />
          </span>
          <span className="grow">
            <span className="bold" style={{ display: "block" }}>
              Connect Gmail <Pill tone="paid" icon={<Sparkles />}>Recommended</Pill>
            </span>
            <span className="small muted">Paste an app password once. Settled checks for e-Transfers every few minutes.</span>
          </span>
        </button>
        <button type="button" role="radio" aria-checked={way === "forward"} className="way" onClick={() => setWay("forward")}>
          {way === "forward" ? <motion.span className="way-bg" layoutId="way-bg" transition={spring} /> : null}
          <span className="way-ico">
            <Forward />
          </span>
          <span className="grow">
            <span className="bold" style={{ display: "block" }}>
              Forward instead
            </span>
            <span className="small muted">No password. Set a filter that forwards Interac&apos;s emails to your Settled address.</span>
          </span>
        </button>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={way} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.22, ease }}>
          {way === "gmail" ? <GmailConnect data={data} onChanged={onChanged} /> : <ForwardSetup data={data} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const GMAIL_STEPS = [
  { title: "Open your Google Account", body: "myaccount.google.com, signed in as the Gmail that gets your e-Transfer emails." },
  { title: "Security", body: "Turn on 2-Step Verification if it isn't on. Google needs it for app passwords." },
  { title: "App passwords", body: "Make one called Settled. Google shows 16 letters." },
  { title: "Paste it here", body: "With your Gmail address. Settled only reads; nothing is moved, marked or deleted." },
];

export function GmailConnect({ data, onChanged }: { data: AutoData; onChanged: () => void }) {
  const toast = useToast();
  const [user, setUser] = useState(data.mailboxUser ?? "");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<ScanResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [search, setSearch] = useState(data.search);
  const [searchSaved, setSearchSaved] = useState(false);

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFound(null);
    try {
      const r = await api.put<SettingsOut & { firstScan: ScanResult | { error: string } | null }>("/portal/invoicing/api/settings/mailbox", { user, password });
      setPassword("");
      if (r.firstScan && "error" in r.firstScan) toast.bad("Connected, but the first check hit a snag: " + r.firstScan.error);
      else if (r.firstScan) setFound(r.firstScan);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const scanNow = async () => {
    setScanning(true);
    try {
      setFound(await api.post<ScanResult>("/portal/invoicing/api/settings/mailbox/scan"));
      onChanged();
    } catch (e) {
      toast.bad(errorMessage(e));
    } finally {
      setScanning(false);
    }
  };

  const disconnect = async () => {
    try {
      await api.del("/portal/invoicing/api/settings/mailbox");
      toast.info("Gmail disconnected. Settled no longer reads it.");
      setFound(null);
      onChanged();
    } catch (e) {
      toast.bad(errorMessage(e));
    }
  };

  const saveSearch = async () => {
    try {
      await patchSettings({ etransferSearch: search });
      setSearchSaved(true);
      setTimeout(() => setSearchSaved(false), 1600);
      onChanged();
    } catch (e) {
      toast.bad(errorMessage(e));
    }
  };

  return (
    <div className="stack">
      {data.mailboxConnected ? (
        <div className="connected">
          <span className="connected-ico">
            <ShieldCheck />
          </span>
          <span className="grow">
            <span className="bold" style={{ display: "block" }}>
              Reading {data.mailboxUser}
            </span>
            <span className="small muted">
              {data.lastScan?.last_error
                ? "Last check had a problem: " + data.lastScan.last_error
                : data.lastScan?.last_run_at
                  ? "Last checked " + ago(data.lastScan.last_run_at)
                  : "Checks every few minutes"}
            </span>
          </span>
          <Button size="sm" icon={<MailSearch />} busy={scanning} onClick={scanNow}>
            Check now
          </Button>
          <Button size="sm" variant="ghost" icon={<Unplug />} onClick={disconnect} aria-label="Disconnect Gmail" />
        </div>
      ) : (
        <>
          <ol className="howto">
            {GMAIL_STEPS.map((s, i) => (
              <motion.li key={s.title} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.06 }}>
                <span className="howto-n">{i + 1}</span>
                <span>
                  <span className="bold small" style={{ display: "block" }}>
                    {s.title}
                  </span>
                  <span className="tiny muted">{s.body}</span>
                </span>
              </motion.li>
            ))}
          </ol>
          <a className="btn btn-sm" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ justifySelf: "start" }}>
            <KeyRound /> Open Google app passwords <ArrowUpRight />
          </a>
          <form className="stack" onSubmit={connect}>
            <div className="row-fields">
              <Input label="Gmail address" type="email" value={user} onChange={(e) => setUser(e.target.value)} autoComplete="off" placeholder="you@gmail.com" />
              <Input label="App password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="off" placeholder="abcd efgh ijkl mnop" className="mono" spellCheck={false} />
            </div>
            {error ? (
              <div className="notice notice-danger" role="alert">
                {error}
              </div>
            ) : null}
            <div>
              <Button type="submit" variant="primary" busy={busy} icon={<Plug />}>
                {busy ? "Checking the last 90 days…" : "Connect Gmail"}
              </Button>
            </div>
          </form>
        </>
      )}

      <AnimatePresence>{found ? <ScanSummary key="found" r={found} /> : null}</AnimatePresence>

      <div>
        <button type="button" className="link small" onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced}>
          {advanced ? "Hide" : "Advanced:"} the search Settled runs
        </button>
        <AnimatePresence>
          {advanced ? (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="stack-sm" style={{ marginTop: 10 }}>
              <Field label="Gmail search" htmlFor="gm-search" hint="Gmail search syntax. Add your bank's own sender if it sends its own notices. Leave it blank to go back to the default.">
                <input id="gm-search" className="input mono" value={search} onChange={(e) => setSearch(e.target.value)} spellCheck={false} />
              </Field>
              <div>
                <Button size="sm" onClick={saveSearch} icon={searchSaved ? <Check /> : undefined}>
                  {searchSaved ? "Saved" : "Save search"}
                </Button>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function ScanSummary({ r }: { r: ScanResult }) {
  const items = [
    { n: r.transfers, label: plural(r.transfers, "e-Transfer", "e-Transfers").replace(/^\d+ /, "") + " found" },
    { n: r.matched, label: "invoices marked paid" },
    { n: r.review, label: "need a look" },
  ];
  return (
    <motion.div className="scan-sum" initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} transition={spring} role="status">
      <span className="tiny faint">Looked through {plural(r.scanned, "email")}</span>
      <div className="scan-tiles">
        {items.map((it, i) => (
          <motion.div key={it.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.12, duration: 0.35, ease }}>
            <span className="scan-n">
              <Num value={it.n} format="int" />
            </span>
            <span className="small muted">{it.label}</span>
          </motion.div>
        ))}
      </div>
      {r.transfers === 0 ? <span className="small muted">Nothing in the last 90 days yet. New ones will be picked up within a few minutes.</span> : null}
    </motion.div>
  );
}

export function ForwardSetup({ data }: { data: AutoData }) {
  const [client, setClient] = useState<"gmail" | "outlook">("gmail");
  if (!data.forwardTo) {
    return (
      <div className="notice">
        <Forward />
        <span>Forwarding isn&apos;t switched on for this Settled installation yet. Connect Gmail instead, or ask whoever set up Settled for you to turn on the forwarding address.</span>
      </div>
    );
  }
  return (
    <div className="stack">
      <Field label="Your Settled forwarding address">
        <CopyField value={data.forwardTo} />
      </Field>
      <div className="seg" role="radiogroup" aria-label="Email provider" style={{ justifySelf: "start" }}>
        <button type="button" role="radio" aria-checked={client === "gmail"} onClick={() => setClient("gmail")}>
          Gmail
        </button>
        <button type="button" role="radio" aria-checked={client === "outlook"} onClick={() => setClient("outlook")}>
          Outlook
        </button>
      </div>
      {client === "gmail" ? (
        <ol className="howto">
          <li>
            <span className="howto-n">1</span>
            <span className="small">
              In Gmail: <strong>Settings</strong>, <strong>See all settings</strong>, <strong>Forwarding and POP/IMAP</strong>, <strong>Add a forwarding address</strong>. Paste the address above.
            </span>
          </li>
          <li>
            <span className="howto-n">2</span>
            <span className="small">Gmail sends a confirmation code to Settled. It shows up right here within a few seconds. Paste it back into Gmail.</span>
          </li>
          <li>
            <span className="howto-n">3</span>
            <span className="small">
              Make a filter with this search, then choose <strong>Forward it to</strong> your Settled address:
            </span>
          </li>
        </ol>
      ) : (
        <ol className="howto">
          <li>
            <span className="howto-n">1</span>
            <span className="small">
              In Outlook: <strong>Settings</strong>, <strong>Mail</strong>, <strong>Rules</strong>, <strong>Add new rule</strong>.
            </span>
          </li>
          <li>
            <span className="howto-n">2</span>
            <span className="small">
              Condition: <strong>From</strong> contains <code className="mono">interac.ca</code>. Action: <strong>Forward to</strong> the Settled address above.
            </span>
          </li>
          <li>
            <span className="howto-n">3</span>
            <span className="small">Save. The next e-Transfer email goes straight to Settled.</span>
          </li>
        </ol>
      )}
      {client === "gmail" ? <CopyField value={data.gmailFilter} label="Copy search" /> : null}

      <AnimatePresence>
        {data.confirmation ? (
          <motion.div className="confirm-code" initial={{ opacity: 0, scale: 0.94, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} transition={spring} role="status">
            <span className="small bold">Gmail&apos;s confirmation code arrived</span>
            <span className="confirm-big mono">{data.confirmation.code}</span>
            <div className="hstack wrap" style={{ justifyContent: "center" }}>
              <CopyField value={data.confirmation.code} label="Copy code" />
            </div>
            {data.confirmation.link ? (
              <a className="link small" href={data.confirmation.link} target="_blank" rel="noreferrer">
                Or confirm with Gmail&apos;s link <ArrowUpRight style={{ display: "inline", width: 13, height: 13 }} />
              </a>
            ) : null}
          </motion.div>
        ) : (
          <div className="waiting small muted">
            <span className="live-dot" aria-hidden /> Waiting for Gmail&apos;s confirmation email…
          </div>
        )}
      </AnimatePresence>
      {data.seenOne ? (
        <div className="notice notice-good">
          <Check /> <span>Settled has received e-Transfer emails from you. You&apos;re set.</span>
        </div>
      ) : null}
    </div>
  );
}

export function StripeConnect({ connected, testMode, onChanged }: { connected: boolean; testMode: boolean; onChanged: () => void }) {
  const toast = useToast();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ account: string; testMode: boolean; note: string } | null>(null);

  const connect = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api.put<{ account: string; testMode: boolean; webhook: string; note: string }>("/portal/invoicing/api/settings/stripe", { key });
      setResult(r);
      setKey("");
      toast.good("Stripe connected. Customers can pay from the invoice.");
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const disconnect = async () => {
    try {
      await api.del("/portal/invoicing/api/settings/stripe");
      setResult(null);
      toast.info("Stripe disconnected. The Pay button is gone from invoices.");
      onChanged();
    } catch (e) {
      toast.bad(errorMessage(e));
    }
  };

  if (connected) {
    return (
      <div className="stack">
        <div className="connected">
          <span className="connected-ico">
            <CreditCard />
          </span>
          <span className="grow">
            <span className="bold" style={{ display: "block" }}>
              Stripe is connected {testMode ? <Pill tone="warn">Test mode</Pill> : null}
            </span>
            <span className="small muted">{result?.account ? `Account ${result.account}. ` : ""}Card, Apple Pay, Google Pay and bank debit appear on every invoice.</span>
          </span>
          <Button size="sm" variant="ghost" icon={<Unplug />} onClick={disconnect}>
            Disconnect
          </Button>
        </div>
        {result?.note ? <p className="small muted">{result.note}</p> : null}
      </div>
    );
  }
  return (
    <form className="stack" onSubmit={connect}>
      <p className="small muted">
        In Stripe: <strong>Developers</strong>, <strong>API keys</strong>, then copy the <strong>Secret key</strong>. Money goes straight to your Stripe account; Settled never holds it. Turn on Canadian pre-authorized debits in Stripe to offer bank debit.
      </p>
      <Input label="Stripe secret key" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sk_live_..." className="mono" autoComplete="off" spellCheck={false} />
      {error ? (
        <div className="notice notice-danger" role="alert">
          {error}
        </div>
      ) : null}
      <div className="hstack wrap">
        <Button type="submit" variant="primary" busy={busy} icon={<Plug />} disabled={!key.trim()}>
          Connect Stripe
        </Button>
        <a className="link small" href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer">
          Open Stripe API keys
        </a>
      </div>
    </form>
  );
}

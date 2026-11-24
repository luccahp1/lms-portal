import { Banknote, Building2, CreditCard, FileCheck2, Landmark, Send, Wallet } from "lucide-react";
import type { Method } from "@/settled/lib/types";

const ICONS: Record<Method, { icon: typeof Send; color: string }> = {
  etransfer: { icon: Send, color: "#d4a017" },
  card: { icon: CreditCard, color: "var(--st-viewed)" },
  bank_debit: { icon: Landmark, color: "var(--st-incoming)" },
  cheque: { icon: FileCheck2, color: "var(--st-sent)" },
  cash: { icon: Banknote, color: "var(--st-paid)" },
  bank_transfer: { icon: Building2, color: "var(--st-sent)" },
  other: { icon: Wallet, color: "var(--text-3)" },
};

export function MethodIcon({ method, badge }: { method: Method | string; badge?: boolean }) {
  const m = ICONS[method as Method] ?? ICONS.other;
  const I = m.icon;
  if (badge)
    return (
      <span className="ico" style={{ ["--ic" as string]: m.color }} aria-hidden>
        <I />
      </span>
    );
  return <I style={{ color: m.color }} aria-hidden />;
}

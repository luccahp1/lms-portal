/* Response shapes from docs/API.md. Client-side only; nothing here imports src/lib. */

export type InvoiceState = "draft" | "sent" | "paid" | "void";
export type InvoiceStatus = "draft" | "sent" | "viewed" | "incoming" | "partial" | "overdue" | "paid" | "void";

export interface LineItem {
  description: string;
  quantity: number;
  unitCents: number;
  taxable: boolean;
  amountCents: number;
}

export interface Invoice {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  state: InvoiceState;
  status: InvoiceStatus;
  daysOverdue: number;
  issuedOn: string | null;
  dueOn: string | null;
  currency: string;
  items: LineItem[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  paidCents: number;
  pendingCents: number;
  balanceCents: number;
  notes: string;
  payToken: string;
  recurringId: string | null;
  remindersOff: boolean;
  remindersSent: number;
  lastRemindedAt: number | null;
  sentAt: number | null;
  viewedAt: number | null;
  paidAt: number | null;
  voidedAt: number | null;
  checkoutState: string | null;
  createdAt: number;
  updatedAt: number;
}

export type Method = "etransfer" | "card" | "bank_debit" | "cheque" | "cash" | "bank_transfer" | "other";
export type PaymentSource = "manual" | "etransfer_email" | "stripe" | "bank_import" | "import";

export interface Allocation {
  invoiceId: string;
  invoiceNumber?: string;
  amountCents: number;
}

export interface Payment {
  id: string;
  customerId: string | null;
  customerName: string;
  amountCents: number;
  unappliedCents: number;
  method: Method;
  methodLabel: string;
  source: PaymentSource;
  receivedOn: string;
  reference: string;
  payerName: string;
  payerEmail: string;
  memo: string;
  depositId: string | null;
  status: "settled" | "clearing" | "failed";
  allocations: Allocation[];
  intended: string[];
  createdAt: number;
}

export interface Customer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
  aliases: string[];
  payerEmails: string[];
  portalToken: string;
  archived: boolean;
  createdAt: number;
}

export interface CustomerWithBalance extends Customer {
  balanceCents: number;
  overdueCents: number;
  openInvoices: number;
  lastPaidAt: number | null;
}

export type EtStatus = "pending" | "processing" | "deposited" | "cancelled" | "declined" | "expired" | "failed";
export type DepositStatus = "review" | "matched" | "dismissed" | "failed";

export interface Suggestion {
  customerId: string;
  customerName: string;
  invoiceIds: string[];
  invoiceNumbers: string[];
  score: number;
  reasons: string[];
  strong: boolean;
}

export interface Deposit {
  id: string;
  source: "etransfer_email" | "bank_import";
  etStatus: EtStatus | "";
  amountCents: number;
  currency: string;
  payerName: string;
  payerEmail: string;
  memo: string;
  reference: string;
  receivedOn: string;
  verified: boolean;
  verifyNote: string;
  status: DepositStatus;
  suggestions: Suggestion[];
  plan: string[];
  paymentId: string | null;
  createdAt: number;
}

export type EventKind =
  | "invoice.created" | "invoice.sent" | "invoice.viewed" | "invoice.reminded" | "invoice.paid"
  | "invoice.partially_paid" | "invoice.voided" | "invoice.updated"
  | "payment.recorded" | "payment.removed" | "payment.clearing" | "payment.failed"
  | "deposit.received" | "deposit.matched" | "deposit.needs_review" | "deposit.failed" | "deposit.dismissed"
  | "customer.created" | "recurring.generated" | "email.failed" | "setup.changed";

export interface ActivityEvent {
  id: string;
  kind: EventKind | string;
  summary: string;
  invoiceId: string | null;
  customerId: string | null;
  paymentId: string | null;
  depositId: string | null;
  data: Record<string, unknown> | null;
  at: number;
}

export interface Summary {
  currency: string;
  today: string;
  outstandingCents: number;
  overdueCents: number;
  openCount: number;
  overdueCount: number;
  draftCount: number;
  paidThisMonthCents: number;
  paidLastMonthCents: number;
  paidThisMonthCount: number;
  needsReviewCount: number;
  clearingCents: number;
  creditCents: number;
  avgDaysToPay: number | null;
  onTimeRate: number | null;
  aging: { label: string; fromDays: number; toDays: number | null; cents: number; count: number }[];
  expected: { label: string; cents: number }[];
  topOwing: { customerId: string; name: string; cents: number; oldestDaysLate: number }[];
  monthly: { month: string; cents: number }[];
  byMethod: { method: Method; cents: number; count: number }[];
  automation: { autoMatched: number; manual: number; reminders: number; hoursSaved: number };
}

export interface Me {
  user: { id: string; email: string; name: string; role: "owner" | "member"; notify_payments: number } | null;
  role: "owner" | "member";
  via: "session" | "api_key";
  business: { id: string; name: string; logo: string; brandColor: string; currency: string; plan: string };
  setupPercent: number;
}

export interface SetupStep {
  id: "profile" | "branding" | "tax" | "etransfer" | "etransfer_auto" | "stripe" | "customers" | "first_invoice" | "reminders";
  title: string;
  why: string;
  done: boolean;
  optional: boolean;
  data?: Record<string, unknown>;
}

export interface SetupInfo {
  percent: number;
  steps: SetupStep[];
  installation: { mail: boolean; inbound: boolean; publicUrl: string };
}

export interface ReminderPlan {
  enabled: boolean;
  before: number[];
  after: number[];
}

export interface OrgSettings {
  businessName: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  logo: string;
  brandColor: string;
  currency: string;
  timeZone: string;
  taxLabel: string;
  taxRate: number;
  taxNumber: string;
  invoicePrefix: string;
  termsDays: number;
  etransferEmail: string;
  paymentNote: string;
  footer: string;
  reminders: ReminderPlan;
  sendReceipts: boolean;
  autoMatch: boolean;
  mailbox: { host: string; port: number; user: string } | null;
  etransferSearch: string;
  forwardingConfirmation: { code: string; link: string; at: number } | null;
}

export interface SettingsOut {
  id: string;
  plan: string;
  settings: OrgSettings;
  inboundAddress: string | null;
  connected: { stripe: boolean; stripeTestMode: boolean; stripeWebhook: boolean; mailbox: boolean };
  mailbox: { last_run_at: number | null; last_error: string | null } | null;
  refused?: string[];
}

export interface ScanResult {
  scanned: number;
  transfers: number;
  matched: number;
  review: number;
  failed: number;
}

export interface SendResult {
  status: "sent" | "skipped" | "failed";
  error?: string;
}

export interface EmailLog {
  kind: string;
  to_addr: string;
  subject: string;
  status: string;
  error: string;
  at: number;
}

export interface InvoiceDetail {
  invoice: Invoice;
  payments: Payment[];
  emails: EmailLog[];
  events: ActivityEvent[];
  payUrl: string;
}

export interface CustomerDetail {
  customer: Customer;
  invoices: Invoice[];
  payments: Payment[];
  creditCents: number;
  events: ActivityEvent[];
  accountUrl: string;
}

export type Every = "week" | "2weeks" | "month" | "quarter" | "year";

export interface Recurring {
  id: string;
  customerId: string;
  customerName: string;
  items: LineItem[];
  notes: string;
  every: Every;
  nextOn: string;
  autoSend: boolean;
  paused: boolean;
  createdAt: number;
}

export interface TeamMember {
  id: string;
  email: string;
  name: string;
  role: "owner" | "member";
  notify_payments: number;
}

export interface ApiKey {
  id: string;
  name: string;
  last4: string;
  last_used_at: number | null;
  created_at: number;
}

export interface BankImportResult {
  rows: number;
  credits: number;
  matched: number;
  alreadyRecorded: number;
  review: number;
  duplicates: number;
  skipped: string[];
}

export interface ImportResult {
  created: number;
  skipped: number;
  problems: string[];
}

export interface PublicInvoice {
  business: {
    name: string; email: string; phone: string; address: string; website: string; logo: string;
    brandColor: string; taxLabel: string; taxRate: number; taxNumber: string; footer: string;
  };
  customer: { name: string; company: string; email: string; address: string };
  invoice: {
    number: string; status: InvoiceStatus; issuedOn: string | null; dueOn: string | null; currency: string;
    items: LineItem[]; subtotalCents: number; taxCents: number; totalCents: number; paidCents: number;
    balanceCents: number; notes: string; paidAt: number | null; daysOverdue: number; clearing: boolean;
  };
  pay: { online: boolean; etransfer: { email: string; message: string } | null; note: string };
  pdfUrl: string;
  accountUrl: string;
}

export interface PublicAccount {
  business: { name: string; logo: string; brandColor: string; email: string; phone: string };
  customer: { name: string; company: string };
  balanceCents: number;
  creditCents: number;
  currency: string;
  etransfer: string | null;
  invoices: { number: string; status: InvoiceStatus; issuedOn: string | null; dueOn: string | null; totalCents: number; balanceCents: number; payUrl: string }[];
}

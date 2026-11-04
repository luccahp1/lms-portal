import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  date,
  index,
  uniqueIndex,
  jsonb,
  primaryKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Tenancy: every row belongs to an agency. Client-owned rows also carry client_id.
// All reads/writes go through src/lib/data, which always filters by these columns.

export const userRole = pgEnum("user_role", ["agency_admin", "client"]);
// Self sign-ups start pending until an agency admin links them to a client.
export const userStatus = pgEnum("user_status", ["pending", "active"]);
export const requestStatus = pgEnum("request_status", ["received", "in_progress", "review", "done"]);
export const fileApproval = pgEnum("file_approval", ["none", "pending", "approved", "changes_requested"]);
export const invoiceStatus = pgEnum("invoice_status", ["draft", "sent", "paid"]);
export const actionStatus = pgEnum("action_status", ["open", "done"]);

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const agencies = pgTable("agencies", {
  id: id(),
  name: text("name").notNull(),
  accentColor: text("accent_color").notNull().default("#5160E0"),
  // Secret part of the agency's public sign-up link: /join/<joinCode>
  // Shown on the client's Billing page, e.g. "Pay by e-Transfer to ...".
  paymentInstructions: text("payment_instructions").notNull().default(""),
  joinCode: text("join_code")
    .notNull()
    .unique()
    .default(sql`replace(gen_random_uuid()::text, '-', '')`),
  createdAt: createdAt(),
});

export const clients = pgTable(
  "clients",
  {
    id: id(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    websiteUrl: text("website_url"),
    planName: text("plan_name"),
    // The client's own site answers GET <statsUrl>?from=&to= with anonymous visit counts
    // (see docs/analytics.md). The token is a secret: never send it to a client page.
    statsUrl: text("stats_url"),
    statsToken: text("stats_token"),
    createdAt: createdAt(),
  },
  (t) => [index("clients_agency_idx").on(t.agencyId)],
);

export const users = pgTable(
  "users",
  {
    id: id(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
    // Set for active client users; null while a sign-up is pending.
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    role: userRole("role").notNull(),
    status: userStatus("status").notNull().default("active"),
    email: text("email").notNull(),
    name: text("name").notNull(),
    // Business name the person typed when signing up, to help the admin match them.
    signupBusiness: text("signup_business"),
    // Null only for a bootstrap admin who hasn't used their setup link yet.
    passwordHash: text("password_hash"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)],
);

export const sessions = pgTable("sessions", {
  // sha256 of the cookie token; the raw token is never stored.
  id: text("id").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const invites = pgTable("invites", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

// Bearer tokens for the MCP endpoint (/api/mcp). Agency admins only.
export const apiTokens = pgTable("api_tokens", {
  // sha256 of the raw token; the raw token is shown once when created.
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const monthlyNotes = pgTable(
  "monthly_notes",
  {
    id: id(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    // First day of the month the note covers.
    month: date("month").notNull(),
    wins: text("wins").notNull().default(""),
    workingOn: text("working_on").notNull().default(""),
    nextMonth: text("next_month").notNull().default(""),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("monthly_notes_client_month_idx").on(t.clientId, t.month)],
);

export const workLog = pgTable(
  "work_log",
  {
    id: id(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    tag: text("tag").notNull().default("Update"),
    doneOn: date("done_on").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("work_log_client_idx").on(t.clientId, t.doneOn)],
);

export const requests = pgTable(
  "requests",
  {
    id: id(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    details: text("details").notNull().default(""),
    status: requestStatus("status").notNull().default("received"),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("requests_client_idx").on(t.clientId, t.createdAt)],
);

export const requestComments = pgTable(
  "request_comments",
  {
    id: id(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
    requestId: uuid("request_id").notNull().references(() => requests.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("request_comments_request_idx").on(t.requestId, t.createdAt)],
);

export const messages = pgTable(
  "messages",
  {
    id: id(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("messages_client_idx").on(t.clientId, t.createdAt)],
);

export const files = pgTable(
  "files",
  {
    id: id(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    uploadedById: uuid("uploaded_by_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    storageKey: text("storage_key").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    approval: fileApproval("approval").notNull().default("none"),
    // "" for ordinary files, "brand" for the client's brand kit (business card, logos).
    folder: text("folder").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("files_client_idx").on(t.clientId, t.createdAt)],
);

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    number: text("number").notNull(),
    description: text("description").notNull().default(""),
    amountCents: integer("amount_cents").notNull(),
    issuedOn: date("issued_on").notNull(),
    dueOn: date("due_on").notNull(),
    status: invoiceStatus("status").notNull().default("draft"),
    createdAt: createdAt(),
  },
  (t) => [
    index("invoices_client_idx").on(t.clientId, t.issuedOn),
    uniqueIndex("invoices_agency_number_idx").on(t.agencyId, t.number),
  ],
);

// Last answer from the client's site stats endpoint, refreshed hourly (src/lib/stats).
export const siteStats = pgTable("site_stats", {
  clientId: uuid("client_id")
    .primaryKey()
    .references(() => clients.id, { onDelete: "cascade" }),
  agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
  // Raw counter rows: { day, kind, page, source, detail, n }
  rows: jsonb("rows").$type<StatRow[]>().notNull().default([]),
  // First day the site has counts for.
  since: date("since"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }),
  error: text("error"),
});

export type StatRow = { day: string; kind: string; page: string; source: string; detail: string; n: number };

// Google rankings, kept in LMS Dash and pushed here with the sync_rankings tool.
export const keywords = pgTable(
  "keywords",
  {
    id: id(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    priority: text("priority").notNull().default(""),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [uniqueIndex("keywords_client_keyword_idx").on(t.clientId, t.keyword)],
);

export const keywordRanks = pgTable(
  "keyword_ranks",
  {
    keywordId: uuid("keyword_id").notNull().references(() => keywords.id, { onDelete: "cascade" }),
    // YYYY-MM
    month: text("month").notNull(),
    // 1..30, or 0 when not found in the first three pages.
    position: integer("position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.keywordId, t.month] })],
);

// Whether AI assistants name the client, per question, engine and month. Pushed from LMS Dash.
export const aiQuestions = pgTable(
  "ai_questions",
  {
    id: id(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [uniqueIndex("ai_questions_client_question_idx").on(t.clientId, t.question)],
);

export const aiAnswers = pgTable(
  "ai_answers",
  {
    questionId: uuid("question_id").notNull().references(() => aiQuestions.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    engine: text("engine").notNull(),
    // yes = named, cited = site cited, no = not named
    result: text("result").notNull(),
  },
  (t) => [primaryKey({ columns: [t.questionId, t.month, t.engine] })],
);

// Things the client has to do themselves (verify Google, sign something), with steps.
export const actionItems = pgTable(
  "action_items",
  {
    id: id(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    why: text("why").notNull().default(""),
    // One step per line.
    steps: text("steps").notNull().default(""),
    linkUrl: text("link_url"),
    linkLabel: text("link_label"),
    dueOn: date("due_on"),
    status: actionStatus("status").notNull().default("open"),
    doneAt: timestamp("done_at", { withTimezone: true }),
    doneById: uuid("done_by_id").references(() => users.id, { onDelete: "set null" }),
    sort: integer("sort").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("action_items_client_idx").on(t.clientId, t.status)],
);

export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Agency = typeof agencies.$inferSelect;
export type RequestStatus = (typeof requestStatus.enumValues)[number];
export type FileApproval = (typeof fileApproval.enumValues)[number];
export type InvoiceStatus = (typeof invoiceStatus.enumValues)[number];
export type ActionStatus = (typeof actionStatus.enumValues)[number];
export type ActionItem = typeof actionItems.$inferSelect;

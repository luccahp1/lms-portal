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
} from "drizzle-orm/pg-core";

// Tenancy: every row belongs to an agency. Client-owned rows also carry client_id.
// All reads/writes go through src/lib/data, which always filters by these columns.

export const userRole = pgEnum("user_role", ["agency_admin", "client"]);
export const requestStatus = pgEnum("request_status", ["received", "in_progress", "review", "done"]);
export const fileApproval = pgEnum("file_approval", ["none", "pending", "approved", "changes_requested"]);
export const invoiceStatus = pgEnum("invoice_status", ["draft", "sent", "paid"]);

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const agencies = pgTable("agencies", {
  id: id(),
  name: text("name").notNull(),
  accentColor: text("accent_color").notNull().default("#5160E0"),
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
    createdAt: createdAt(),
  },
  (t) => [index("clients_agency_idx").on(t.agencyId)],
);

export const users = pgTable(
  "users",
  {
    id: id(),
    agencyId: uuid("agency_id").notNull().references(() => agencies.id, { onDelete: "cascade" }),
    // Set only for role = client.
    clientId: uuid("client_id").references(() => clients.id, { onDelete: "cascade" }),
    role: userRole("role").notNull(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    // Null until the invite is accepted.
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

export type User = typeof users.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Agency = typeof agencies.$inferSelect;
export type RequestStatus = (typeof requestStatus.enumValues)[number];
export type FileApproval = (typeof fileApproval.enumValues)[number];
export type InvoiceStatus = (typeof invoiceStatus.enumValues)[number];

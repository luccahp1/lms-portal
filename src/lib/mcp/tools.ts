import { z } from "zod";
import { requestStatus, invoiceStatus } from "@/db/schema";
import type { Viewer } from "@/lib/data/viewer";
import * as clientsData from "@/lib/data/clients";
import * as dashboardSso from "@/lib/data/dashboard-sso";
import * as requestsData from "@/lib/data/requests";
import * as messagesData from "@/lib/data/messages";
import * as filesData from "@/lib/data/files";
import * as updatesData from "@/lib/data/updates";
import * as invoicesData from "@/lib/data/invoices";
import * as signupsData from "@/lib/data/signups";
import * as statsData from "@/lib/data/stats";
import * as rankingsData from "@/lib/data/rankings";
import * as todosData from "@/lib/data/todos";
import { fetchStoredFile, signedDownloadUrl } from "@/lib/storage";
import { createPreviewLink } from "@/lib/data/preview";
import { redeemSsoLink } from "@/lib/data/sso";

// Everything an agency admin can do in the portal, as MCP tools.
// Each tool calls the same data-layer function the admin pages use, so tenant
// isolation and role checks are enforced in one place (src/lib/data).

export type Tool = {
  name: string;
  description: string;
  input: z.ZodObject;
  /** Changes nothing. Read-only tools skip the page revalidation after the call. */
  readOnly?: boolean;
  /** Deletes or removes something that cannot be brought back. */
  destructive?: boolean;
  run: (viewer: Viewer, args: never) => Promise<unknown>;
};

function tool<S extends z.ZodObject>(def: {
  name: string;
  description: string;
  input: S;
  readOnly?: boolean;
  destructive?: boolean;
  run: (viewer: Viewer, args: z.infer<S>) => Promise<unknown>;
}): Tool {
  return def as Tool;
}

const uuid = z.string().uuid();
const clientId = uuid.describe("Client id, from list_clients");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const MAX_READ_BYTES = 10 * 1024 * 1024;
const TEXT_MIME = /^(text\/|application\/(json|xml|javascript|csv))/;

function appUrl() {
  return process.env.APP_URL || "http://localhost:3000";
}

const noInput = z.object({});

/** Opens the portal as this client sees it. Works in a browser logged in as an admin, not over MCP. */
function previewUrl(clientId: string) {
  return `${appUrl()}/admin/clients/${clientId}/preview`;
}

// Returned by new_client_guide. docs/adding-a-client.md is the long version.
const NEW_CLIENT_STEPS = [
  "1. Check get_overview first so you don't add the client twice.",
  "2. create_client with the business name, website and plan.",
  "3. Send the owner the agency sign-up link yourself (nothing is emailed). They sign up with their own email and password.",
  "4. list_pending_signups, then approve_signup with the clientId from step 2. Don't use newClientName here or you get a duplicate client.",
  "5. Fill the portal so it isn't empty on their first login: upsert_monthly_note for this month, add_work_log for work already done, create_invoice for real invoices (draft stays hidden from the client).",
  "6. Give the user the previewUrl so they can check the portal as the client sees it, before telling the client it's ready.",
  "Messages, comments, files and non-draft invoices are visible to the client, so confirm wording with the user first. Someone locked out: create_password_reset_link.",
];

export const tools: Tool[] = [
  // ---- Overview ----
  tool({
    name: "get_overview",
    description:
      "Start here. Who you are acting as, the agency, its sign-up link for new clients, every client, pending sign-ups and open requests.",
    input: noInput,
    readOnly: true,
    run: async (viewer) => {
      const [agency, clients, pendingSignups, openRequests] = await Promise.all([
        clientsData.getAgency(viewer),
        clientsData.listClients(viewer),
        signupsData.listPendingSignups(viewer),
        requestsData.listAgencyOpenRequests(viewer),
      ]);
      return {
        actingAs: { name: viewer.name, email: viewer.email, role: viewer.role },
        agency: { id: agency.id, name: agency.name, signUpLink: `${appUrl()}/join/${agency.joinCode}` },
        clients: clients.map((c) => ({ id: c.id, name: c.name, websiteUrl: c.websiteUrl, planName: c.planName, previewUrl: previewUrl(c.id) })),
        pendingSignups,
        openRequests,
      };
    },
  }),

  // ---- Clients ----
  tool({
    name: "list_clients",
    description: "All clients of the agency.",
    input: noInput,
    readOnly: true,
    run: (viewer) => clientsData.listClients(viewer),
  }),
  tool({
    name: "get_client",
    description: "One client: details, the people who can log in, and its latest monthly update.",
    input: z.object({ clientId }),
    readOnly: true,
    run: async (viewer, { clientId }) => ({
      client: await clientsData.getClient(viewer, clientId),
      users: await clientsData.listClientUsers(viewer, clientId),
      latestNote: await updatesData.getLatestNote(viewer, clientId),
      previewUrl: previewUrl(clientId),
    }),
  }),
  tool({
    name: "new_client_guide",
    description: "Read this before onboarding a new client: the steps in order, with the live sign-up link.",
    input: noInput,
    readOnly: true,
    run: async (viewer) => {
      const agency = await clientsData.getAgency(viewer);
      return { signUpLink: `${appUrl()}/join/${agency.joinCode}`, steps: NEW_CLIENT_STEPS };
    },
  }),
  tool({
    name: "create_client",
    description: "Add a client. Its owner joins later through the agency sign-up link and is approved into it.",
    input: z.object({
      name: z.string().trim().min(1).max(200),
      websiteUrl: z.string().trim().max(500).optional(),
      planName: z.string().trim().max(200).optional(),
    }),
    run: async (viewer, input) => {
      const client = await clientsData.createClient(viewer, input);
      return { ...client, previewUrl: previewUrl(client.id) };
    },
  }),
  tool({
    name: "update_client",
    description: "Change a client's name, website or plan. Omitted website/plan are cleared, so pass the current values to keep them.",
    input: z.object({
      clientId,
      name: z.string().trim().min(1).max(200),
      websiteUrl: z.string().trim().max(500).optional(),
      planName: z.string().trim().max(200).optional(),
    }),
    run: async (viewer, { clientId, ...input }) => {
      await clientsData.updateClient(viewer, clientId, input);
      return clientsData.getClient(viewer, clientId);
    },
  }),
  tool({
    name: "set_client_dashboard",
    description:
      "Link a client to their own job dashboard (leads, estimates, invoices, FieldKit). Their portal then shows an 'Open your dashboard' button. Pass an https:// address, or an empty string to remove the button.",
    input: z.object({ clientId, dashboardUrl: z.string().trim().max(500) }),
    run: async (viewer, { clientId, dashboardUrl }) => ({
      dashboardUrl: await clientsData.setClientDashboard(viewer, clientId, dashboardUrl),
    }),
  }),
  tool({
    name: "set_client_dashboard_sign_in",
    description:
      "Turn one-click sign-in from a client's portal into their job dashboard on or off. On returns a new secret, shown once: put it in that dashboard's .env.local as OE_PORTAL_SSO_SECRET. Turning it on again replaces the old secret. Off makes 'Open your dashboard' open the dashboard's own login.",
    input: z.object({ clientId, enabled: z.boolean() }),
    run: async (viewer, { clientId, enabled }) => {
      if (!enabled) {
        await dashboardSso.clearDashboardSsoSecret(viewer, clientId);
        return { enabled: false };
      }
      return { enabled: true, secret: await dashboardSso.rotateDashboardSsoSecret(viewer, clientId) };
    },
  }),
  tool({
    name: "create_password_reset_link",
    description: "One-time link (valid 14 days) that lets a client user set a new password. Give it to them yourself; nothing is emailed.",
    input: z.object({ userId: uuid.describe("Client user id, from get_client") }),
    run: async (viewer, { userId }) => ({
      resetUrl: `${appUrl()}/reset/${await clientsData.createPasswordResetLink(viewer, userId)}`,
    }),
  }),
  tool({
    name: "remove_client_user",
    description: "Take away a client user's portal access. Their messages and requests stay.",
    input: z.object({ userId: uuid }),
    destructive: true,
    run: async (viewer, { userId }) => {
      await clientsData.removeClientUser(viewer, userId);
      return { removed: userId };
    },
  }),

  // ---- Sign-ups ----
  tool({
    name: "list_pending_signups",
    description: "People who signed up through the agency link and are waiting for approval.",
    input: noInput,
    readOnly: true,
    run: (viewer) => signupsData.listPendingSignups(viewer),
  }),
  tool({
    name: "approve_signup",
    description: "Approve a sign-up into an existing client (clientId) or a new client (newClientName). Give exactly one.",
    input: z
      .object({
        userId: uuid,
        clientId: clientId.optional(),
        newClientName: z.string().trim().min(1).max(200).optional(),
      })
      .refine((v) => Boolean(v.clientId) !== Boolean(v.newClientName), "Give either clientId or newClientName"),
    run: async (viewer, { userId, clientId, newClientName }) => ({
      clientId: await signupsData.approveSignup(viewer, userId, clientId ? { clientId } : { newClientName: newClientName! }),
    }),
  }),
  tool({
    name: "reject_signup",
    description: "Reject a pending sign-up and delete that account.",
    input: z.object({ userId: uuid }),
    destructive: true,
    run: async (viewer, { userId }) => {
      await signupsData.rejectSignup(viewer, userId);
      return { rejected: userId };
    },
  }),

  // ---- Monthly updates & work log ----
  tool({
    name: "list_monthly_notes",
    description: "A client's monthly updates, newest first.",
    input: z.object({ clientId }),
    readOnly: true,
    run: (viewer, { clientId }) => updatesData.listNotes(viewer, clientId),
  }),
  tool({
    name: "upsert_monthly_note",
    description: "Write a client's monthly update (wins, what we are working on, next month). Replaces that month's note if one exists.",
    input: z.object({
      clientId,
      month: z.string().regex(/^\d{4}-\d{2}$/, "Use YYYY-MM"),
      wins: z.string().trim().max(5000).default(""),
      workingOn: z.string().trim().max(5000).default(""),
      nextMonth: z.string().trim().max(5000).default(""),
    }),
    run: async (viewer, { clientId, ...input }) => {
      await updatesData.upsertNote(viewer, clientId, input);
      return updatesData.getLatestNote(viewer, clientId);
    },
  }),
  tool({
    name: "list_work_log",
    description: "The 'What we did for you' entries for a client, newest first.",
    input: z.object({ clientId, limit: z.number().int().min(1).max(200).default(50) }),
    readOnly: true,
    run: (viewer, { clientId, limit }) => updatesData.listWorkLog(viewer, clientId, limit),
  }),
  tool({
    name: "add_work_log",
    description: "Log a piece of work done for a client.",
    input: z.object({
      clientId,
      title: z.string().trim().min(1).max(300),
      tag: z.string().trim().min(1).max(40).describe("Short category, e.g. SEO, Website, Ads"),
      doneOn: isoDate,
    }),
    run: async (viewer, { clientId, ...input }) => {
      await updatesData.addWorkLog(viewer, clientId, input);
      return { added: input.title };
    },
  }),
  tool({
    name: "delete_work_log",
    description: "Delete a work log entry.",
    input: z.object({ entryId: uuid }),
    destructive: true,
    run: async (viewer, { entryId }) => {
      await updatesData.deleteWorkLog(viewer, entryId);
      return { deleted: entryId };
    },
  }),

  // ---- Requests ----
  tool({
    name: "list_open_requests",
    description: "Requests that are not done, across every client. The admin inbox.",
    input: noInput,
    readOnly: true,
    run: (viewer) => requestsData.listAgencyOpenRequests(viewer),
  }),
  tool({
    name: "list_requests",
    description: "All of one client's requests, including done ones.",
    input: z.object({ clientId }),
    readOnly: true,
    run: (viewer, { clientId }) => requestsData.listRequests(viewer, clientId),
  }),
  tool({
    name: "get_request",
    description: "A request with its details and comment thread.",
    input: z.object({ requestId: uuid }),
    readOnly: true,
    run: (viewer, { requestId }) => requestsData.getRequest(viewer, requestId),
  }),
  tool({
    name: "create_request",
    description: "Open a request on a client's behalf.",
    input: z.object({ clientId, title: z.string().trim().min(1).max(200), details: z.string().trim().max(5000).default("") }),
    run: async (viewer, { clientId, ...input }) => ({ requestId: await requestsData.createRequest(viewer, input, clientId) }),
  }),
  tool({
    name: "comment_on_request",
    description: "Add a comment to a request. The client sees it.",
    input: z.object({ requestId: uuid, body: z.string().trim().min(1).max(5000) }),
    run: async (viewer, { requestId, body }) => {
      await requestsData.addRequestComment(viewer, requestId, body);
      return { commented: requestId };
    },
  }),
  tool({
    name: "set_request_status",
    description: "Move a request along. 'review' asks the client to approve it; they mark it done by approving.",
    input: z.object({ requestId: uuid, status: z.enum(requestStatus.enumValues) }),
    run: async (viewer, { requestId, status }) => {
      await requestsData.setRequestStatus(viewer, requestId, status);
      return { requestId, status };
    },
  }),

  // ---- Messages ----
  tool({
    name: "list_messages",
    description: "The message thread with a client, oldest first.",
    input: z.object({ clientId }),
    readOnly: true,
    run: (viewer, { clientId }) => messagesData.listMessages(viewer, clientId),
  }),
  tool({
    name: "send_message",
    description: "Send a message to a client. It appears in their portal under your name.",
    input: z.object({ clientId, body: z.string().trim().min(1).max(5000) }),
    run: async (viewer, { clientId, body }) => {
      await messagesData.sendMessage(viewer, body, clientId);
      return { sent: true };
    },
  }),

  // ---- Files ----
  tool({
    name: "list_files",
    description: "A client's files with their approval state.",
    input: z.object({ clientId }),
    readOnly: true,
    run: (viewer, { clientId }) => filesData.listFiles(viewer, clientId),
  }),
  tool({
    name: "read_file",
    description: "Download a file's contents. Text files come back as text, everything else as base64. Up to 10 MB.",
    input: z.object({ fileId: uuid }),
    readOnly: true,
    run: async (viewer, { fileId }) => {
      const file = await filesData.getFile(viewer, fileId);
      if (file.sizeBytes > MAX_READ_BYTES) throw new Error("File is over 10 MB; download it from the portal instead");
      const data = await fetchStoredFile(file.storageKey);
      const isText = TEXT_MIME.test(file.mimeType);
      return {
        name: file.name,
        mimeType: file.mimeType,
        encoding: isText ? "utf-8" : "base64",
        content: data.toString(isText ? "utf-8" : "base64"),
      };
    },
  }),
  tool({
    name: "upload_file",
    description:
      "Upload a file to a client (max 25 MB). Pass text for plain text files or contentBase64 for anything else. needsApproval asks the client to approve it.",
    input: z
      .object({
        clientId,
        name: z.string().trim().min(1).max(255),
        mimeType: z.string().trim().max(200).default("application/octet-stream"),
        text: z.string().optional(),
        contentBase64: z.string().optional(),
        needsApproval: z.boolean().default(false),
        folder: z.enum(filesData.FOLDERS).default("").describe("'brand' puts it in the client's Brand kit (business card, logos)"),
      })
      .refine((v) => (v.text === undefined) !== (v.contentBase64 === undefined), "Give either text or contentBase64"),
    run: async (viewer, { clientId, name, mimeType, text, contentBase64, needsApproval, folder }) => {
      const data = text !== undefined ? Buffer.from(text, "utf-8") : Buffer.from(contentBase64!, "base64");
      await filesData.uploadFile(viewer, { name, mimeType, data, needsApproval, folder }, clientId);
      return { uploaded: name, sizeBytes: data.length };
    },
  }),
  tool({
    name: "delete_file",
    description: "Delete a file from the portal and from storage.",
    input: z.object({ fileId: uuid }),
    destructive: true,
    run: async (viewer, { fileId }) => {
      await filesData.deleteFile(viewer, fileId);
      return { deleted: fileId };
    },
  }),

  // ---- Invoices ----
  tool({
    name: "list_invoices",
    description: "A client's invoices, including drafts. amountCents is in cents.",
    input: z.object({ clientId }),
    readOnly: true,
    run: (viewer, { clientId }) => invoicesData.listInvoices(viewer, clientId),
  }),
  tool({
    name: "create_invoice",
    description: "Add an invoice for a client to view. Drafts are hidden from the client. Amount is in dollars.",
    input: z.object({
      clientId,
      number: z.string().trim().min(1).max(50),
      description: z.string().trim().max(500).default(""),
      amount: z.number().positive(),
      issuedOn: isoDate,
      dueOn: isoDate,
      status: z.enum(invoiceStatus.enumValues).default("draft"),
    }),
    run: async (viewer, { clientId, amount, ...rest }) => {
      await invoicesData.createInvoice(viewer, clientId, { ...rest, amountCents: Math.round(amount * 100) });
      return { created: rest.number };
    },
  }),
  tool({
    name: "set_invoice_status",
    description: "Mark an invoice draft, sent or paid.",
    input: z.object({ invoiceId: uuid, status: z.enum(invoiceStatus.enumValues) }),
    run: async (viewer, { invoiceId, status }) => {
      await invoicesData.setInvoiceStatus(viewer, invoiceId, status);
      return { invoiceId, status };
    },
  }),
  tool({
    name: "upsert_invoice",
    description:
      "Create or update an invoice by its number (LMS Dash uses this to keep the portal in step). Drafts are hidden from the client; only 'sent' counts toward the balance they owe. amountCents is in cents.",
    input: z.object({
      clientId,
      number: z.string().trim().min(1).max(50),
      description: z.string().trim().max(500).default(""),
      amountCents: z.number().int().min(0),
      issuedOn: isoDate,
      dueOn: isoDate,
      status: z.enum(invoiceStatus.enumValues),
    }),
    run: async (viewer, { clientId, ...input }) => invoicesData.upsertInvoice(viewer, clientId, input),
  }),
  tool({
    name: "delete_invoice",
    description:
      "Remove one of a client's invoices by its number (LMS Dash uses this when an invoice is deleted, renumbered or moved to another client there). Invoices come from LMS Dash: delete it there, not here, or the next sync puts it back.",
    input: z.object({ clientId, number: z.string().trim().min(1).max(50) }),
    destructive: true,
    run: async (viewer, { clientId, number }) => ({ deleted: await invoicesData.deleteInvoiceByNumber(viewer, clientId, number), number }),
  }),
  tool({
    name: "set_payment_instructions",
    description: "How clients pay, shown on every client's Billing page (e.g. the e-Transfer address).",
    input: z.object({ text: z.string().trim().max(1000) }),
    run: async (viewer, { text }) => {
      await clientsData.setPaymentInstructions(viewer, text);
      return { paymentInstructions: text };
    },
  }),

  // ---- Logins ----
  tool({
    name: "create_client_user",
    description:
      "Give someone a login to a client's portal without the sign-up step. Returns a one-time link (14 days) where they choose their own password. Nothing is emailed: send the link yourself.",
    input: z.object({ clientId, email: z.string().trim().email().max(320), name: z.string().trim().min(1).max(200) }),
    run: async (viewer, { clientId, ...input }) => {
      const { userId, token } = await clientsData.createClientUser(viewer, clientId, input);
      return { userId, setPasswordUrl: `${appUrl()}/reset/${token}` };
    },
  }),

  // ---- Requests: sync and clean-up ----
  tool({
    name: "list_request_activity",
    description:
      "Requests across all clients that changed after `since` (ISO time; omit for all), newest first, with client name, details and the comment thread. LMS Dash resyncs tickets with this.",
    input: z.object({ since: z.string().datetime({ offset: true }).optional(), limit: z.number().int().min(1).max(500).default(200) }),
    readOnly: true,
    run: (viewer, { since, limit }) => requestsData.listRequestActivity(viewer, since ? new Date(since) : undefined, limit),
  }),
  tool({
    name: "delete_request",
    description: "Delete a request and its comments. For test tickets and spam; close real ones with set_request_status done.",
    input: z.object({ requestId: uuid }),
    destructive: true,
    run: async (viewer, { requestId }) => {
      await requestsData.deleteRequest(viewer, requestId);
      return { deleted: requestId };
    },
  }),

  // ---- Results: site stats, rankings, AI answers ----
  tool({
    name: "set_stats_source",
    description:
      "Connect a client's website analytics: the site's stats URL (https://<domain>/api/stats) and its bearer token. Fetched right away, then hourly. Pass an empty statsUrl to disconnect. Omit statsToken to keep the stored one.",
    input: z.object({ clientId, statsUrl: z.string().trim().max(500), statsToken: z.string().trim().max(500).optional() }),
    run: async (viewer, { clientId, ...input }) => {
      await statsData.setStatsSource(viewer, clientId, input);
      const stats = await statsData.getSiteStats(viewer, clientId);
      return { connected: stats.connected, rows: stats.rows.length, since: stats.since, fetchedAt: stats.fetchedAt, error: stats.error };
    },
  }),
  tool({
    name: "get_site_stats",
    description: "The stored copy of a client's site counts (refreshed hourly): raw rows plus when it was fetched and any error.",
    input: z.object({ clientId }),
    readOnly: true,
    run: (viewer, { clientId }) => statsData.getSiteStats(viewer, clientId),
  }),
  tool({
    name: "sync_rankings",
    description:
      "Replace a client's tracked Google searches and monthly positions with this set (searches not listed are removed). positions maps YYYY-MM to a position, 0 = not found in the first 3 pages.",
    input: z.object({
      clientId,
      keywords: z
        .array(
          z.object({
            keyword: z.string().trim().min(1).max(200),
            priority: z.string().trim().max(40).optional(),
            positions: z.record(z.string().regex(/^\d{4}-\d{2}$/), z.number().int().min(0).max(100)),
          }),
        )
        .max(300),
    }),
    run: async (viewer, { clientId, keywords }) => ({ keywords: (await rankingsData.syncRankings(viewer, clientId, keywords)).length }),
  }),
  tool({
    name: "list_rankings",
    description: "A client's tracked searches with their monthly positions (0 = not found).",
    input: z.object({ clientId }),
    readOnly: true,
    run: (viewer, { clientId }) => rankingsData.listRankings(viewer, clientId),
  }),
  tool({
    name: "sync_ai_answers",
    description:
      "Replace a client's AI answer checks with this set. results maps YYYY-MM to { engine: 'yes' (named) | 'cited' (site cited) | 'no' (not named) }, engines like ChatGPT, Gemini, Perplexity, Google AI, Copilot, Claude.",
    input: z.object({
      clientId,
      questions: z
        .array(
          z.object({
            question: z.string().trim().min(1).max(500),
            results: z.record(z.string().regex(/^\d{4}-\d{2}$/), z.record(z.string().max(40), z.enum(rankingsData.AI_RESULTS))),
          }),
        )
        .max(200),
    }),
    run: async (viewer, { clientId, questions }) => ({ questions: (await rankingsData.syncAiAnswers(viewer, clientId, questions)).length }),
  }),

  // ---- LMS Dash: the client's portal tab ----
  tool({
    name: "get_client_portal",
    description:
      "Everything LMS Dash's portal tab shows for one client in one call: details, logins, monthly notes, work log, messages, files, to-dos and the analytics connection.",
    input: z.object({ clientId }),
    readOnly: true,
    run: async (viewer, { clientId }) => {
      const [client, users, notes, workLog, messages, files, todos, stats, source] = await Promise.all([
        clientsData.getClient(viewer, clientId),
        clientsData.listClientUsers(viewer, clientId),
        updatesData.listNotes(viewer, clientId),
        updatesData.listWorkLog(viewer, clientId, 100),
        messagesData.listMessages(viewer, clientId),
        filesData.listFiles(viewer, clientId),
        todosData.listTodos(viewer, clientId),
        statsData.getSiteStats(viewer, clientId),
        statsData.getStatsSource(viewer, clientId),
      ]);
      return {
        client,
        users,
        notes,
        workLog,
        messages: messages.slice(-100),
        files,
        todos,
        analytics: { ...source, connected: stats.connected, rows: stats.rows.length, since: stats.since, fetchedAt: stats.fetchedAt, error: stats.error },
      };
    },
  }),
  tool({
    name: "create_preview_link",
    description:
      "A one-time link (2 minutes) that opens this client's portal read-only, as they see it, for an hour. For View as client from LMS Dash. Optional userId picks which of their logins.",
    input: z.object({ clientId, userId: uuid.optional() }),
    run: async (viewer, { clientId, userId }) => ({ url: `${appUrl()}/preview/${await createPreviewLink(viewer, clientId, userId)}` }),
  }),
  tool({
    name: "redeem_sso_link",
    description:
      "For LMS Dash's one login: swaps the one-time token the portal handed an agency admin at sign-in (2 minutes, works once) for that admin's email and name. Fails for anything else.",
    input: z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{20,100}$/) }),
    run: async (viewer, { token }) => {
      const who = await redeemSsoLink(viewer, token);
      if (!who) throw new Error("That sign-in link has expired or was already used.");
      return who;
    },
  }),
  tool({
    name: "file_download_url",
    description: "A 5-minute download link for a client file. url is null when files are on local disk; use read_file then.",
    input: z.object({ fileId: uuid }),
    readOnly: true,
    run: async (viewer, { fileId }) => {
      const file = await filesData.getFile(viewer, fileId);
      return { name: file.name, mimeType: file.mimeType, sizeBytes: file.sizeBytes, url: await signedDownloadUrl(file.storageKey, file.name) };
    },
  }),

  // ---- To-dos for the client ----
  tool({
    name: "list_todos",
    description: "The things a client has to do themselves (open first), with their steps.",
    input: z.object({ clientId }),
    readOnly: true,
    run: (viewer, { clientId }) => todosData.listTodos(viewer, clientId),
  }),
  tool({
    name: "save_todo",
    description:
      "Add a to-do for the client, or edit one (pass todoId). steps: one step per line. The client sees it on their To-dos page, so confirm the wording first.",
    input: z.object({
      clientId,
      todoId: uuid.optional(),
      title: z.string().trim().min(1).max(200),
      why: z.string().trim().max(2000).default(""),
      steps: z.string().trim().max(8000).default(""),
      linkUrl: z.string().trim().max(500).optional(),
      linkLabel: z.string().trim().max(60).optional(),
      dueOn: isoDate.optional(),
      sort: z.number().int().min(0).max(1000).default(0),
    }),
    run: async (viewer, { clientId, todoId, ...input }) => ({ todoId: await todosData.saveTodo(viewer, clientId, input, todoId) }),
  }),
  tool({
    name: "set_todo_status",
    description: "Mark a client's to-do done, or reopen it.",
    input: z.object({ todoId: uuid, status: z.enum(["open", "done"]) }),
    run: async (viewer, { todoId, status }) => {
      await todosData.setTodoStatus(viewer, todoId, status);
      return { todoId, status };
    },
  }),
  tool({
    name: "delete_todo",
    description: "Delete a client's to-do.",
    input: z.object({ todoId: uuid }),
    destructive: true,
    run: async (viewer, { todoId }) => {
      await todosData.deleteTodo(viewer, todoId);
      return { deleted: todoId };
    },
  }),
];

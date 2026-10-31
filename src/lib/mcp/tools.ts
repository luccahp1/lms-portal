import { z } from "zod";
import { requestStatus, invoiceStatus } from "@/db/schema";
import type { Viewer } from "@/lib/data/viewer";
import * as clientsData from "@/lib/data/clients";
import * as requestsData from "@/lib/data/requests";
import * as messagesData from "@/lib/data/messages";
import * as filesData from "@/lib/data/files";
import * as updatesData from "@/lib/data/updates";
import * as invoicesData from "@/lib/data/invoices";
import * as signupsData from "@/lib/data/signups";
import { fetchStoredFile } from "@/lib/storage";

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
        clients: clients.map((c) => ({ id: c.id, name: c.name, websiteUrl: c.websiteUrl, planName: c.planName })),
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
    }),
  }),
  tool({
    name: "create_client",
    description: "Add a client. Its owner joins later through the agency sign-up link and is approved into it.",
    input: z.object({
      name: z.string().trim().min(1).max(200),
      websiteUrl: z.string().trim().max(500).optional(),
      planName: z.string().trim().max(200).optional(),
    }),
    run: (viewer, input) => clientsData.createClient(viewer, input),
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
      })
      .refine((v) => (v.text === undefined) !== (v.contentBase64 === undefined), "Give either text or contentBase64"),
    run: async (viewer, { clientId, name, mimeType, text, contentBase64, needsApproval }) => {
      const data = text !== undefined ? Buffer.from(text, "utf-8") : Buffer.from(contentBase64!, "base64");
      await filesData.uploadFile(viewer, { name, mimeType, data, needsApproval }, clientId);
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
];

import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { agencies, clients, intakes, startLinks, users } from "@/db/schema";
import { hashPassword, randomToken, sha256 } from "@/lib/auth/crypto";
import { cleanAnswers } from "@/lib/intake";
import { findTemplate } from "@/lib/templates";
import { notifyDashActivity } from "@/lib/webhook";
import { assertAdmin, ForbiddenError, NotFoundError, resolveClientId, type Viewer } from "./viewer";

// A new client's start: the personal link we send after the first call (/start/<token>),
// the design they pick and what they tell us about their business. The link works without
// a login until they create one through it; after that the same things live on the
// portal's "Your project" page.

const START_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type IntakePatch = {
  templateSlug?: string;
  templateNote?: string;
  answers?: Record<string, unknown>;
  /** They pressed Send: stamp submitted_at. */
  submit?: boolean;
};

/** A fresh link for this client. Any earlier unused link stops working. */
export async function createStartLink(viewer: Viewer, clientId: string, contactName = "") {
  assertAdmin(viewer);
  const id = await resolveClientId(viewer, clientId);
  const token = randomToken();
  const expiresAt = new Date(Date.now() + START_TTL_MS);
  await db.transaction(async (tx) => {
    await tx.delete(startLinks).where(and(eq(startLinks.clientId, id), isNull(startLinks.claimedAt)));
    await tx.insert(startLinks).values({
      tokenHash: sha256(token),
      agencyId: viewer.agencyId,
      clientId: id,
      contactName: contactName.trim().slice(0, 200),
      expiresAt,
    });
  });
  return { token, expiresAt };
}

/** Whether this client has a start link out, and whether it was used. Never the token. */
export async function getStartLinkState(viewer: Viewer, clientId: string) {
  assertAdmin(viewer);
  const id = await resolveClientId(viewer, clientId);
  const [row] = await db
    .select({ createdAt: startLinks.createdAt, expiresAt: startLinks.expiresAt, claimedAt: startLinks.claimedAt })
    .from(startLinks)
    .where(eq(startLinks.clientId, id))
    .orderBy(desc(startLinks.createdAt))
    .limit(1);
  if (!row) return null;
  return { ...row, state: row.claimedAt ? ("claimed" as const) : row.expiresAt > new Date() ? ("open" as const) : ("expired" as const) };
}

const emptyIntake = { templateSlug: null as string | null, templateNote: "", answers: {} as Record<string, string>, submittedAt: null as Date | null };

async function readIntake(clientId: string) {
  const [row] = await db
    .select({ templateSlug: intakes.templateSlug, templateNote: intakes.templateNote, answers: intakes.answers, submittedAt: intakes.submittedAt })
    .from(intakes)
    .where(eq(intakes.clientId, clientId));
  return row ?? emptyIntake;
}

/** The design pick and answers. A client reads their own; an admin names the client. */
export async function getIntake(viewer: Viewer, clientId?: string) {
  return readIntake(await resolveClientId(viewer, clientId));
}

async function writeIntake(ref: { clientId: string; agencyId: string }, patch: IntakePatch) {
  const before = await readIntake(ref.clientId);
  if (patch.templateSlug !== undefined && !findTemplate(patch.templateSlug)) throw new NotFoundError("No such design");
  const next = {
    templateSlug: patch.templateSlug ?? before.templateSlug,
    templateNote: patch.templateNote !== undefined ? patch.templateNote.trim().slice(0, 2000) : before.templateNote,
    answers: patch.answers !== undefined ? cleanAnswers(patch.answers) : before.answers,
    submittedAt: patch.submit ? new Date() : before.submittedAt,
    updatedAt: new Date(),
  };
  await db
    .insert(intakes)
    .values({ clientId: ref.clientId, agencyId: ref.agencyId, ...next })
    .onConflictDoUpdate({ target: intakes.clientId, set: next });
  // Autosaves are quiet; a new pick or a finished form tells the team.
  if (patch.submit || (patch.templateSlug && patch.templateSlug !== before.templateSlug)) {
    notifyDashActivity("intake.updated", ref.clientId, patch.submit ? { what: "answers" } : { what: "design", template: patch.templateSlug! });
  }
  return next;
}

/** Save from the portal, or by the team for a client who picked in a meeting. */
export async function saveIntake(viewer: Viewer, patch: IntakePatch, clientId?: string) {
  if (viewer.previewBy) throw new ForbiddenError();
  const id = await resolveClientId(viewer, clientId);
  return writeIntake({ clientId: id, agencyId: viewer.agencyId }, patch);
}

// ---- the start link, used without a login ----

async function loadLink(token: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const [row] = await db
    .select({
      tokenHash: startLinks.tokenHash,
      clientId: startLinks.clientId,
      agencyId: startLinks.agencyId,
      contactName: startLinks.contactName,
      claimedAt: startLinks.claimedAt,
      clientName: clients.name,
      agencyName: agencies.name,
    })
    .from(startLinks)
    .innerJoin(clients, eq(clients.id, startLinks.clientId))
    .innerJoin(agencies, eq(agencies.id, startLinks.agencyId))
    .where(and(eq(startLinks.tokenHash, sha256(token)), gt(startLinks.expiresAt, new Date())));
  return row ?? null;
}

/** Everything the start page shows, or null when the link is unknown or expired. */
export async function loadStart(token: string) {
  const link = await loadLink(token);
  if (!link) return null;
  return {
    clientId: link.clientId,
    clientName: link.clientName,
    agencyName: link.agencyName,
    contactName: link.contactName,
    claimed: Boolean(link.claimedAt),
    intake: await readIntake(link.clientId),
  };
}

export class LinkUsedError extends Error {
  constructor() {
    super("This link has already been used to create a login");
  }
}

export async function saveIntakeByToken(token: string, patch: IntakePatch) {
  const link = await loadLink(token);
  if (!link) throw new NotFoundError("This link has expired");
  // Once a login exists the link is spent: the holder edits in the portal, signed in.
  if (link.claimedAt) throw new LinkUsedError();
  return writeIntake(link, patch);
}

export class EmailTakenError extends Error {
  constructor() {
    super("Someone already uses that email address");
  }
}

/**
 * Create the client's first login through their start link. Works once per link; the
 * account is active straight away because we sent this link to this client ourselves.
 */
export async function claimStart(token: string, input: { name: string; email: string; password: string }) {
  const link = await loadLink(token);
  if (!link) throw new NotFoundError("This link has expired");
  if (link.claimedAt) throw new LinkUsedError();
  const email = input.email.trim().toLowerCase();
  const passwordHash = await hashPassword(input.password);
  const userId = await db.transaction(async (tx) => {
    const [taken] = await tx.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (taken) throw new EmailTakenError();
    const [user] = await tx
      .insert(users)
      .values({ agencyId: link.agencyId, clientId: link.clientId, role: "client", status: "active", email, name: input.name.trim(), passwordHash })
      .returning({ id: users.id });
    const burned = await tx
      .update(startLinks)
      .set({ claimedAt: new Date(), claimedById: user!.id })
      .where(and(eq(startLinks.tokenHash, link.tokenHash), isNull(startLinks.claimedAt)))
      .returning({ tokenHash: startLinks.tokenHash });
    if (burned.length === 0) throw new LinkUsedError();
    return user!.id;
  });
  notifyDashActivity("start.claimed", link.clientId, { name: input.name.trim() });
  return userId;
}

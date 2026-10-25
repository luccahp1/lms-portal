import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { messages, users } from "@/db/schema";
import { resolveClientId, type Viewer } from "./viewer";

export async function listMessages(viewer: Viewer, clientId?: string) {
  const id = await resolveClientId(viewer, clientId);
  return db
    .select({
      id: messages.id,
      body: messages.body,
      createdAt: messages.createdAt,
      authorId: messages.authorId,
      authorName: users.name,
      authorRole: users.role,
    })
    .from(messages)
    .leftJoin(users, eq(users.id, messages.authorId))
    .where(eq(messages.clientId, id))
    .orderBy(asc(messages.createdAt));
}

export async function sendMessage(viewer: Viewer, body: string, clientId?: string) {
  const id = await resolveClientId(viewer, clientId);
  await db.insert(messages).values({ agencyId: viewer.agencyId, clientId: id, authorId: viewer.userId, body });
}

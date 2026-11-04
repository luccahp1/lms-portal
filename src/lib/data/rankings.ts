import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "@/db";
import { aiAnswers, aiQuestions, keywordRanks, keywords } from "@/db/schema";
import { assertAdmin, resolveClientId, type Viewer } from "./viewer";

// Google rankings and AI answer checks. LMS Dash is where they are typed in; it pushes the
// full set here (sync_rankings / sync_ai_answers) and the portal shows them to the client.

const MONTH = /^\d{4}-\d{2}$/;

export type KeywordInput = { keyword: string; priority?: string; positions: Record<string, number> };
export type AiQuestionInput = { question: string; results: Record<string, Record<string, string>> };
export const AI_RESULTS = ["yes", "cited", "no"] as const;

/** Replace a client's tracked searches and their monthly positions with this set. */
export async function syncRankings(viewer: Viewer, clientId: string, input: KeywordInput[]) {
  assertAdmin(viewer);
  const id = await resolveClientId(viewer, clientId);
  const names = input.map((k) => k.keyword.trim()).filter(Boolean);
  await db.transaction(async (tx) => {
    if (names.length) {
      await tx.delete(keywords).where(and(eq(keywords.clientId, id), notInArray(keywords.keyword, names)));
    } else {
      await tx.delete(keywords).where(eq(keywords.clientId, id));
    }
    for (const [sort, k] of input.entries()) {
      const keyword = k.keyword.trim();
      if (!keyword) continue;
      const [row] = await tx
        .insert(keywords)
        .values({ agencyId: viewer.agencyId, clientId: id, keyword, priority: k.priority ?? "", sort })
        .onConflictDoUpdate({ target: [keywords.clientId, keywords.keyword], set: { priority: k.priority ?? "", sort } })
        .returning({ id: keywords.id });
      await tx.delete(keywordRanks).where(eq(keywordRanks.keywordId, row!.id));
      const ranks = Object.entries(k.positions)
        .filter(([m, p]) => MONTH.test(m) && Number.isInteger(p) && p >= 0 && p <= 100)
        .map(([month, position]) => ({ keywordId: row!.id, month, position }));
      if (ranks.length) await tx.insert(keywordRanks).values(ranks);
    }
  });
  return listRankings(viewer, id);
}

export async function listRankings(viewer: Viewer, clientId?: string) {
  const id = await resolveClientId(viewer, clientId);
  const kws = await db.select().from(keywords).where(eq(keywords.clientId, id)).orderBy(asc(keywords.sort));
  if (kws.length === 0) return [];
  const ranks = await db
    .select()
    .from(keywordRanks)
    .where(inArray(keywordRanks.keywordId, kws.map((k) => k.id)))
    .orderBy(asc(keywordRanks.month));
  return kws.map((k) => ({
    keyword: k.keyword,
    priority: k.priority,
    history: ranks.filter((r) => r.keywordId === k.id).map((r) => ({ month: r.month, position: r.position })),
  }));
}

/** Replace a client's AI answer checks with this set. */
export async function syncAiAnswers(viewer: Viewer, clientId: string, input: AiQuestionInput[]) {
  assertAdmin(viewer);
  const id = await resolveClientId(viewer, clientId);
  const names = input.map((q) => q.question.trim()).filter(Boolean);
  await db.transaction(async (tx) => {
    if (names.length) {
      await tx.delete(aiQuestions).where(and(eq(aiQuestions.clientId, id), notInArray(aiQuestions.question, names)));
    } else {
      await tx.delete(aiQuestions).where(eq(aiQuestions.clientId, id));
    }
    for (const [sort, q] of input.entries()) {
      const question = q.question.trim();
      if (!question) continue;
      const [row] = await tx
        .insert(aiQuestions)
        .values({ agencyId: viewer.agencyId, clientId: id, question, sort })
        .onConflictDoUpdate({ target: [aiQuestions.clientId, aiQuestions.question], set: { sort } })
        .returning({ id: aiQuestions.id });
      await tx.delete(aiAnswers).where(eq(aiAnswers.questionId, row!.id));
      const answers = Object.entries(q.results).flatMap(([month, engines]) =>
        MONTH.test(month)
          ? Object.entries(engines)
              .filter(([, r]) => (AI_RESULTS as readonly string[]).includes(r))
              .map(([engine, result]) => ({ questionId: row!.id, month, engine: engine.slice(0, 40), result }))
          : [],
      );
      if (answers.length) await tx.insert(aiAnswers).values(answers);
    }
  });
  return listAiAnswers(viewer, id);
}

export async function listAiAnswers(viewer: Viewer, clientId?: string) {
  const id = await resolveClientId(viewer, clientId);
  const qs = await db.select().from(aiQuestions).where(eq(aiQuestions.clientId, id)).orderBy(asc(aiQuestions.sort));
  if (qs.length === 0) return [];
  const answers = await db.select().from(aiAnswers).where(inArray(aiAnswers.questionId, qs.map((q) => q.id)));
  return qs.map((q) => ({
    question: q.question,
    answers: answers.filter((a) => a.questionId === q.id).map((a) => ({ month: a.month, engine: a.engine, result: a.result })),
  }));
}

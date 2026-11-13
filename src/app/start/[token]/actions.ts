"use server";

// Actions behind a start link. There is no session here: the link's token is the proof,
// checked on every call in src/lib/data/intake.ts.

import { redirect } from "next/navigation";
import { z } from "zod";
import { startSession } from "@/lib/auth/session";
import { claimStart, EmailTakenError, LinkUsedError, saveIntakeByToken } from "@/lib/data/intake";
import { NotFoundError } from "@/lib/data/viewer";
import type { ClaimState, IntakeResult } from "@/components/features/IntakeFlow";

function failure(err: unknown): { ok: false; error: string } {
  if (err instanceof LinkUsedError) return { ok: false, error: "This link was already used to create a login. Sign in to your portal to change anything." };
  if (err instanceof NotFoundError) return { ok: false, error: "This link has expired. Ask us for a new one." };
  if (err instanceof z.ZodError) return { ok: false, error: "That could not be saved. Try again." };
  throw err;
}

export async function pickTemplateAction(token: string, slug: string, note: string): Promise<IntakeResult> {
  try {
    await saveIntakeByToken(token, { templateSlug: z.string().max(40).parse(slug), templateNote: z.string().max(2000).parse(note) });
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function saveAnswersAction(token: string, answers: Record<string, string>, submit: boolean): Promise<IntakeResult> {
  try {
    await saveIntakeByToken(token, { answers: z.record(z.string().max(40), z.string().max(4000)).parse(answers), submit });
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

const claimSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name.").max(200),
    email: z.string().trim().email("Enter a valid email address."),
    password: z.string().min(10, "Use a password with at least 10 characters.").max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The passwords don’t match.", path: ["confirm"] });

export async function claimStartAction(token: string, _prev: ClaimState, formData: FormData): Promise<ClaimState> {
  const parsed = claimSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  let userId: string;
  try {
    userId = await claimStart(token, parsed.data);
  } catch (err) {
    if (err instanceof EmailTakenError) return { error: "There is already a login with that email. Sign in instead, or use another address." };
    if (err instanceof LinkUsedError) return { error: "This link was already used to create a login. Sign in instead." };
    if (err instanceof NotFoundError) return { error: "This link has expired. Ask us for a new one." };
    throw err;
  }
  await startSession(userId);
  redirect("/portal");
}

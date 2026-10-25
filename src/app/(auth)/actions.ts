"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { checkCredentials, endSession, startSession } from "@/lib/auth/session";
import { acceptInvite } from "@/lib/data/invites";

export type FormState = { error?: string } | undefined;

const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter your email and password." };
  const userId = await checkCredentials(parsed.data.email, parsed.data.password);
  if (!userId) return { error: "That email and password don’t match." };
  await startSession(userId);
  redirect("/");
}

const inviteSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(10, "Use at least 10 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The passwords don’t match.", path: ["confirm"] });

export async function acceptInviteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const userId = await acceptInvite(parsed.data.token, parsed.data.password);
  if (!userId) return { error: "This invite link has expired or was already used. Ask for a new one." };
  await startSession(userId);
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

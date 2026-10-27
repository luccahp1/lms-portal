"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { checkCredentials, endSession, startSession } from "@/lib/auth/session";
import { acceptInvite } from "@/lib/data/invites";
import { EmailTakenError, signUp } from "@/lib/data/signups";
import { NotFoundError } from "@/lib/data/viewer";

export type FormState = { error?: string } | undefined;

const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter your email and password." };
  const userId = await checkCredentials(parsed.data.email, parsed.data.password);
  if (!userId) return { error: "That email and password don’t match." };
  await startSession(userId, formData.get("remember") === "on");
  redirect("/");
}

const password = z.string().min(10, "Use a password with at least 10 characters.").max(200);

const signUpSchema = z
  .object({
    joinCode: z.string().min(1),
    name: z.string().trim().min(1, "Enter your name.").max(200),
    business: z.string().trim().min(1, "Enter your business name.").max(200),
    email: z.string().trim().email("Enter a valid email address."),
    password,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { message: "The passwords don’t match.", path: ["confirm"] });

export async function signUpAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  let userId: string;
  try {
    userId = await signUp(parsed.data);
  } catch (err) {
    if (err instanceof EmailTakenError) return { error: "There’s already an account with that email. Try logging in." };
    if (err instanceof NotFoundError) return { error: "This sign-up link isn’t valid. Ask your agency for a new one." };
    throw err;
  }
  await startSession(userId);
  redirect("/pending");
}

const resetSchema = z
  .object({ token: z.string().min(1), password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "The passwords don’t match.", path: ["confirm"] });

/** Password set/reset via a one-time link (admin bootstrap, or a reset link from the agency). */
export async function setPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form." };
  const userId = await acceptInvite(parsed.data.token, parsed.data.password);
  if (!userId) return { error: "This link has expired or was already used. Ask for a new one." };
  await startSession(userId);
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/login");
}

"use server";

import { revalidatePath } from "next/cache";
import { requireClient } from "@/lib/auth/session";
import { askForSettled } from "@/lib/data/settled";

/** The locked Invoicing page's button. */
export async function askForInvoicing(): Promise<{ ok: boolean; already?: boolean; message?: string }> {
  const viewer = await requireClient();
  if (viewer.previewBy) return { ok: false, message: "This is a preview. Clients ask from their own login." };
  const r = await askForSettled(viewer);
  revalidatePath("/portal/requests");
  return { ok: true, already: r.already };
}

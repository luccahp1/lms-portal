import { notFound } from "next/navigation";
import { NotFoundError } from "@/lib/data/viewer";

/** Turn the data layer's NotFoundError into Next's 404 page. */
export async function orNotFound<T>(promise: Promise<T>): Promise<T> {
  try {
    return await promise;
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
}

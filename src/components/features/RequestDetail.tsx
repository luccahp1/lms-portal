import Link from "next/link";
import { addCommentAction, approveRequestAction, setRequestStatusAction } from "@/app/actions";
import { formatDateTime, requestStatusLabel } from "@/lib/format";
import { Avatar, Button, Card, Pill, Select, Textarea } from "@/components/ui";
import { ResetForm } from "@/components/ResetForm";
import { requestStatus } from "@/db/schema";
import type { getRequest } from "@/lib/data/requests";
import { KIND_LABEL, PHONE_MAX, pageLabel, type NoteKind } from "@/lib/review/describe";

type Data = Awaited<ReturnType<typeof getRequest>>;

export function RequestDetail({ data, viewerRole, backHref }: { data: Data; viewerRole: "agency_admin" | "client"; backHref: string }) {
  const { request, comments, changeNotes } = data;
  const notesDone = changeNotes.filter((n) => n.doneAt).length;
  // With notes, the details repeat them in words (for LMS Dash); show only the first line here.
  const details = changeNotes.length ? request.details.split("\n\n")[0] : request.details;
  const status = requestStatusLabel[request.status];

  return (
    <>
      <Link href={backHref} className="text-accent hover:underline">
        ← All requests
      </Link>
      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{request.title}</h1>
            <p className="text-[13px] text-muted">Opened {formatDateTime(request.createdAt)}</p>
          </div>
          <Pill tone={status.tone}>{status.label}</Pill>
        </div>
        {details && <p className="whitespace-pre-line">{details}</p>}

        {changeNotes.length > 0 && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold">
                Marked on the {changeNotes[0]!.source === "template" ? "design" : "website"}
                <span className="ml-2 font-normal text-muted">
                  {notesDone} of {changeNotes.length} done
                </span>
              </h2>
              {viewerRole === "client" && (
                // A full page load: the review tool has its own layout.
                <a className="k-btn" href={`/review?request=${request.id}`}>
                  {request.status === "review" ? "Check the changes on the page" : "See these on the page"}
                </a>
              )}
            </div>
            <ol className="flex flex-col">
              {changeNotes.map((n, i) => (
                <li key={n.id} className="flex gap-3 border-t border-subtle py-3 first:border-t-0">
                  <span
                    className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${n.doneAt ? "bg-good" : "bg-[var(--coral)]"}`}
                    title={n.doneAt ? "Done" : "Not done yet"}
                  >
                    {n.doneAt ? "✓" : i + 1}
                  </span>
                  <div className="flex min-w-0 flex-col leading-snug">
                    <span className="text-[13px] text-muted">
                      {KIND_LABEL[n.kind as NoteKind] ?? "Note"} · {pageLabel(n)}
                      {n.viewportW > 0 && n.viewportW <= PHONE_MAX ? " · phone layout" : ""}
                    </span>
                    {n.kind === "text" ? (
                      <span>
                        <s className="text-muted">{n.textBefore}</s> <span className="font-medium text-accent">{n.textAfter}</span>
                      </span>
                    ) : (
                      n.anchor?.text && <span className="truncate text-[13px] text-muted">“{n.anchor.text}”</span>
                    )}
                    {n.body && <span className="whitespace-pre-line">{n.body}</span>}
                    {n.fileId && (
                      <a className="text-accent hover:underline" href={`/files/${n.fileId}`}>
                        Attached: {n.fileName ?? "file"}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {viewerRole === "client" && request.status === "review" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-warn-bg px-4 py-3">
            <span className="text-warn">This change is ready. Have a look and approve it, or reply below.</span>
            <form action={approveRequestAction}>
              <input type="hidden" name="requestId" value={request.id} />
              <Button type="submit">Approve</Button>
            </form>
          </div>
        )}

        {viewerRole === "agency_admin" && (
          <form action={setRequestStatusAction} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="requestId" value={request.id} />
            <label htmlFor="status" className="font-medium">
              Status
            </label>
            <div className="w-48">
              <Select id="status" name="status" defaultValue={request.status}>
                {requestStatus.enumValues.map((s) => (
                  <option key={s} value={s}>
                    {requestStatusLabel[s].label}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="secondary">
              Update
            </Button>
          </form>
        )}
      </Card>

      <Card className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">Conversation</h2>
        {comments.length === 0 && <p className="text-muted">No replies yet.</p>}
        <ul className="flex flex-col gap-4">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar text={c.authorRole === "agency_admin" ? "★" : (c.authorName?.[0] ?? "?")} accent={c.authorRole === "agency_admin"} />
              <div className="flex min-w-0 flex-col">
                <span className="text-[13px] text-muted">
                  {c.authorName ?? "Former user"} · {formatDateTime(c.createdAt)}
                </span>
                <p className="whitespace-pre-line">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
        <ResetForm action={addCommentAction} className="flex flex-col gap-2">
          <input type="hidden" name="requestId" value={request.id} />
          <label htmlFor="comment" className="sr-only">
            Reply
          </label>
          <Textarea id="comment" name="body" placeholder="Write a reply…" required />
          <div className="flex justify-end">
            <Button type="submit">Reply</Button>
          </div>
        </ResetForm>
      </Card>
    </>
  );
}

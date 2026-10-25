import Link from "next/link";
import { addCommentAction, approveRequestAction, setRequestStatusAction } from "@/app/actions";
import { formatDateTime, requestStatusLabel } from "@/lib/format";
import { Avatar, Button, Card, Pill, Select, Textarea } from "@/components/ui";
import { ResetForm } from "@/components/ResetForm";
import { requestStatus } from "@/db/schema";
import type { getRequest } from "@/lib/data/requests";

type Data = Awaited<ReturnType<typeof getRequest>>;

export function RequestDetail({ data, viewerRole, backHref }: { data: Data; viewerRole: "agency_admin" | "client"; backHref: string }) {
  const { request, comments } = data;
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
        {request.details && <p className="whitespace-pre-line">{request.details}</p>}

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

import { sendMessageAction } from "@/app/actions";
import { formatDateTime } from "@/lib/format";
import { Button, Card } from "@/components/ui";
import { ResetForm } from "@/components/ResetForm";
import { AutoRefresh } from "@/components/AutoRefresh";
import type { listMessages } from "@/lib/data/messages";

type Message = Awaited<ReturnType<typeof listMessages>>[number];

export function MessageThread({ messages, viewerId, clientId }: { messages: Message[]; viewerId: string; clientId?: string }) {
  return (
    <Card className="flex flex-col p-0">
      <AutoRefresh />
      <ol className="flex flex-col gap-3.5 p-6" aria-label="Messages">
        {messages.length === 0 && <li className="py-6 text-center text-muted">No messages yet. Say hi!</li>}
        {messages.map((m) => {
          const mine = m.authorId === viewerId;
          return (
            <li key={m.id} className={`flex flex-col gap-1 ${mine ? "items-end" : "items-start"}`}>
              <span className="text-xs text-muted">
                {mine ? "You" : (m.authorName ?? "Former user")} · {formatDateTime(m.createdAt)}
              </span>
              <div
                className={`max-w-[520px] rounded-[14px] px-3.5 py-2.5 whitespace-pre-line ${
                  mine ? "bg-accent text-white" : "bg-subtle text-ink"
                }`}
              >
                {m.body}
              </div>
            </li>
          );
        })}
      </ol>
      <ResetForm action={sendMessageAction} className="flex gap-2 border-t border-line px-6 py-4">
        {clientId && <input type="hidden" name="clientId" value={clientId} />}
        <label htmlFor="message" className="sr-only">
          Message
        </label>
        <input
          id="message"
          name="body"
          required
          maxLength={5000}
          autoComplete="off"
          placeholder="Write a message…"
          className="min-h-11 flex-1 rounded-[10px] border border-line-strong px-3.5"
        />
        <Button type="submit" className="min-h-11">
          Send
        </Button>
      </ResetForm>
    </Card>
  );
}

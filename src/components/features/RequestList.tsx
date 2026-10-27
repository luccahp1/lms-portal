import Link from "next/link";
import { formatDate, requestStatusLabel } from "@/lib/format";
import { Empty, Pill } from "@/components/ui";
import type { RequestStatus } from "@/db/schema";

type Row = { id: string; title: string; status: RequestStatus; createdAt: Date; commentCount?: number };

export function RequestList({ rows, basePath, compact = false }: { rows: Row[]; basePath: string; compact?: boolean }) {
  if (rows.length === 0) return <Empty>No requests yet.</Empty>;
  return (
    <ul className="flex flex-col">
      {rows.map((r) => {
        const status = requestStatusLabel[r.status];
        return (
          <li key={r.id} className="border-t border-subtle first:border-t-0">
            <Link
              href={`${basePath}/requests/${r.id}`}
              className={`flex items-center justify-between gap-3 hover:bg-canvas ${compact ? "py-2.5" : "-mx-2 rounded-lg px-2 py-4"}`}
            >
              <div className="flex min-w-0 flex-col leading-snug">
                <span className="font-medium">{r.title}</span>
                <span className="text-[13px] text-muted">
                  Opened {formatDate(r.createdAt)}
                  {r.commentCount ? ` · ${r.commentCount} comment${r.commentCount === 1 ? "" : "s"}` : ""}
                </span>
              </div>
              <Pill tone={status.tone}>{status.label}</Pill>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

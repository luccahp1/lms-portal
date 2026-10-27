import { deleteFileAction, respondToFileAction } from "@/app/actions";
import { fileApprovalLabel, formatBytes, formatDate } from "@/lib/format";
import { Button, Card, Empty, Pill } from "@/components/ui";
import type { listFiles } from "@/lib/data/files";

type FileRow = Awaited<ReturnType<typeof listFiles>>[number];

function kind(name: string) {
  const ext = name.includes(".") ? name.split(".").pop()! : "";
  return ext.slice(0, 4).toUpperCase() || "FILE";
}

export function FileList({ files, viewerRole }: { files: FileRow[]; viewerRole: "agency_admin" | "client" }) {
  return (
    <Card className="px-6 py-2">
      {files.length === 0 && <Empty>No files yet.</Empty>}
      <ul className="flex flex-col">
        {files.map((f) => {
          const approval = fileApprovalLabel[f.approval];
          const by = f.uploadedByRole === viewerRole && viewerRole === "client" ? "you" : (f.uploadedByName ?? "former user");
          return (
            <li key={f.id} className="flex flex-wrap items-center gap-3.5 border-b border-subtle py-4 last:border-b-0">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-[11px] font-bold text-accent">
                {kind(f.name)}
              </div>
              <div className="flex min-w-0 flex-[1_1_220px] flex-col leading-snug">
                <a href={`/files/${f.id}`} className="truncate font-medium text-ink hover:underline">
                  {f.name}
                </a>
                <span className="text-[13px] text-muted">
                  Uploaded by {by} · {formatDate(f.createdAt)} · {formatBytes(f.sizeBytes)}
                </span>
              </div>
              {viewerRole === "client" && f.approval === "pending" ? (
                <div className="flex gap-2">
                  <form action={respondToFileAction}>
                    <input type="hidden" name="fileId" value={f.id} />
                    <input type="hidden" name="decision" value="changes_requested" />
                    <Button type="submit" variant="secondary" className="min-h-9 text-[13px]">
                      Request changes
                    </Button>
                  </form>
                  <form action={respondToFileAction}>
                    <input type="hidden" name="fileId" value={f.id} />
                    <input type="hidden" name="decision" value="approved" />
                    <Button type="submit" className="min-h-9 text-[13px]">
                      Approve
                    </Button>
                  </form>
                </div>
              ) : (
                approval && <Pill tone={approval.tone}>{approval.label}</Pill>
              )}
              {viewerRole === "agency_admin" && (
                <form action={deleteFileAction}>
                  <input type="hidden" name="fileId" value={f.id} />
                  <button type="submit" className="cursor-pointer text-xs text-muted hover:text-[#b42318]" aria-label={`Delete ${f.name}`}>
                    Delete
                  </button>
                </form>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

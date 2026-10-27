import { deleteWorkLogAction } from "@/app/actions";
import { formatDate } from "@/lib/format";
import { Empty } from "@/components/ui";

type Entry = { id: string; title: string; tag: string; doneOn: string };

export function WorkLogList({ entries, canDelete = false }: { entries: Entry[]; canDelete?: boolean }) {
  if (entries.length === 0) return <Empty>Nothing logged yet.</Empty>;
  return (
    <ul className="flex flex-col">
      {entries.map((e) => (
        <li key={e.id} className="flex gap-3.5 py-2">
          <div className="pt-2">
            <div className="size-2 rounded-full bg-accent" />
          </div>
          <div className="flex flex-1 flex-col leading-snug">
            <span>{e.title}</span>
            <span className="text-xs text-muted">
              {formatDate(e.doneOn)} · {e.tag}
            </span>
          </div>
          {canDelete && (
            <form action={deleteWorkLogAction}>
              <input type="hidden" name="entryId" value={e.id} />
              <button type="submit" className="cursor-pointer text-xs text-muted hover:text-[#b42318]" aria-label={`Delete "${e.title}"`}>
                Delete
              </button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

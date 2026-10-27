import { formatMonth, lines } from "@/lib/format";
import { Avatar, Card } from "@/components/ui";

type Note = { month: string; wins: string; workingOn: string; nextMonth: string };

export function MonthlyNote({ note, agencyName }: { note: Note | null; agencyName: string }) {
  if (!note) {
    return (
      <Card>
        <p className="text-muted">Your first monthly update from {agencyName} will appear here.</p>
      </Card>
    );
  }
  const sections = [
    { label: "Done this month", tone: "text-good", items: lines(note.wins) },
    { label: "Working on", tone: "text-warn", items: lines(note.workingOn) },
    { label: "Next month", tone: "text-accent", items: lines(note.nextMonth) },
  ].filter((s) => s.items.length > 0);

  return (
    <Card className="flex flex-col gap-5 p-7">
      <div className="flex items-center gap-3">
        <Avatar text="★" accent />
        <div className="flex flex-col leading-snug">
          <span className="text-xl font-semibold tracking-tight">Your {formatMonth(note.month).split(" ")[0]} update</span>
          <span className="text-[13px] text-muted">From {agencyName}</span>
        </div>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        {sections.map((s) => (
          <div key={s.label}>
            <div className={`mb-1.5 text-xs font-semibold tracking-wider uppercase ${s.tone}`}>{s.label}</div>
            {s.items.length === 1 ? (
              <p>{s.items[0]}</p>
            ) : (
              <ul className="flex list-disc flex-col gap-1 pl-[18px]">
                {s.items.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

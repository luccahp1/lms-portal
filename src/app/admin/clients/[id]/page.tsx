import { requireAdmin } from "@/lib/auth/session";
import { getAgency } from "@/lib/data/clients";
import { listNotes, listWorkLog } from "@/lib/data/updates";
import { addWorkLogAction } from "@/app/actions";
import { Button, Card, CardTitle, Field, Input } from "@/components/ui";
import { WorkLogList } from "@/components/features/WorkLogList";
import { MonthlyNote } from "@/components/features/MonthlyNote";
import { NoteEditor } from "./NoteEditor";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function ClientUpdates({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAdmin();
  const { id } = await params;
  const [agency, notes, workLog] = await Promise.all([getAgency(viewer), listNotes(viewer, id), listWorkLog(viewer, id)]);
  const month = currentMonth();
  const thisMonth = notes.find((n) => n.month.startsWith(month)) ?? null;

  return (
    <>
      <Card>
        <CardTitle>Monthly update</CardTitle>
        <p className="mb-4 text-muted">This is the big card on the client’s Home page. One line per item.</p>
        <NoteEditor
          key={thisMonth?.id ?? "new"}
          clientId={id}
          month={month}
          initial={{ wins: thisMonth?.wins ?? "", workingOn: thisMonth?.workingOn ?? "", nextMonth: thisMonth?.nextMonth ?? "" }}
        />
      </Card>

      {notes[0] && (
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold">What the client sees now</h2>
          <MonthlyNote note={notes[0]} agencyName={agency.name} />
        </div>
      )}

      <Card>
        <CardTitle>Work log</CardTitle>
        <p className="mb-4 text-muted">Shows on the client’s Home page as “What we did for you”.</p>
        <form action={addWorkLogAction} className="mb-4 grid gap-3 sm:grid-cols-[1fr_160px_170px_auto] sm:items-end">
          <input type="hidden" name="clientId" value={id} />
          <Field label="What we did">
            <Input name="title" required maxLength={300} placeholder="e.g. Updated the services page" />
          </Field>
          <Field label="Type">
            <Input name="tag" required maxLength={40} defaultValue="Update" list="worklog-tags" />
          </Field>
          <Field label="Date">
            <Input name="doneOn" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
          </Field>
          <Button type="submit">Add</Button>
          <datalist id="worklog-tags">
            <option value="Update" />
            <option value="Content" />
            <option value="Fix" />
            <option value="Maintenance" />
            <option value="Request" />
            <option value="Design" />
          </datalist>
        </form>
        <WorkLogList entries={workLog} canDelete />
      </Card>
    </>
  );
}

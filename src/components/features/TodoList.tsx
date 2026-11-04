import { setTodoStatusAction } from "@/app/actions";
import type { ActionItem } from "@/db/schema";
import { formatDate, lines, today } from "@/lib/format";
import { Button, buttonClass, Card, Empty, Pill } from "@/components/ui";

function TodoCard({ todo, admin }: { todo: ActionItem; admin: boolean }) {
  const done = todo.status === "done";
  const overdue = !done && todo.dueOn && todo.dueOn < today();
  const steps = lines(todo.steps);
  return (
    <Card className={`flex flex-col gap-3 ${done ? "opacity-70" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className={`text-[17px] font-semibold ${done ? "line-through decoration-1" : ""}`}>{todo.title}</h2>
          {todo.why && <p className="text-[14px] text-ink-2">{todo.why}</p>}
        </div>
        {done ? (
          <Pill tone="good">Done{todo.doneAt ? ` ${formatDate(todo.doneAt)}` : ""}</Pill>
        ) : todo.dueOn ? (
          <Pill tone={overdue ? "warn" : "info"}>
            {overdue ? "Overdue" : "By"} {formatDate(todo.dueOn)}
          </Pill>
        ) : (
          <Pill tone="info">To do</Pill>
        )}
      </div>
      {!done && steps.length > 0 && (
        <ol className="flex flex-col gap-2">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-[14px]">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-semibold text-accent">
                {i + 1}
              </span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {!done && todo.linkUrl && (
          <a href={todo.linkUrl} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
            {todo.linkLabel || "Open"} ↗
          </a>
        )}
        <form action={setTodoStatusAction}>
          <input type="hidden" name="todoId" value={todo.id} />
          <input type="hidden" name="status" value={done ? "open" : "done"} />
          <Button type="submit" variant={done ? "ghost" : "primary"}>
            {done ? "Mark as not done" : admin ? "Mark done for them" : "I’ve done this"}
          </Button>
        </form>
      </div>
    </Card>
  );
}

export function TodoList({ todos, admin = false }: { todos: ActionItem[]; admin?: boolean }) {
  const open = todos.filter((t) => t.status === "open");
  const done = todos.filter((t) => t.status === "done");
  return (
    <>
      {open.length === 0 && (
        <Card>
          <Empty>{admin ? "Nothing open for this client." : "Nothing for you to do right now. We’ll add it here if we need you."}</Empty>
        </Card>
      )}
      {open.map((t) => (
        <TodoCard key={t.id} todo={t} admin={admin} />
      ))}
      {done.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer py-2 font-medium text-muted">Done ({done.length})</summary>
          <div className="mt-3 flex flex-col gap-4">
            {done.map((t) => (
              <TodoCard key={t.id} todo={t} admin={admin} />
            ))}
          </div>
        </details>
      )}
    </>
  );
}

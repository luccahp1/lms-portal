import { requireAdmin } from "@/lib/auth/session";
import { listTodos } from "@/lib/data/todos";
import { deleteTodoAction } from "@/app/actions";
import { Button, Card, CardTitle } from "@/components/ui";
import { TodoList } from "@/components/features/TodoList";
import { TodoForm } from "./TodoForm";

export default async function ClientTodos({ params }: { params: Promise<{ id: string }> }) {
  const viewer = await requireAdmin();
  const { id } = await params;
  const todos = await listTodos(viewer, id);
  return (
    <>
      <Card>
        <CardTitle>New to-do for the client</CardTitle>
        <p className="mb-4 text-muted">
          Things only they can do: verifying Google, signing something, sending us photos. They see it right away on
          their To-dos page with the steps.
        </p>
        <TodoForm clientId={id} />
      </Card>

      <h2 className="text-base font-semibold">As the client sees it</h2>
      <TodoList todos={todos} admin />

      {todos.length > 0 && (
        <Card>
          <CardTitle>Edit</CardTitle>
          <div className="flex flex-col gap-3">
            {todos.map((t) => (
              <details key={t.id} className="rounded-lg border border-line px-4 py-3">
                <summary className="cursor-pointer font-medium">
                  {t.title} <span className="text-[13px] font-normal text-muted">({t.status})</span>
                </summary>
                <div className="mt-4 flex flex-col gap-4">
                  <TodoForm clientId={id} todo={t} />
                  <form action={deleteTodoAction}>
                    <input type="hidden" name="todoId" value={t.id} />
                    <Button type="submit" variant="danger">
                      Delete
                    </Button>
                  </form>
                </div>
              </details>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

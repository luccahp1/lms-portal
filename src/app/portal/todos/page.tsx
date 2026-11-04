import { requireClient } from "@/lib/auth/session";
import { listTodos } from "@/lib/data/todos";
import { PageHeader } from "@/components/ui";
import { TodoList } from "@/components/features/TodoList";

export const metadata = { title: "Your to-dos" };

export default async function TodosPage() {
  const viewer = await requireClient();
  const todos = await listTodos(viewer);
  return (
    <>
      <PageHeader
        title="Your to-dos"
        subtitle="A few things only you can do. Each one has the steps to follow. Stuck? Send us a message."
      />
      <TodoList todos={todos} />
    </>
  );
}

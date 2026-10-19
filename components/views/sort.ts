import { PRIORITY_META, type Task } from "@/lib/types";

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      PRIORITY_META[a.priority].rank - PRIORITY_META[b.priority].rank ||
      (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
      a.id - b.id,
  );
}

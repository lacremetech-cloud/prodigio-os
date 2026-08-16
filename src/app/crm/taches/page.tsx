import type { Metadata } from "next";
import Link from "next/link";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { listOpenTasks, type TaskWithContext } from "@/modules/crm/data/queries";
import { formatDateTime, nowMs } from "@/modules/crm/format";
import { TaskToggle } from "@/components/crm/lead-actions";
import { Chip, EmptyState } from "@/components/crm/ui";

export const metadata: Metadata = { title: "Tâches" };

function TaskSection({
  title,
  items,
  tone,
}: {
  title: string;
  items: TaskWithContext[];
  tone?: "danger" | "gold";
}) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-[var(--crm-text)]">{title}</h2>
        <Chip variant={tone === "danger" ? "danger" : tone === "gold" ? "gold" : "neutral"}>
          {items.length}
        </Chip>
      </div>
      <div className="flex flex-col gap-2">
        {items.map(({ task, kind, href, contactLabel, city, opportunityId, buyerProfileId }) => (
          <div
            key={task.id}
            className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-3.5"
          >
            <div className="min-w-0">
              <p className="crm-wrap text-sm font-medium text-[var(--crm-text)]">{task.title}</p>
              <p className="crm-ellipsis text-xs text-[var(--crm-text-faint)]">
                <Link href={href} className="hover:text-[var(--crm-text)]">
                  {contactLabel}
                  {city ? ` · ${city}` : ""}
                </Link>
                {task.due_at ? ` · échéance ${formatDateTime(task.due_at)}` : " · sans échéance"}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {/* Le dossier d'origine reste explicite : Mandats ou Acquéreurs. */}
              <Chip variant={kind === "acquereur" ? "gold" : "neutral"}>
                {kind === "acquereur" ? "Acquéreur" : "Mandat"}
              </Chip>
              <TaskToggle
                taskId={task.id}
                status={task.status}
                opportunityId={opportunityId ?? undefined}
                buyerProfileId={buyerProfileId ?? undefined}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function TasksPage() {
  await requireCrmSession("/crm/taches");
  const tasks = await listOpenTasks();
  const now = nowMs();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  const overdue: TaskWithContext[] = [];
  const today: TaskWithContext[] = [];
  const later: TaskWithContext[] = [];
  for (const t of tasks) {
    const due = t.task.due_at ? new Date(t.task.due_at).getTime() : null;
    if (due != null && due < now) overdue.push(t);
    else if (due != null && due >= dayStart.getTime() && due <= dayEnd.getTime()) today.push(t);
    else later.push(t);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header>
        <p className="crm-eyebrow">Suivi opérationnel</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">Tâches &amp; rappels</h1>
        <p className="mt-1 text-sm text-[var(--crm-text-dim)]">
          {tasks.length} action{tasks.length > 1 ? "s" : ""} ouverte{tasks.length > 1 ? "s" : ""}.
        </p>
      </header>

      {tasks.length === 0 ? (
        <EmptyState
          title="Aucune tâche ouverte."
          hint="Programmez une prochaine action depuis un dossier pour la voir apparaître ici."
          icon="✓"
        />
      ) : (
        <>
          <TaskSection title="En retard" items={overdue} tone="danger" />
          <TaskSection title="Aujourd’hui" items={today} tone="gold" />
          <TaskSection title="À venir / sans échéance" items={later} />
        </>
      )}
    </div>
  );
}

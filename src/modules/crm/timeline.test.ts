import { describe, expect, it } from "vitest";
import { buildTimeline } from "./timeline";
import type { ActivityRow, AuditEventRow, TaskRow } from "@/lib/supabase/types";

const activity = (over: Partial<ActivityRow>): ActivityRow => ({
  id: "act-1",
  created_at: "2026-07-30T10:00:00.000Z",
  occurred_at: "2026-07-30T10:00:00.000Z",
  opportunity_id: "opp",
  contact_id: null,
  author_user_id: "u1",
  type: "appel",
  outcome: null,
  body: null,
  metadata: null,
  ...over,
});

const audit = (over: Partial<AuditEventRow>): AuditEventRow => ({
  id: "aud-1",
  created_at: "2026-07-30T11:00:00.000Z",
  actor_user_id: "u1",
  entity_type: "opportunity",
  entity_id: "opp",
  event_type: "changement_stade",
  old_value: null,
  new_value: null,
  metadata: null,
  ...over,
});

const task = (over: Partial<TaskRow>): TaskRow => ({
  id: "task-1",
  created_at: "2026-07-30T09:00:00.000Z",
  updated_at: "2026-07-30T09:00:00.000Z",
  opportunity_id: "opp",
  author_user_id: "u1",
  assignee_user_id: "u1",
  title: "Rappeler",
  kind: "rappel",
  status: "a_faire",
  due_at: null,
  completed_at: null,
  ...over,
});

describe("buildTimeline", () => {
  const nameFor = (uid: string | null) => (uid ? "alice" : null);

  it("fusionne activités, audit et tâches et trie du plus récent au plus ancien", () => {
    const t = buildTimeline({
      activities: [activity({ occurred_at: "2026-07-30T10:00:00.000Z" })],
      auditEvents: [audit({ created_at: "2026-07-30T11:00:00.000Z" })],
      tasks: [task({ created_at: "2026-07-30T09:00:00.000Z" })],
      nameFor,
    });
    expect(t).toHaveLength(3);
    expect(t.map((e) => e.source)).toEqual(["audit", "activity", "task"]);
    expect(t[0]?.author).toBe("alice");
  });

  it("mappe le libellé d'un appel avec résultat", () => {
    const [e] = buildTimeline({
      activities: [activity({ type: "appel", outcome: "contact_etabli" })],
      auditEvents: [],
      tasks: [],
      nameFor,
    });
    expect(e?.title).toBe("Appel — Contact établi");
    expect(e?.tone).toBe("ok");
  });

  it("décrit un changement de stade avec libellés lisibles", () => {
    const [e] = buildTimeline({
      activities: [],
      auditEvents: [
        audit({
          event_type: "changement_stade",
          old_value: { pipeline_stage: "nouveau" },
          new_value: { pipeline_stage: "contact_etabli" },
        }),
      ],
      tasks: [],
      nameFor,
    });
    expect(e?.body).toBe("Nouveau → Contacté");
  });
});

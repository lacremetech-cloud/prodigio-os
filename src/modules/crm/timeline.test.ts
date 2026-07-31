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


describe("buildTimeline — type visuel (kind) par événement", () => {
  const nameFor = () => "Membre";
  it("assigne le bon kind aux activités", () => {
    const [appel] = buildTimeline({ activities: [activity({ type: "appel" })], auditEvents: [], tasks: [], nameFor });
    expect(appel?.kind).toBe("appel");
    const [rdv] = buildTimeline({ activities: [activity({ id: "a2", type: "rendez_vous" })], auditEvents: [], tasks: [], nameFor });
    expect(rdv?.kind).toBe("rendez_vous");
  });

  it("assigne le bon kind aux événements d'audit du cycle mandat", () => {
    const kinds = (evt: string) =>
      buildTimeline({
        activities: [],
        auditEvents: [audit({ id: evt, event_type: evt as AuditEventRow["event_type"] })],
        tasks: [],
        nameFor,
      })[0]?.kind;
    expect(kinds("changement_stade")).toBe("stade");
    expect(kinds("changement_segment")).toBe("segment");
    expect(kinds("resultat_commercial")).toBe("resultat");
    expect(kinds("decision_eligibilite")).toBe("eligibilite");
    expect(kinds("mandat_signe")).toBe("mandat");
    expect(kinds("document_ajoute")).toBe("document");
    expect(kinds("estimation_realisee")).toBe("estimation");
  });

  it("assigne le kind « tache » aux tâches", () => {
    const [t] = buildTimeline({ activities: [], auditEvents: [], tasks: [task({})], nameFor });
    expect(t?.kind).toBe("tache");
  });
});

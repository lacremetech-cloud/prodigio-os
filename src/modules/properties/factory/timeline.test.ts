import { describe, expect, it } from "vitest";
import { buildPropertyTimeline } from "./timeline";
import type { AuditEventRow } from "@/lib/supabase/types";

const audit = (over: Partial<AuditEventRow>): AuditEventRow => ({
  id: "aud-1",
  created_at: "2026-08-01T10:00:00.000Z",
  actor_user_id: "u1",
  entity_type: "property",
  entity_id: "prop-1",
  event_type: "bien_identite",
  old_value: null,
  new_value: null,
  metadata: null,
  ...over,
});

const nameFor = (uid: string | null) => (uid ? "Julie" : null);

describe("buildPropertyTimeline", () => {
  it("traduit les types d'événement du bien en libellés lisibles", () => {
    const [e] = buildPropertyTimeline([audit({ event_type: "bien_media_ajoute" })], nameFor);
    expect(e?.title).toBe("Média ajouté");
    expect(e?.author).toBe("Julie");
    expect(e?.source).toBe("audit");
  });

  it("décrit une transition de statut avec ancien → nouveau", () => {
    const [e] = buildPropertyTimeline(
      [
        audit({
          event_type: "bien_statut",
          old_value: { status: "collecte_en_cours" },
          new_value: { status: "production_en_cours" },
        }),
      ],
      nameFor,
    );
    expect(e?.body).toBe("collecte_en_cours → production_en_cours");
  });

  it("marque « bien prêt » avec une tonalité positive", () => {
    const [e] = buildPropertyTimeline(
      [audit({ event_type: "bien_pret", new_value: { status: "pret_a_lancer" } })],
      nameFor,
    );
    expect(e?.tone).toBe("ok");
    expect(e?.title).toBe("Bien déclaré prêt à lancer");
  });

  it("trie du plus récent au plus ancien", () => {
    const t = buildPropertyTimeline(
      [
        audit({ id: "a", created_at: "2026-08-01T09:00:00.000Z" }),
        audit({ id: "b", created_at: "2026-08-01T11:00:00.000Z" }),
      ],
      nameFor,
    );
    expect(t.map((e) => e.key)).toEqual(["audit-b", "audit-a"]);
  });

  it("n'expose que des données non sensibles (type + statut, jamais de contenu)", () => {
    const [e] = buildPropertyTimeline(
      [
        audit({
          event_type: "bien_document_ajoute",
          new_value: { category: "mandat" },
        }),
      ],
      nameFor,
    );
    // Le corps ne contient pas de contenu de document ni de chemin ; seul le titre est exposé.
    expect(e?.title).toBe("Document ajouté");
    expect(e?.body).toBeNull();
  });
});

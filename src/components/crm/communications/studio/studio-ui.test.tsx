// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";

/**
 * Rendu RÉEL des écrans du studio, en jsdom.
 *
 * Vérifie ce qu'un test de logique ne peut pas voir : la sémantique
 * (statut = couleur **et** icône **et** libellé), les états vide / erreur, le
 * confinement du défilement horizontal, l'accessibilité clavier, et l'absence
 * de donnée personnelle ou de secret dans le rendu.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => "/crm/communications",
}));

vi.mock("@/modules/communications/actions", () => ({
  setTemplateStatusAction: async () => ({ ok: true }),
  upsertTemplateAction: async () => ({ ok: true }),
  setAutomationStatusAction: async () => ({ ok: true }),
  upsertAutomationAction: async () => ({ ok: true }),
  releaseSuppressionAction: async () => ({ ok: true }),
}));

import { OverviewStats } from "./overview-stats";
import { ActivationCenter } from "./activation-center";
import { AutomationStudio } from "./automation-studio";
import { WorkflowSimulator } from "./workflow-simulator";
import { SuppressionsView } from "./suppressions-view";
import { TemplateStudio } from "./template-studio";
import { SYNTHETIC_MARKER } from "@/modules/communications/studio";

afterEach(() => cleanup());

const STATS = {
  prepares: 4,
  enAttente: 1,
  enFileFournisseur: 2,
  echecs: 1,
  livraisonsProuvees: 0,
  livresSansPreuve: 0,
  bloques: 3,
  ignores: 2,
  oppositionsActives: 1,
  automatisationsSysteme: 6,
  brouillonsPersonnalises: 0,
};

describe("vue d'ensemble", () => {
  it("distingue « en file » de « livré », sans jamais les confondre", () => {
    render(
      <OverviewStats
        stats={STATS}
        blockedReasons={[{ reason: "envoi_desactive", count: 3 }]}
        skippedReasons={[]}
      />,
    );
    const enFile = screen.getByText(/En file chez le fournisseur/i).closest("div")?.parentElement;
    expect(enFile?.textContent).toMatch(/Ni « envoyé », ni « livré »/);
    expect(screen.getByText(/Livraisons prouvées/i)).toBeTruthy();
    expect(document.body.textContent).toMatch(/preuve fournisseur/i);
  });

  it("traduit les motifs de blocage en français, jamais un code brut", () => {
    render(
      <OverviewStats
        stats={STATS}
        blockedReasons={[{ reason: "envoi_desactive", count: 3 }]}
        skippedReasons={[]}
      />,
    );
    expect(screen.getByText("L'envoi réel est désactivé")).toBeTruthy();
    expect(screen.queryByText("envoi_desactive")).toBeNull();
  });

  it("affiche un état vide explicite quand aucun motif n'est constaté", () => {
    render(<OverviewStats stats={STATS} blockedReasons={[]} skippedReasons={[]} />);
    expect(screen.getByText("Aucun blocage constaté.")).toBeTruthy();
    expect(screen.getByText("Aucun événement ignoré.")).toBeTruthy();
  });

  it("signale comme ANOMALIE un « livré » sans preuve, au lieu de le taire", () => {
    render(
      <OverviewStats
        stats={{ ...STATS, livresSansPreuve: 2 }}
        blockedReasons={[]}
        skippedReasons={[]}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toMatch(/sans preuve fournisseur/i);
  });
});

describe("centre d'activation", () => {
  const READINESS = {
    emailProviderConfigured: false,
    smsProviderConfigured: false,
    dispatchEnabled: false,
    activeTemplateCount: 0,
    templateCount: 6,
    queueProcessable: false,
    deliveryProofAvailable: false,
  };

  it("sépare transactionnel et marketing, et bloque le marketing", () => {
    render(<ActivationCenter readiness={READINESS} />);
    expect(screen.getByRole("heading", { name: "Transactionnel" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Marketing" })).toBeTruthy();
    expect(screen.getAllByText(/Activation bloquée/).length).toBeGreaterThan(0);
  });

  it("n'affirme JAMAIS une conformité RGPD", () => {
    render(<ActivationCenter readiness={READINESS} />);
    expect(document.body.textContent).not.toMatch(/conforme/i);
  });

  it("énonce, pour chaque constat non prêt, ce qu'il reste à faire", () => {
    render(<ActivationCenter readiness={READINESS} />);
    expect(screen.getAllByText(/^À faire :/).length).toBe(6);
  });

  it("liste les sept décisions à trancher", () => {
    render(<ActivationCenter readiness={READINESS} />);
    expect(screen.getAllByText("À trancher").length).toBe(7);
  });
});

describe("automatisations", () => {
  it("affiche les six automatisations système en lecture seule", () => {
    render(<AutomationStudio automations={[]} templates={[]} />);
    expect(screen.getAllByText("Lecture seule")).toHaveLength(6);
    expect(screen.getAllByText("Système")).toHaveLength(6);
  });

  it("n'offre AUCUN bouton d'activation d'un workflow personnalisé", () => {
    render(
      <AutomationStudio
        automations={[
          {
            id: "a1",
            automationKey: "relance",
            version: 1,
            name: "Relance",
            triggerEvent: "estimation_rappel",
            templateKey: "estimation_rappel",
            templateVersion: 1,
            channel: "email",
            delayMinutes: 60,
            conditions: { segment: "cible_prodigio_premium" },
            status: "brouillon",
            notes: null,
            updatedAt: "2026-08-19T10:00:00.000Z",
          },
        ]}
        templates={[{ templateKey: "estimation_rappel", channel: "email", versions: [1] }]}
      />,
    );
    for (const button of screen.getAllByRole("button")) {
      expect(button.textContent?.toLowerCase()).not.toMatch(/activer|démarrer|lancer|exécuter/);
    }
    expect(screen.getByText("Prêt pour revue")).toBeTruthy();
    expect(screen.getByText("Suspendu")).toBeTruthy();
  });

  it("annonce explicitement que le statut « actif » n'existe pas", () => {
    render(<AutomationStudio automations={[]} templates={[]} />);
    expect(document.body.textContent).toMatch(/jamais « actif »/);
  });

  it("affiche un état vide quand aucun brouillon n'existe", () => {
    render(<AutomationStudio automations={[]} templates={[]} />);
    expect(screen.getByText("Aucun brouillon")).toBeTruthy();
  });
});

describe("simulateur", () => {
  const TEMPLATES = [
    {
      templateKey: "mandat_demande_accusee",
      version: 1,
      status: "actif" as const,
      channel: "email",
      category: "transactionnel",
      subject: "Votre demande a bien été reçue",
      body: "Bonjour {{prenom}}, votre bien à {{ville}} est enregistré.",
      bodyFormat: "markdown" as const,
      allowedVariables: ["prenom", "nom", "ville"],
    },
  ];

  it("annonce son caractère fictif et l'absence d'effet", () => {
    render(<WorkflowSimulator templates={TEMPLATES} dispatchEnabled />);
    expect(screen.getAllByText(SYNTHETIC_MARKER).length).toBeGreaterThan(0);
    expect(screen.getByText("Aucune écriture")).toBeTruthy();
    expect(screen.getByText("Aucun appel fournisseur")).toBeTruthy();
    expect(screen.getByText("Aucune donnée réelle")).toBeTruthy();
    expect(screen.getByText("Aucun événement d'audit")).toBeTruthy();
  });

  it("n'expose AUCUN bouton d'exécution réelle — il n'expose aucun bouton du tout", () => {
    render(<WorkflowSimulator templates={TEMPLATES} dispatchEnabled />);
    // La simulation se recalcule à chaque changement de paramètre : il n'y a
    // rien à « déclencher », donc aucune action à confondre avec un envoi.
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });

  it("déroule les dix étapes, chacune avec un libellé de résultat lisible", () => {
    render(<WorkflowSimulator templates={TEMPLATES} dispatchEnabled />);
    for (const label of [
      "Événement reçu",
      "Conditions évaluées",
      "Éligibilité du destinataire",
      "Base légale enregistrée",
      "Oppositions",
      "Canal sélectionné",
      "Délai calculé",
      "Modèle et version",
      "Variables résolues",
      "Décision finale",
    ]) {
      expect(screen.getAllByText(new RegExp(label)).length, label).toBeGreaterThan(0);
    }
  });

  it("expose la décision dans une zone annoncée (role=status)", () => {
    render(<WorkflowSimulator templates={TEMPLATES} dispatchEnabled />);
    const statuses = screen.getAllByRole("status");
    expect(statuses.some((s) => /PRÉPARÉ|BLOQUÉ|refusée/.test(s.textContent ?? ""))).toBe(true);
  });
});

describe("oppositions", () => {
  const ROW = {
    id: "s1",
    contactName: "Camille Fictive",
    channel: "tout" as const,
    scope: "tout" as const,
    reason: "desinscription",
    source: "humain",
    provider: null,
    notes: null,
    createdAt: "2026-08-19T10:00:00.000Z",
    active: true,
    releasedAt: null,
    releasedReason: null,
  };

  it("signale la priorité d'une opposition globale", () => {
    render(<SuppressionsView rows={[ROW]} canRelease />);
    expect(document.body.textContent).toMatch(/opposition globale.*prévaut|globale\(s\) active/i);
    expect(screen.getByText("Tous canaux")).toBeTruthy();
    expect(screen.getByText("Toute finalité")).toBeTruthy();
  });

  it("n'affiche jamais une coordonnée, seulement le nom du contact", () => {
    render(<SuppressionsView rows={[ROW]} canRelease />);
    expect(document.body.textContent).not.toMatch(/@|\+33/);
  });

  it("cache le bouton de levée et l'explique quand le rôle ne l'autorise pas", () => {
    render(<SuppressionsView rows={[ROW]} canRelease={false} />);
    expect(screen.queryByRole("button", { name: "Lever" })).toBeNull();
    expect(screen.getByText(/réservée à l'administrateur/i)).toBeTruthy();
  });

  it("confine le tableau dans un conteneur à défilement propre", () => {
    render(<SuppressionsView rows={[ROW]} canRelease />);
    const wrapper = screen.getByRole("table").parentElement;
    expect(wrapper?.className).toContain("overflow-x-auto");
    expect(wrapper?.className).toContain("crm-scroll");
  });

  it("propose une légende de tableau accessible", () => {
    render(<SuppressionsView rows={[ROW]} canRelease />);
    const table = screen.getByRole("table");
    expect(within(table).getByText(/Oppositions enregistrées/)).toBeTruthy();
  });

  it("affiche un état vide quand aucune opposition n'est active", () => {
    render(<SuppressionsView rows={[]} canRelease />);
    expect(screen.getByText("Aucune opposition active")).toBeTruthy();
  });
});

describe("modèles", () => {
  const FAMILY = {
    templateKey: "mandat_demande_accusee",
    channel: "email",
    category: "transactionnel",
    activeVersion: null,
    versions: [
      {
        id: "t1",
        templateKey: "mandat_demande_accusee",
        version: 1,
        name: "Accusé de réception",
        channel: "email",
        category: "transactionnel",
        status: "brouillon",
        subject: "Votre demande a bien été reçue",
        body: "Bonjour {{prenom}}, votre bien à {{ville}}.",
        bodyFormat: "markdown" as const,
        previewText: null,
        allowedVariables: ["prenom", "nom", "ville"],
        notes: null,
        updatedAt: "2026-08-19T10:00:00.000Z",
      },
    ],
  };

  it("prévisualise sur données fictives et le dit", () => {
    render(<TemplateStudio families={[FAMILY]} />);
    expect(document.body.textContent).toMatch(/données FICTIF/);
    expect(screen.getByText(/Aucun contact réel/)).toBeTruthy();
  });

  it("propose les deux formats de prévisualisation, en onglets accessibles", () => {
    render(<TemplateStudio families={[FAMILY]} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.some((t) => t.textContent === "Ordinateur")).toBe(true);
    expect(tabs.some((t) => t.textContent === "Mobile")).toBe(true);
    for (const tab of tabs) expect(tab.getAttribute("aria-selected")).toBeTruthy();
  });

  it("affiche un état vide quand aucun modèle n'existe", () => {
    render(<TemplateStudio families={[]} />);
    expect(screen.getByText("Aucun modèle")).toBeTruthy();
  });

  it("confine la table des versions dans un conteneur à défilement", () => {
    render(<TemplateStudio families={[FAMILY]} />);
    const wrapper = screen.getByRole("table").parentElement;
    expect(wrapper?.className).toContain("overflow-x-auto");
  });
});

describe("accessibilité transverse", () => {
  it("n'utilise que de vrais boutons et champs (navigation clavier native)", () => {
    render(<WorkflowSimulator templates={[]} dispatchEnabled={false} />);
    for (const el of Array.from(document.querySelectorAll("[onclick]"))) {
      expect(["BUTTON", "A", "INPUT", "SELECT"]).toContain(el.tagName);
    }
    for (const combo of screen.getAllByRole("combobox")) {
      expect(combo.tagName).toBe("SELECT");
    }
  });

  it("étiquette chaque champ de condition, même sans libellé visible", () => {
    render(<WorkflowSimulator templates={[]} dispatchEnabled={false} />);
    for (const box of screen.getAllByRole("checkbox")) {
      expect(box.closest("label")).not.toBeNull();
    }
  });
});

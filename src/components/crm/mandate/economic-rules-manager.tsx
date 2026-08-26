"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  registerPartnerOrganizationAction,
  upsertEconomicRuleAction,
  type ActionResult,
} from "@/modules/mandates/lifecycle/actions";
import {
  economicRuleStatusLabels,
  feeBasisLabels,
} from "@/modules/mandates/lifecycle/labels";
import { safeAction } from "@/modules/crm/safe-action";

function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const run = (fn: () => Promise<ActionResult>, onOk?: () => void) => {
    setError(null);
    setDone(false);
    start(async () => {
      const res = await safeAction(fn);
      if (res.ok) {
        setDone(true);
        onOk?.();
        router.refresh();
      } else {
        setError(res.error ?? "Erreur");
      }
    });
  };
  return { pending, error, done, run };
}

export interface HolderOption {
  id: string;
  name: string;
}

/** Formulaire de création d'une règle économique (nouvelle version incluse). */
export function EconomicRuleForm({ holders }: { holders: HolderOption[] }) {
  const { pending, error, done, run } = useAction();
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [effectiveTo, setEffectiveTo] = useState("");
  const [feeBasis, setFeeBasis] = useState("a_confirmer");
  const [prodigio, setProdigio] = useState("");
  const [partner, setPartner] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [status, setStatus] = useState("actif");
  const [notes, setNotes] = useState("");

  const numOrNull = (v: string) => {
    const t = v.trim();
    if (t === "") return null;
    const n = Number(t.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || !segment.trim() || !effectiveFrom) return;
        run(
          () =>
            upsertEconomicRuleAction({
              id: null,
              name: name.trim(),
              segment: segment.trim(),
              effectiveFrom,
              effectiveTo: effectiveTo || null,
              feeBasis,
              prodigioSharePct: numOrNull(prodigio),
              partnerSharePct: numOrNull(partner),
              organizationId: organizationId || null,
              status,
              notes: notes || null,
            }),
          () => {
            setName("");
            setSegment("");
            setProdigio("");
            setPartner("");
            setNotes("");
          },
        );
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="crm-label">Nom de la règle</span>
          <input className="crm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Premium — barème 2026" required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="crm-label">Segment concerné</span>
          <input className="crm-input" value={segment} onChange={(e) => setSegment(e.target.value)} placeholder="ex. cible_prodigio_premium" required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="crm-label">Organisation porteuse (facultatif)</span>
          <select className="crm-select" value={organizationId} onChange={(e) => setOrganizationId(e.target.value)}>
            <option value="">Toutes / non spécifiée</option>
            {holders.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="crm-label">Base des honoraires</span>
          <select className="crm-select" value={feeBasis} onChange={(e) => setFeeBasis(e.target.value)}>
            {Object.entries(feeBasisLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="crm-label">Date d’entrée en vigueur</span>
          <input type="date" className="crm-input" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="crm-label">Fin de validité (facultatif)</span>
          <input type="date" className="crm-input" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="crm-label">Part Prodigio (%)</span>
          <input className="crm-input" inputMode="decimal" value={prodigio} onChange={(e) => setProdigio(e.target.value)} placeholder="ex. saisir la valeur" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="crm-label">Part partenaire (%)</span>
          <input className="crm-input" inputMode="decimal" value={partner} onChange={(e) => setPartner(e.target.value)} placeholder="ex. saisir la valeur" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="crm-label">Statut</span>
          <select className="crm-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(economicRuleStatusLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="crm-label">Notes (facultatif)</span>
        <textarea className="crm-textarea" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="crm-btn crm-btn--gold crm-btn--sm" disabled={pending}>
          {pending ? "Enregistrement…" : "Créer la règle"}
        </button>
        {done ? <span className="text-xs crm-aging--frais">Enregistré</span> : null}
        {error ? <p role="alert" className="crm-wrap text-xs text-[var(--color-danger-on-dark)]">{error}</p> : null}
      </div>
    </form>
  );
}

/** Formulaire d'enregistrement d'une organisation porteuse (agence habilitée). */
export function PartnerOrganizationForm() {
  const { pending, error, done, run } = useAction();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim() || !slug.trim()) return;
        run(
          () => registerPartnerOrganizationAction({ name: name.trim(), slug: slug.trim() }),
          () => {
            setName("");
            setSlug("");
          },
        );
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="crm-label">Nom de l’agence habilitée</span>
          <input className="crm-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. saisir le nom de l’entité" required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="crm-label">Identifiant (slug)</span>
          <input className="crm-input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex. agence-partenaire" required />
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="crm-btn crm-btn--sm" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer l’organisation porteuse"}
        </button>
        {done ? <span className="text-xs crm-aging--frais">Enregistré</span> : null}
        {error ? <p role="alert" className="crm-wrap text-xs text-[var(--color-danger-on-dark)]">{error}</p> : null}
      </div>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { safeAction } from "@/modules/crm/safe-action";
import {
  analyzeBriefAction,
  createPropertyFromBriefAction,
  type AnalyzeBriefData,
} from "@/modules/properties/brief/actions";
import type { OrganizationCandidate } from "@/modules/properties/brief/organization";
import { BRIEF_FIELD_LABELS } from "@/modules/properties/brief/parse";
import { FieldError, TextArea, TextField, numToField, parseNumber } from "./shared";

/**
 * « Créer un bien à partir d'un brief » — quatre temps explicites :
 *   1. Brief         : on colle le texte, rien n'est écrit ;
 *   2. Analyse       : ce qui est reconnu, manquant, contradictoire, incompris ;
 *   3. Prévisualisation : la fiche structurée, **éditable** par un humain ;
 *   4. Confirmation  : une seule écriture, explicitement demandée.
 *
 * L'analyseur ne décide rien : il propose. Aucune valeur n'est inventée, aucune
 * contradiction n'est tranchée automatiquement, et le bien naît en brouillon —
 * jamais publié.
 */

type Step = "brief" | "analyse" | "preview" | "confirme";

interface DraftForm {
  projectName: string;
  propertyType: string;
  addressLine: string;
  locationCity: string;
  locationPostalCode: string;
  locationCountry: string;
  surfaceM2: string;
  landM2: string;
  rooms: string;
  bedrooms: string;
  yearBuilt: string;
  archStyle: string;
  description: string;
}

const EMPTY_FORM: DraftForm = {
  projectName: "",
  propertyType: "",
  addressLine: "",
  locationCity: "",
  locationPostalCode: "",
  locationCountry: "",
  surfaceM2: "",
  landM2: "",
  rooms: "",
  bedrooms: "",
  yearBuilt: "",
  archStyle: "",
  description: "",
};

const STEPS: { id: Step; label: string }[] = [
  { id: "brief", label: "Brief" },
  { id: "analyse", label: "Analyse" },
  { id: "preview", label: "Prévisualisation" },
  { id: "confirme", label: "Confirmation" },
];

function Stepper({ current }: { current: Step }) {
  const index = STEPS.findIndex((step) => step.id === current);
  return (
    <ol className="flex flex-wrap items-center gap-2 text-[11px]" aria-label="Étapes">
      {STEPS.map((step, i) => {
        const state = i < index ? "fait" : i === index ? "courant" : "a_venir";
        return (
          <li key={step.id} className="flex items-center gap-2">
            <span
              aria-current={state === "courant" ? "step" : undefined}
              className={`crm-chip ${state === "courant" ? "crm-chip--accent" : ""}`}
              style={state === "a_venir" ? { opacity: 0.5 } : undefined}
            >
              {i + 1}. {step.label}
            </span>
            {i < STEPS.length - 1 ? <span aria-hidden="true">→</span> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function BriefFactory({
  canCreateOrganization,
  previewBlocked,
}: {
  /** Seul un administrateur enregistre une nouvelle organisation porteuse. */
  canCreateOrganization: boolean;
  /** Vrai sur un déploiement de prévisualisation : l'écriture réelle est refusée. */
  previewBlocked: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState<Step>("brief");
  const [brief, setBrief] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeBriefData | null>(null);
  const [form, setForm] = useState<DraftForm>(EMPTY_FORM);
  const [organizationId, setOrganizationId] = useState<string>("");
  const [newOrganizationName, setNewOrganizationName] = useState<string>("");
  const [created, setCreated] = useState<{ propertyId: string; already: boolean } | null>(null);

  const set = (key: keyof DraftForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const organizations: OrganizationCandidate[] = useMemo(
    () => result?.organizations ?? [],
    [result],
  );

  const organizationSummary = useMemo(() => {
    if (organizationId) {
      const found = organizations.find((org) => org.id === organizationId);
      return found ? `Organisation existante : ${found.name}` : null;
    }
    if (newOrganizationName.trim()) {
      return `Organisation à enregistrer : ${newOrganizationName.trim()}`;
    }
    return null;
  }, [organizationId, newOrganizationName, organizations]);

  function analyse() {
    setError(null);
    start(async () => {
      const res = await safeAction(() => analyzeBriefAction({ brief }));
      if (!res.ok) {
        setError(res.error ?? "L'analyse n'a pas abouti.");
        return;
      }
      const data = (res as { data?: AnalyzeBriefData }).data;
      if (!data) {
        setError("L'analyse n'a rien renvoyé.");
        return;
      }
      setResult(data);
      const draft = data.analysis.draft;
      setForm({
        projectName: draft.projectName ?? "",
        propertyType: draft.propertyType ?? "",
        addressLine: draft.addressLine ?? "",
        locationCity: draft.locationCity ?? "",
        locationPostalCode: draft.locationPostalCode ?? "",
        locationCountry: draft.locationCountry ?? "",
        surfaceM2: numToField(draft.surfaceM2),
        landM2: numToField(draft.landM2),
        rooms: numToField(draft.rooms),
        bedrooms: numToField(draft.bedrooms),
        // L'année de rénovation n'est JAMAIS reprise ici : seule une année de
        // construction reconnue comme telle alimente ce champ.
        yearBuilt: numToField(draft.yearBuilt),
        archStyle: "",
        description: "",
      });
      const resolution = data.organization;
      setOrganizationId(resolution.status === "existante" ? resolution.organization.id : "");
      setNewOrganizationName(
        resolution.status === "a_enregistrer"
          ? resolution.name
          : resolution.status === "ambigue"
            ? ""
            : "",
      );
      setStep("analyse");
    });
  }

  function confirmer() {
    setError(null);
    const numbers = {
      surfaceM2: parseNumber(form.surfaceM2),
      landM2: parseNumber(form.landM2),
      rooms: parseNumber(form.rooms),
      bedrooms: parseNumber(form.bedrooms),
      yearBuilt: parseNumber(form.yearBuilt),
    };
    for (const [key, value] of Object.entries(numbers)) {
      if (value === undefined) {
        setError(`Valeur numérique invalide : ${key}.`);
        return;
      }
    }
    start(async () => {
      const res = await safeAction(() =>
        createPropertyFromBriefAction({
          organizationId: organizationId || null,
          newOrganizationName: organizationId ? null : newOrganizationName.trim() || null,
          projectName: form.projectName.trim(),
          propertyType: form.propertyType.trim() || null,
          addressLine: form.addressLine.trim() || null,
          locationCity: form.locationCity.trim() || null,
          locationPostalCode: form.locationPostalCode.trim() || null,
          locationCountry: form.locationCountry.trim() || null,
          surfaceM2: numbers.surfaceM2 ?? null,
          landM2: numbers.landM2 ?? null,
          rooms: numbers.rooms ?? null,
          bedrooms: numbers.bedrooms ?? null,
          yearBuilt: numbers.yearBuilt ?? null,
          archStyle: form.archStyle.trim() || null,
          description: form.description.trim() || null,
        }),
      );
      if (!res.ok) {
        setError(res.error ?? "La création n'a pas abouti.");
        return;
      }
      const data = (res as { data?: { propertyId: string; alreadyExisted: boolean } }).data;
      if (!data) {
        setError("La création n'a rien renvoyé.");
        return;
      }
      setCreated({ propertyId: data.propertyId, already: data.alreadyExisted });
      setStep("confirme");
      router.refresh();
    });
  }

  const analysis = result?.analysis;
  const resolution = result?.organization;
  const organizationReady = Boolean(organizationId || newOrganizationName.trim());

  /**
   * Ce qui empêche la création, dit à l'endroit où l'on clique. Un bouton
   * désactivé sans raison à côté de lui est une impasse : le bandeau de
   * prévisualisation est en haut de page, hors de vue une fois la fiche
   * remplie. On répète donc le motif sous le bouton.
   */
  const blockingReason: string | null = previewBlocked
    ? "Cet environnement est une prévisualisation, reliée à la base réelle : la création y est refusée. Rien ne manque à votre fiche — rejouez-la sur l’environnement de production."
    : !form.projectName.trim()
      ? "Le nom du bien est obligatoire."
      : !organizationReady
        ? "Sélectionnez une organisation porteuse, ou saisissez-en une à enregistrer."
        : null;

  const canSubmit = !blockingReason && !pending;

  return (
    <div className="flex flex-col gap-5">
      <Stepper current={step} />

      {previewBlocked ? (
        <p role="status" className="crm-panel crm-wrap p-3 text-xs">
          Environnement de prévisualisation, relié à la base réelle. L’analyse reste possible ;
          la création d’un bien ou d’une organisation y est refusée. Créez le bien depuis
          l’environnement de production.
        </p>
      ) : null}

      {/* ---------------------------------------------------------------- 1 */}
      {step === "brief" ? (
        <section className="flex flex-col gap-3">
          <TextArea
            label="Brief du bien"
            value={brief}
            onChange={setBrief}
            rows={14}
            placeholder={
              "Collez ici tout ce que vous savez du bien : paires clé/valeur, notes, paragraphes.\n" +
              "Exemple :\nNom : Villa Jean Jaurès\nAdresse : 20 avenue Jean Jaurès\nVille : Cassis\n" +
              "Code postal : 13260\nSurface : 160 m²\nPrix : 1 490 000 €\nOrganisation : JCA"
            }
          />
          <p className="crm-wrap text-[11px] text-[var(--crm-text-faint)]">
            Rien n’est enregistré à cette étape. L’analyse lit le texte, n’invente aucune valeur,
            et ne tranche jamais entre deux informations contradictoires.
          </p>
          <FieldError error={error} />
          <div>
            <button
              type="button"
              className="crm-btn crm-btn--gold"
              onClick={analyse}
              disabled={pending || brief.trim().length === 0}
            >
              {pending ? "Analyse en cours…" : "Analyser le brief"}
            </button>
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------------- 2 */}
      {step === "analyse" && analysis ? (
        <section className="flex flex-col gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <AnalysisBlock
              title="Reconnu"
              count={analysis.recognised.length}
              empty="Aucune information reconnue."
            >
              <ul className="flex flex-col gap-1 text-xs">
                {analysis.recognised.map((item) => (
                  <li key={item.key} className="crm-wrap">
                    <span className="crm-label">{item.label}</span> — {item.display}
                  </li>
                ))}
              </ul>
            </AnalysisBlock>

            <AnalysisBlock
              title="Manquant"
              count={analysis.missing.length}
              empty="Rien ne manque."
            >
              <ul className="flex flex-col gap-1 text-xs">
                {analysis.missing.map((item) => (
                  <li key={item.key} className="crm-wrap">
                    {item.label}
                    {item.required ? (
                      <strong className="text-[var(--crm-danger)]"> — indispensable</strong>
                    ) : null}
                  </li>
                ))}
              </ul>
            </AnalysisBlock>

            <AnalysisBlock
              title="Contradictions"
              count={analysis.contradictions.length}
              empty="Aucune contradiction."
            >
              <ul className="flex flex-col gap-2 text-xs">
                {analysis.contradictions.map((item) => (
                  <li key={item.key} className="crm-wrap">
                    <span className="crm-label">{item.label}</span> — le brief donne plusieurs
                    valeurs. Aucune n’a été retenue : tranchez à l’étape suivante.
                    <ul className="mt-1 flex flex-col gap-1 pl-3">
                      {item.values.map((value) => (
                        <li key={value.source}>
                          {value.display}{" "}
                          <span className="text-[var(--crm-text-faint)]">« {value.source} »</span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </AnalysisBlock>

            <AnalysisBlock
              title="Non reconnu"
              count={analysis.unrecognised.length}
              empty="Tout a été interprété."
            >
              <ul className="flex flex-col gap-1 text-xs">
                {analysis.unrecognised.map((passage, i) => (
                  <li key={`${i}-${passage}`} className="crm-wrap">
                    « {passage} »
                  </li>
                ))}
              </ul>
            </AnalysisBlock>
          </div>

          <p className="crm-wrap text-[11px] text-[var(--crm-text-faint)]">
            Toujours aucune écriture. Les passages non reconnus restent à votre disposition :
            recopiez-les dans la description si vous le souhaitez.
          </p>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="crm-btn" onClick={() => setStep("brief")}>
              ← Revenir au brief
            </button>
            <button
              type="button"
              className="crm-btn crm-btn--gold"
              onClick={() => setStep("preview")}
            >
              Prévisualiser la fiche
            </button>
          </div>
        </section>
      ) : null}

      {/* ---------------------------------------------------------------- 3 */}
      {step === "preview" ? (
        <section className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-3">
            <legend className="crm-label">Organisation porteuse (obligatoire)</legend>
            {resolution?.status === "ambigue" ? (
              <p role="alert" className="crm-wrap text-xs text-[var(--crm-danger)]">
                Plusieurs organisations correspondent à « {resolution.requested} ». Choisissez
                celle qui convient : la Fabrique ne tranche pas à votre place.
              </p>
            ) : null}
            <label className="flex min-w-0 flex-col gap-1">
              <span className="crm-label">Organisation existante</span>
              <select
                className="crm-select"
                value={organizationId}
                onChange={(e) => {
                  setOrganizationId(e.target.value);
                  if (e.target.value) setNewOrganizationName("");
                }}
              >
                <option value="">— Aucune sélectionnée —</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.slug})
                  </option>
                ))}
              </select>
            </label>
            {canCreateOrganization ? (
              <TextField
                label="…ou enregistrer une nouvelle organisation"
                value={newOrganizationName}
                onChange={(value) => {
                  setNewOrganizationName(value);
                  if (value.trim()) setOrganizationId("");
                }}
                placeholder="Nom de l’agence partenaire"
              />
            ) : (
              <p className="crm-wrap text-[11px] text-[var(--crm-text-faint)]">
                Seul un administrateur enregistre une nouvelle organisation porteuse.
              </p>
            )}
            {organizationSummary ? (
              <p className="crm-wrap text-[11px]">{organizationSummary}</p>
            ) : (
              <p role="alert" className="crm-wrap text-xs text-[var(--crm-danger)]">
                Un bien partenaire ne peut pas exister sans organisation porteuse.
              </p>
            )}
          </fieldset>

          <div className="grid gap-3 md:grid-cols-2">
            <TextField
              label={`${BRIEF_FIELD_LABELS.projectName} (obligatoire)`}
              value={form.projectName}
              onChange={set("projectName")}
            />
            <TextField
              label={BRIEF_FIELD_LABELS.propertyType}
              value={form.propertyType}
              onChange={set("propertyType")}
            />
            <TextField
              label={BRIEF_FIELD_LABELS.addressLine}
              value={form.addressLine}
              onChange={set("addressLine")}
            />
            <TextField
              label={BRIEF_FIELD_LABELS.locationCity}
              value={form.locationCity}
              onChange={set("locationCity")}
            />
            <TextField
              label={BRIEF_FIELD_LABELS.locationPostalCode}
              value={form.locationPostalCode}
              onChange={set("locationPostalCode")}
            />
            <TextField
              label={BRIEF_FIELD_LABELS.locationCountry}
              value={form.locationCountry}
              onChange={set("locationCountry")}
            />
            <TextField
              label={BRIEF_FIELD_LABELS.surfaceM2}
              value={form.surfaceM2}
              onChange={set("surfaceM2")}
              inputMode="decimal"
            />
            <TextField
              label={BRIEF_FIELD_LABELS.landM2}
              value={form.landM2}
              onChange={set("landM2")}
              inputMode="decimal"
            />
            <TextField
              label={BRIEF_FIELD_LABELS.rooms}
              value={form.rooms}
              onChange={set("rooms")}
              inputMode="numeric"
            />
            <TextField
              label={BRIEF_FIELD_LABELS.bedrooms}
              value={form.bedrooms}
              onChange={set("bedrooms")}
              inputMode="numeric"
            />
            <TextField
              label={BRIEF_FIELD_LABELS.yearBuilt}
              value={form.yearBuilt}
              onChange={set("yearBuilt")}
              inputMode="numeric"
            />
            <TextField
              label="Style architectural"
              value={form.archStyle}
              onChange={set("archStyle")}
            />
          </div>

          {analysis && analysis.draft.renovationYear !== null ? (
            <p className="crm-wrap text-[11px] text-[var(--crm-text-faint)]">
              Le brief mentionne une rénovation en {analysis.draft.renovationYear}. Ce n’est pas
              une année de construction : elle n’est pas reprise dans le champ ci-dessus.
              Mentionnez-la dans la description si elle est utile.
            </p>
          ) : null}

          <TextArea
            label="Description"
            value={form.description}
            onChange={set("description")}
            rows={6}
          />

          {analysis && analysis.draft.priceEur !== null ? (
            <p className="crm-wrap text-[11px] text-[var(--crm-text-faint)]">
              Prix lu dans le brief :{" "}
              {new Intl.NumberFormat("fr-FR", {
                style: "currency",
                currency: "EUR",
                maximumFractionDigits: 0,
              }).format(analysis.draft.priceEur)}
              . Le prix se renseigne ensuite dans le cockpit du bien, avec son contexte.
            </p>
          ) : null}

          <FieldError error={error} />

          <div className="flex flex-wrap gap-2">
            <button type="button" className="crm-btn" onClick={() => setStep("analyse")}>
              ← Revenir à l’analyse
            </button>
            <button type="button" className="crm-btn" onClick={() => setStep("brief")}>
              ← Modifier le brief
            </button>
            <button
              type="button"
              className="crm-btn crm-btn--gold"
              onClick={confirmer}
              disabled={!canSubmit}
            >
              {pending ? "Création en cours…" : "Créer le bien en brouillon"}
            </button>
          </div>

          {blockingReason ? (
            <p role="status" className="crm-wrap text-xs text-[var(--crm-text-faint)]">
              {blockingReason}
            </p>
          ) : null}
        </section>
      ) : null}

      {/* ---------------------------------------------------------------- 4 */}
      {step === "confirme" && created ? (
        <section className="flex flex-col gap-3">
          <p role="status" className="crm-wrap text-sm">
            {created.already
              ? "Ce bien existait déjà pour cette organisation : rien n’a été dupliqué."
              : "Le bien est créé en brouillon (préparation à lancer). Il n’est ni publié, ni diffusé."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href={`/crm/biens/${created.propertyId}`} className="crm-btn crm-btn--gold">
              Ouvrir le cockpit du bien
            </Link>
            <Link href="/crm/biens" className="crm-btn">
              Retour au portefeuille
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function AnalysisBlock({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className="crm-panel flex flex-col gap-2 p-3">
      <h3 className="crm-label">
        {title} ({count})
      </h3>
      {count > 0 ? children : <p className="text-xs text-[var(--crm-text-faint)]">{empty}</p>}
    </section>
  );
}

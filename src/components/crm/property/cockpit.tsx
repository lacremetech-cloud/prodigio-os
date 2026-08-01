"use client";

import { useState } from "react";
import {
  setPropertyResponsibleAction,
  transitionPropertyStatusAction,
  updatePropertyIdentityAction,
  upsertPropertyPositioningAction,
  validatePropertyPositioningAction,
} from "@/modules/properties/factory/actions";
import {
  PROPERTY_STATUS_ORDER,
  READINESS_CHECK_ORDER,
  propertyStatusLabels,
  readinessCheckLabels,
} from "@/modules/properties/factory/labels";
import type {
  PropertyPositioningRow,
  PropertyReadiness,
  PropertyRow,
  PropertyStatus,
} from "@/lib/supabase/types";
import type { AssignableMember } from "@/modules/properties/factory/queries";
import { FieldError, Saved, TextArea, TextField, numToField, parseNumber, useAction } from "./shared";

// ============================================================== Identité
export function IdentityForm({
  property,
  canEdit,
}: {
  property: PropertyRow;
  canEdit: boolean;
}) {
  const { pending, error, done, run } = useAction();
  const [projectName, setProjectName] = useState(property.project_name ?? "");
  const [commercialTitle, setCommercialTitle] = useState(property.commercial_title ?? "");
  const [propertyType, setPropertyType] = useState(property.property_type ?? "");
  const [addressLine, setAddressLine] = useState(property.address_line ?? "");
  const [city, setCity] = useState(property.location_city ?? "");
  const [postal, setPostal] = useState(property.location_postal_code ?? "");
  const [country, setCountry] = useState(property.location_country ?? "");
  const [surface, setSurface] = useState(numToField(property.surface_m2));
  const [land, setLand] = useState(numToField(property.land_m2));
  const [rooms, setRooms] = useState(numToField(property.rooms));
  const [bedrooms, setBedrooms] = useState(numToField(property.bedrooms));
  const [yearBuilt, setYearBuilt] = useState(numToField(property.year_built));
  const [archStyle, setArchStyle] = useState(property.arch_style ?? "");
  const [description, setDescription] = useState(property.description ?? "");
  const [history, setHistory] = useState(property.history ?? "");
  const [signature, setSignature] = useState(property.signature_detail ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  if (!canEdit) {
    return (
      <p className="text-xs text-[var(--crm-text-faint)]">
        Vous consultez ce bien en lecture seule. La saisie de l’identité est réservée aux
        opérateurs et à l’agent affecté.
      </p>
    );
  }

  const submit = () => {
    setLocalError(null);
    const nums = {
      surfaceM2: parseNumber(surface),
      landM2: parseNumber(land),
      rooms: parseNumber(rooms),
      bedrooms: parseNumber(bedrooms),
      yearBuilt: parseNumber(yearBuilt),
    };
    for (const [k, v] of Object.entries(nums)) {
      if (v === undefined) {
        setLocalError(`Valeur numérique « ${k} » non valide.`);
        return;
      }
    }
    run(() =>
      updatePropertyIdentityAction({
        propertyId: property.id,
        projectName: projectName || null,
        commercialTitle: commercialTitle || null,
        propertyType: propertyType || null,
        addressLine: addressLine || null,
        locationCity: city || null,
        locationPostalCode: postal || null,
        locationCountry: country || null,
        surfaceM2: nums.surfaceM2 ?? null,
        landM2: nums.landM2 ?? null,
        rooms: nums.rooms ?? null,
        bedrooms: nums.bedrooms ?? null,
        yearBuilt: nums.yearBuilt ?? null,
        archStyle: archStyle || null,
        description: description || null,
        history: history || null,
        signatureDetail: signature || null,
      }),
    );
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Nom de projet" value={projectName} onChange={setProjectName} placeholder="ex. Villa Belvédère" />
        <TextField label="Titre commercial" value={commercialTitle} onChange={setCommercialTitle} placeholder="Accroche éditoriale" />
        <TextField label="Type de bien" value={propertyType} onChange={setPropertyType} placeholder="villa, appartement…" />
        <TextField label="Style architectural" value={archStyle} onChange={setArchStyle} placeholder="contemporain, mas…" />
      </div>
      <TextField label="Adresse (visible selon droits)" value={addressLine} onChange={setAddressLine} placeholder="Numéro et voie" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TextField label="Ville" value={city} onChange={setCity} />
        <TextField label="Code postal" value={postal} onChange={setPostal} />
        <TextField label="Pays" value={country} onChange={setCountry} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <TextField label="Surface (m²)" value={surface} onChange={setSurface} inputMode="decimal" />
        <TextField label="Terrain (m²)" value={land} onChange={setLand} inputMode="decimal" />
        <TextField label="Pièces" value={rooms} onChange={setRooms} inputMode="numeric" />
        <TextField label="Chambres" value={bedrooms} onChange={setBedrooms} inputMode="numeric" />
        <TextField label="Année" value={yearBuilt} onChange={setYearBuilt} inputMode="numeric" />
      </div>
      <TextArea label="Description" value={description} onChange={setDescription} rows={4} placeholder="Présentation du bien…" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextArea label="Histoire du lieu" value={history} onChange={setHistory} placeholder="Récit, provenance…" />
        <TextArea label="Détail signature / coup de cœur" value={signature} onChange={setSignature} placeholder="L’élément qui fait la différence…" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="crm-btn crm-btn--gold crm-btn--sm" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer l’identité"}
        </button>
        <Saved show={done} />
        <FieldError error={localError ?? error} />
      </div>
      <p className="text-[11px] text-[var(--crm-text-faint)]">
        Tous les champs sont facultatifs. La « préparation au lancement » indique lesquels sont
        requis pour déclarer le bien prêt.
      </p>
    </form>
  );
}

// ============================================================ Positionnement
export function PositioningForm({
  propertyId,
  positioning,
  canEdit,
  canDecide,
}: {
  propertyId: string;
  positioning: PropertyPositioningRow | null;
  canEdit: boolean;
  canDecide: boolean;
}) {
  const { pending, error, done, run } = useAction();
  const [centralPromise, setCentralPromise] = useState(positioning?.central_promise ?? "");
  const [valuePillars, setValuePillars] = useState(positioning?.value_pillars ?? "");
  const [differentiators, setDifferentiators] = useState(positioning?.differentiators ?? "");
  const [emotionalDetails, setEmotionalDetails] = useState(positioning?.emotional_details ?? "");
  const [idealBuyer, setIdealBuyer] = useState(positioning?.ideal_buyer_profile ?? "");
  const [buyerLocations, setBuyerLocations] = useState(positioning?.buyer_locations ?? "");
  const [buyerMotivation, setBuyerMotivation] = useState(positioning?.buyer_motivation ?? "");
  const [targetZones, setTargetZones] = useState(positioning?.target_zones ?? "");
  const [adAngles, setAdAngles] = useState(positioning?.ad_angles ?? "");
  const [doNotCommunicate, setDoNotCommunicate] = useState(positioning?.do_not_communicate ?? "");
  const [brandName, setBrandName] = useState(positioning?.brand_name ?? "");

  const validated = positioning?.validated ?? false;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="crm-label">Validation :</span>
        {validated ? (
          <span className="crm-chip crm-chip--ok">✔ Positionnement validé</span>
        ) : (
          <span className="crm-chip">Non validé</span>
        )}
      </div>

      {canEdit ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              upsertPropertyPositioningAction({
                propertyId,
                centralPromise: centralPromise || null,
                valuePillars: valuePillars || null,
                differentiators: differentiators || null,
                emotionalDetails: emotionalDetails || null,
                idealBuyerProfile: idealBuyer || null,
                buyerLocations: buyerLocations || null,
                buyerMotivation: buyerMotivation || null,
                targetZones: targetZones || null,
                adAngles: adAngles || null,
                doNotCommunicate: doNotCommunicate || null,
                brandName: brandName || null,
              }),
            );
          }}
        >
          <TextArea label="Promesse centrale" value={centralPromise} onChange={setCentralPromise} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <TextArea label="Piliers de valeur" value={valuePillars} onChange={setValuePillars} />
            <TextArea label="Différenciateurs" value={differentiators} onChange={setDifferentiators} />
            <TextArea label="Détails émotionnels" value={emotionalDetails} onChange={setEmotionalDetails} />
            <TextArea label="Acheteur idéal" value={idealBuyer} onChange={setIdealBuyer} />
            <TextArea label="Localisations de l’acheteur" value={buyerLocations} onChange={setBuyerLocations} />
            <TextArea label="Motivation d’achat" value={buyerMotivation} onChange={setBuyerMotivation} />
            <TextArea label="Zones cibles" value={targetZones} onChange={setTargetZones} />
            <TextArea label="Angles publicitaires" value={adAngles} onChange={setAdAngles} />
          </div>
          <TextArea
            label="À ne pas communiquer (confidentiel)"
            value={doNotCommunicate}
            onChange={setDoNotCommunicate}
            placeholder="Éléments à ne jamais diffuser publiquement…"
          />
          <TextField label="Nom de marque du bien" value={brandName} onChange={setBrandName} />
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="crm-btn crm-btn--gold crm-btn--sm" disabled={pending}>
              {pending ? "Enregistrement…" : "Enregistrer le positionnement"}
            </button>
            <Saved show={done} />
            <FieldError error={error} />
          </div>
        </form>
      ) : (
        <p className="text-xs text-[var(--crm-text-faint)]">
          Positionnement en lecture seule.
        </p>
      )}

      {canDecide ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--crm-line-soft)] pt-3">
          <button
            type="button"
            className="crm-btn crm-btn--sm"
            disabled={pending}
            onClick={() =>
              run(() =>
                validatePropertyPositioningAction({ propertyId, validated: !validated }),
              )
            }
          >
            {validated ? "Retirer la validation" : "Valider le positionnement"}
          </button>
          <span className="text-[11px] text-[var(--crm-text-faint)]">
            La validation du positionnement est requise pour déclarer le bien prêt.
          </span>
        </div>
      ) : null}
    </div>
  );
}

// ============================================================== Responsable
export function ResponsibleControl({
  propertyId,
  currentUserId,
  currentName,
  members,
  canDecide,
}: {
  propertyId: string;
  currentUserId: string | null;
  currentName: string | null;
  members: AssignableMember[];
  canDecide: boolean;
}) {
  const { pending, error, run } = useAction();
  const [userId, setUserId] = useState(currentUserId ?? "");

  if (!canDecide) {
    return (
      <p className="text-sm text-[var(--crm-text-dim)]">
        Responsable : <span className="text-[var(--crm-text)]">{currentName ?? "non désigné"}</span>
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex min-w-0 flex-col gap-1">
        <span className="crm-label">Responsable du bien</span>
        <select className="crm-select" value={userId} onChange={(e) => setUserId(e.target.value)}>
          <option value="">Non désigné</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="crm-btn crm-btn--sm"
        disabled={pending}
        onClick={() =>
          run(() => setPropertyResponsibleAction({ propertyId, userId: userId || null }))
        }
      >
        {pending ? "…" : "Enregistrer"}
      </button>
      <FieldError error={error} />
    </div>
  );
}

// ======================================================= Statut & readiness
export function StatusReadinessPanel({
  propertyId,
  status,
  readiness,
  canDecide,
  canEdit,
}: {
  propertyId: string;
  status: PropertyStatus;
  readiness: PropertyReadiness | null;
  canDecide: boolean;
  canEdit: boolean;
}) {
  const { pending, error, run } = useAction();
  const [target, setTarget] = useState<PropertyStatus>(status);
  const [reason, setReason] = useState("");

  const percent = readiness?.percent ?? 0;
  const ready = readiness?.ready ?? false;
  const blocked = readiness?.blocked ?? false;

  // Statuts sensibles réservés à admin/manager (miroir de la base).
  const sensitive = new Set<PropertyStatus>([
    "pret_a_lancer",
    "en_diffusion",
    "archive",
    "suspendu",
  ]);
  const canApplyTarget = sensitive.has(target) ? canDecide : canEdit;

  return (
    <div className="flex flex-col gap-4">
      {/* Barre de progression */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <span className="crm-label">Préparation au lancement</span>
          <span className="text-sm font-semibold tabular-nums text-[var(--crm-text)]">
            {readiness ? `${readiness.done}/${readiness.total}` : "—"}
            <span className="text-[var(--crm-text-faint)]"> · {percent}%</span>
          </span>
        </div>
        <div
          className="crm-meter"
          role="meter"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progression de la préparation"
        >
          <span style={{ width: `${percent}%` }} />
        </div>
      </div>

      {/* Checklist calculée en base */}
      {readiness ? (
        <ul className="flex flex-col gap-1.5">
          {READINESS_CHECK_ORDER.map((key) => {
            const ok = readiness.checks[key];
            return (
              <li key={key} className="flex items-start gap-2 text-sm">
                <span
                  aria-hidden
                  className={ok ? "text-[var(--crm-success)]" : "text-[var(--crm-text-faint)]"}
                >
                  {ok ? "✔" : "○"}
                </span>
                <span className={ok ? "text-[var(--crm-text)]" : "text-[var(--crm-text-dim)]"}>
                  {readinessCheckLabels[key]}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      {blocked ? (
        <p className="crm-wrap rounded-[10px] border border-[var(--crm-line)] bg-[var(--crm-panel-2)] px-3 py-2 text-xs text-[var(--crm-danger)]">
          ⚠ Un élément de production est bloqué : le bien ne peut pas être déclaré prêt tant que le
          blocage n’est pas levé.
        </p>
      ) : ready ? (
        <p className="crm-wrap rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2 text-xs crm-aging--frais">
          ✔ Tous les prérequis sont réunis. Le bien peut être déclaré « prêt à lancer ».
        </p>
      ) : (
        <p className="crm-wrap text-xs text-[var(--crm-text-dim)]">
          Complétez les critères ci-dessus pour pouvoir déclarer le bien prêt à lancer.
        </p>
      )}

      {/* Transition de statut */}
      {canEdit ? (
        <div className="flex flex-col gap-3 border-t border-[var(--crm-line-soft)] pt-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="crm-label">Statut du bien</span>
              <select
                className="crm-select"
                value={target}
                onChange={(e) => setTarget(e.target.value as PropertyStatus)}
              >
                {PROPERTY_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {propertyStatusLabels[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="crm-label">Motif (facultatif)</span>
              <input
                className="crm-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Contexte du changement…"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={`crm-btn crm-btn--sm ${target === "pret_a_lancer" ? "crm-btn--gold" : ""}`}
              disabled={pending || target === status || !canApplyTarget}
              onClick={() =>
                run(() =>
                  transitionPropertyStatusAction({
                    propertyId,
                    status: target,
                    reason: reason || null,
                  }),
                )
              }
            >
              {pending ? "Application…" : `Passer à « ${propertyStatusLabels[target]} »`}
            </button>
            {sensitive.has(target) && !canDecide ? (
              <span className="text-[11px] text-[var(--crm-text-faint)]">
                Transition réservée à un administrateur ou un manager.
              </span>
            ) : null}
            <FieldError error={error} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

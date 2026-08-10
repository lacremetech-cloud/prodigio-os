"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { CSSProperties } from "react";
import {
  deletePublicMediaAction,
  publishPropertyAction,
  setPublicMediaRoleAction,
  setPublicationStatusAction,
  unpublishPropertyAction,
  updatePublicMediaAction,
  uploadPublicMediaAction,
  upsertPublicConfigAction,
  validatePublicContentAction,
} from "@/modules/buyers/public/actions";
import type { PublicReadiness } from "@/modules/buyers/public/queries";
import {
  PUBLIC_READINESS_CHECK_ORDER,
  mediaKindPublicLabels,
  publicReadinessCheckLabels,
  publicationStatusLabels,
  publicationStatusVisual,
  type PublicationStatus,
} from "@/modules/buyers/public/labels";
import { publicMediaUrl } from "@/modules/buyers/public/snapshot";
import { cssVarRef } from "@/modules/crm/status-visuals";
import type {
  PropertyPublicConfigRow,
  PropertyPublicMediaRow,
} from "@/lib/supabase/types";
import { FieldError, Saved, TextArea, TextField, useAction } from "./shared";

const PUBLIC_MEDIA_KINDS = ["photo", "video", "drone", "rendu", "plan", "couverture"] as const;

function Checkbox({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-[var(--crm-text)]">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        {label}
        {hint ? <span className="block text-[11px] text-[var(--crm-text-faint)]">{hint}</span> : null}
      </span>
    </label>
  );
}

// ============================================================ Config publique
export function PublicConfigForm({
  config,
  propertyId,
  canEdit,
  canDecide,
}: {
  config: PropertyPublicConfigRow | null;
  propertyId: string;
  canEdit: boolean;
  canDecide: boolean;
}) {
  const { pending, error, done, run } = useAction();
  const [slug, setSlug] = useState(config?.slug ?? "");
  const [publicName, setPublicName] = useState(config?.public_name ?? "");
  const [tagline, setTagline] = useState(config?.tagline ?? "");
  const [intro, setIntro] = useState(config?.intro ?? "");
  const [story, setStory] = useState(config?.story ?? "");
  const [experience, setExperience] = useState(config?.experience_text ?? "");
  const [architecture, setArchitecture] = useState(config?.architecture_text ?? "");
  const [pillars, setPillars] = useState(config?.pillars ?? "");
  const [features, setFeatures] = useState(config?.highlighted_features ?? "");
  const [emotional, setEmotional] = useState(config?.emotional_details ?? "");
  const [environment, setEnvironment] = useState(config?.environment_text ?? "");
  const [ctaLabel, setCtaLabel] = useState(config?.cta_label ?? "");
  const [showPrice, setShowPrice] = useState(config?.show_price ?? false);
  const [priceLabel, setPriceLabel] = useState(config?.price_label ?? "");
  const [publicLocation, setPublicLocation] = useState(config?.public_location ?? "");
  const [referenceEuros, setReferenceEuros] = useState(
    config?.reference_value_cents == null ? "" : String(Math.round(config.reference_value_cents / 100)),
  );
  const [seoIndex, setSeoIndex] = useState(config?.seo_index ?? false);
  const [seoTitle, setSeoTitle] = useState(config?.seo_title ?? "");
  const [seoDescription, setSeoDescription] = useState(config?.seo_description ?? "");
  const [privacyReviewed, setPrivacyReviewed] = useState(config?.privacy_reviewed ?? false);
  const [localError, setLocalError] = useState<string | null>(null);

  const validated = config?.validated ?? false;

  if (!canEdit) {
    return (
      <p className="text-xs text-[var(--crm-text-faint)]">
        Configuration de l’expérience publique en lecture seule.
      </p>
    );
  }

  const submit = () => {
    setLocalError(null);
    let referenceValueEuros: number | null = null;
    const rt = referenceEuros.trim().replace(/\s/g, "").replace(",", ".");
    if (rt !== "") {
      if (!/^\d+(\.\d+)?$/.test(rt)) {
        setLocalError("Valeur de référence invalide.");
        return;
      }
      referenceValueEuros = Number(rt);
    }
    run(() =>
      upsertPublicConfigAction({
        propertyId,
        slug: slug.trim() || null,
        publicName: publicName || null,
        tagline: tagline || null,
        intro: intro || null,
        story: story || null,
        experienceText: experience || null,
        architectureText: architecture || null,
        pillars: pillars || null,
        highlightedFeatures: features || null,
        emotionalDetails: emotional || null,
        environmentText: environment || null,
        ctaLabel: ctaLabel || null,
        showPrice,
        priceLabel: priceLabel || null,
        publicLocation: publicLocation || null,
        referenceValueEuros,
        seoIndex,
        seoTitle: seoTitle || null,
        seoDescription: seoDescription || null,
        privacyReviewed,
      }),
    );
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="crm-label">Contenu public :</span>
        {validated ? (
          <span className="crm-chip crm-chip--ok">✔ Validé</span>
        ) : (
          <span className="crm-chip">Non validé</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Slug public (ex. villa-belvedere)" value={slug} onChange={setSlug} placeholder="villa-belvedere" />
        <TextField label="Nom public du bien" value={publicName} onChange={setPublicName} placeholder="Villa Belvédère" />
      </div>
      <TextField label="Signature / accroche" value={tagline} onChange={setTagline} placeholder="Une ode à la lumière, au-dessus de la baie" />
      <TextArea label="Introduction" value={intro} onChange={setIntro} rows={3} placeholder="Le bien en quelques mots…" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextArea label="Histoire de la propriété" value={story} onChange={setStory} />
        <TextArea label="L’expérience de vie" value={experience} onChange={setExperience} />
        <TextArea label="Architecture & caractère" value={architecture} onChange={setArchitecture} />
        <TextArea label="Environnement & art de vivre" value={environment} onChange={setEnvironment} />
        <TextArea label="Piliers de valorisation" value={pillars} onChange={setPillars} placeholder="Un pilier par ligne" />
        <TextArea label="Caractéristiques à mettre en avant" value={features} onChange={setFeatures} placeholder="Une caractéristique par ligne" />
      </div>
      <TextArea label="Détails « coup de cœur »" value={emotional} onChange={setEmotional} placeholder="Un détail par ligne" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextField label="Texte du CTA acquéreur" value={ctaLabel} onChange={setCtaLabel} placeholder="Manifester mon intérêt" />
        <TextField label="Localisation publique (approximative)" value={publicLocation} onChange={setPublicLocation} placeholder="Presqu’île de Saint-Tropez" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Checkbox label="Afficher un prix" checked={showPrice} onChange={setShowPrice} />
          <TextField label="Libellé de prix (facultatif)" value={priceLabel} onChange={setPriceLabel} placeholder="Sur demande" />
        </div>
        <TextField
          label="Valeur de référence interne (€) — scoring acquéreur, jamais publique"
          value={referenceEuros}
          onChange={setReferenceEuros}
          inputMode="numeric"
          placeholder="ex. 2 400 000"
        />
      </div>

      <div className="flex flex-col gap-2 border-t border-[var(--crm-line-soft)] pt-3">
        <span className="crm-label">Confidentialité & SEO</span>
        <Checkbox
          label="Réglages de confidentialité vérifiés"
          checked={privacyReviewed}
          onChange={setPrivacyReviewed}
          hint="L’adresse exacte n’est jamais publique. Seule la localisation approximative est diffusée."
        />
        <Checkbox
          label="Autoriser l’indexation par les moteurs (SEO)"
          checked={seoIndex}
          onChange={setSeoIndex}
          hint="Désactivé par défaut. N’active jamais l’indexation des brouillons ou prévisualisations."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextField label="Titre SEO" value={seoTitle} onChange={setSeoTitle} />
          <TextField label="Description SEO" value={seoDescription} onChange={setSeoDescription} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="crm-btn crm-btn--gold crm-btn--sm" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer l’expérience publique"}
        </button>
        <Saved show={done} />
        <FieldError error={localError ?? error} />
      </div>
      <p className="text-[11px] text-[var(--crm-text-faint)]">
        Toute modification invalide la validation précédente. La page publiée ne change qu’après une
        nouvelle publication (snapshot versionné).
      </p>

      {canDecide ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--crm-line-soft)] pt-3">
          <ValidateContentButton propertyId={propertyId} validated={validated} />
        </div>
      ) : null}
    </form>
  );
}

function ValidateContentButton({ propertyId, validated }: { propertyId: string; validated: boolean }) {
  const { pending, error, run } = useAction();
  return (
    <>
      <button
        type="button"
        className="crm-btn crm-btn--sm"
        disabled={pending}
        onClick={() =>
          run(() => validatePublicContentAction({ propertyId, validated: !validated }))
        }
      >
        {validated ? "Retirer la validation" : "Valider le contenu public"}
      </button>
      <span className="text-[11px] text-[var(--crm-text-faint)]">
        La validation du contenu public est requise pour publier.
      </span>
      <FieldError error={error} />
    </>
  );
}

// ======================================================= Médias publics
export function PublicMediaManager({
  propertyId,
  media,
  config,
  canEdit,
  supabaseUrl,
}: {
  propertyId: string;
  media: PropertyPublicMediaRow[];
  config: PropertyPublicConfigRow | null;
  canEdit: boolean;
  supabaseUrl: string | undefined;
}) {
  const { pending, error, done, run } = useAction();
  const [kind, setKind] = useState<(typeof PUBLIC_MEDIA_KINDS)[number]>("photo");
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-4">
      {canEdit ? (
        <form
          className="flex flex-col gap-3 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const file = fileRef.current?.files?.[0];
            if (!file) return;
            const fd = new FormData();
            fd.set("propertyId", propertyId);
            fd.set("kind", kind);
            if (alt.trim()) fd.set("alt", alt.trim());
            if (caption.trim()) fd.set("caption", caption.trim());
            fd.set("file", file);
            run(
              () => uploadPublicMediaAction(fd),
              () => {
                if (fileRef.current) fileRef.current.value = "";
                setAlt("");
                setCaption("");
              },
            );
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="crm-label">Type</span>
              <select
                className="crm-select"
                value={kind}
                onChange={(e) => setKind(e.target.value as (typeof PUBLIC_MEDIA_KINDS)[number])}
              >
                {PUBLIC_MEDIA_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {mediaKindPublicLabels[k]}
                  </option>
                ))}
              </select>
            </label>
            <TextField label="Texte alternatif (accessibilité)" value={alt} onChange={setAlt} />
            <TextField label="Légende (facultative)" value={caption} onChange={setCaption} />
          </div>
          <label className="flex flex-col gap-1">
            <span className="crm-label">Fichier public (JPEG, PNG, WEBP ou MP4 · 100 Mo max.)</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4"
              className="crm-input"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="crm-btn crm-btn--sm" disabled={pending}>
              {pending ? "Téléversement…" : "Ajouter le média public"}
            </button>
            <Saved show={done} />
            <FieldError error={error} />
          </div>
          <p className="text-[11px] text-[var(--crm-text-faint)]">
            Aucun document légal ici. Seuls les médias approuvés entrent dans la page publiée.
            Stockage dans un bucket public dédié (distinct du bucket privé de la Fabrique).
          </p>
        </form>
      ) : null}

      {media.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-[var(--crm-line)] px-3 py-8 text-center text-xs text-[var(--crm-text-faint)]">
          Aucun média public. Ajoutez uniquement des visuels expressément approuvés pour la diffusion.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {media.map((m) => (
            <PublicMediaCard
              key={m.id}
              media={m}
              propertyId={propertyId}
              config={config}
              canEdit={canEdit}
              supabaseUrl={supabaseUrl}
              run={run}
              pending={pending}
              confirmId={confirmId}
              setConfirmId={setConfirmId}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PublicMediaCard({
  media: m,
  propertyId,
  config,
  canEdit,
  supabaseUrl,
  run,
  pending,
  confirmId,
  setConfirmId,
}: {
  media: PropertyPublicMediaRow;
  propertyId: string;
  config: PropertyPublicConfigRow | null;
  canEdit: boolean;
  supabaseUrl: string | undefined;
  run: ReturnType<typeof useAction>["run"];
  pending: boolean;
  confirmId: string | null;
  setConfirmId: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [alt, setAlt] = useState(m.alt_text ?? "");
  const [caption, setCaption] = useState(m.caption ?? "");
  const [order, setOrder] = useState(String(m.sort_order));
  const url = publicMediaUrl(
    { bucket: "property-public", storage_path: m.storage_path },
    supabaseUrl,
  );
  const isHero = config?.hero_media_id === m.id;
  const isMain = config?.main_public_media_id === m.id;
  const isSocial = config?.social_image_media_id === m.id;

  return (
    <li className="flex flex-col gap-2 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-3">
      <div className="flex items-start gap-3">
        {url && m.mime_type.startsWith("image/") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={m.alt_text ?? ""}
            className="h-16 w-24 shrink-0 rounded-[6px] object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-[6px] bg-[var(--crm-panel)] text-xs text-[var(--crm-text-faint)]">
            {mediaKindPublicLabels[m.kind] ?? m.kind}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="crm-wrap text-sm text-[var(--crm-text)]">{m.alt_text || m.file_name}</p>
          <p className="text-[11px] text-[var(--crm-text-faint)]">
            {mediaKindPublicLabels[m.kind] ?? m.kind} · ordre {m.sort_order}
            {m.approved ? "" : " · non approuvé"}
          </p>
          <div className="mt-1 flex flex-wrap gap-1">
            {isHero ? <span className="crm-chip crm-chip--gold">Hero</span> : null}
            {isMain ? <span className="crm-chip crm-chip--gold">Principale</span> : null}
            {isSocial ? <span className="crm-chip">Sociale</span> : null}
          </div>
        </div>
      </div>

      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="crm-btn crm-btn--sm crm-btn--ghost"
            disabled={pending || isHero}
            onClick={() => run(() => setPublicMediaRoleAction({ propertyId, role: "hero", mediaId: m.id }))}
          >
            Hero
          </button>
          <button
            type="button"
            className="crm-btn crm-btn--sm crm-btn--ghost"
            disabled={pending || isMain}
            onClick={() => run(() => setPublicMediaRoleAction({ propertyId, role: "main", mediaId: m.id }))}
          >
            Principale
          </button>
          <button
            type="button"
            className="crm-btn crm-btn--sm crm-btn--ghost"
            disabled={pending || isSocial}
            onClick={() => run(() => setPublicMediaRoleAction({ propertyId, role: "social", mediaId: m.id }))}
          >
            Sociale
          </button>
          <button
            type="button"
            className={`crm-btn crm-btn--sm crm-btn--ghost ${m.approved ? "" : "crm-btn--gold"}`}
            disabled={pending}
            onClick={() =>
              run(() =>
                updatePublicMediaAction({ propertyId, mediaId: m.id, approved: !m.approved }),
              )
            }
          >
            {m.approved ? "Retirer l’approbation" : "Approuver"}
          </button>
          <button type="button" className="crm-btn crm-btn--sm crm-btn--ghost" onClick={() => setOpen((o) => !o)}>
            {open ? "Fermer" : "Modifier"}
          </button>
        </div>
      ) : null}

      {open && canEdit ? (
        <div className="flex flex-col gap-2 rounded-[8px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel)] p-2">
          <TextField label="Texte alternatif" value={alt} onChange={setAlt} />
          <TextField label="Légende" value={caption} onChange={setCaption} />
          <TextField label="Ordre d’affichage" value={order} onChange={setOrder} inputMode="numeric" />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="crm-btn crm-btn--sm"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    updatePublicMediaAction({
                      propertyId,
                      mediaId: m.id,
                      altText: alt || null,
                      caption: caption || null,
                      sortOrder: Number.isFinite(Number(order)) ? Number(order) : undefined,
                    }),
                  () => setOpen(false),
                )
              }
            >
              Enregistrer
            </button>
            {confirmId === m.id ? (
              <>
                <button
                  type="button"
                  className="crm-btn crm-btn--sm crm-btn--danger"
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => deletePublicMediaAction({ propertyId, mediaId: m.id }),
                      () => setConfirmId(null),
                    )
                  }
                >
                  Confirmer la suppression
                </button>
                <button type="button" className="crm-btn crm-btn--sm crm-btn--ghost" onClick={() => setConfirmId(null)}>
                  Annuler
                </button>
              </>
            ) : (
              <button type="button" className="crm-btn crm-btn--sm crm-btn--ghost" onClick={() => setConfirmId(m.id)}>
                Supprimer
              </button>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}

// ======================================================= Publication
export function PublicationPanel({
  propertyId,
  config,
  readiness,
  canDecide,
  canEdit,
  previewHref,
  publicHref,
}: {
  propertyId: string;
  config: PropertyPublicConfigRow | null;
  readiness: PublicReadiness | null;
  canDecide: boolean;
  canEdit: boolean;
  previewHref: string;
  publicHref: string | null;
}) {
  const { pending, error, run } = useAction();
  const status = (config?.publication_status ?? "brouillon") as PublicationStatus;
  const visual = publicationStatusVisual[status];
  const percent = readiness?.percent ?? 0;
  const ready = readiness?.ready ?? false;
  const isPublished = status === "publie";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className="crm-chip crm-chip--accent"
          style={{ ["--chip-accent" as keyof CSSProperties]: cssVarRef(visual.cssVar) } as CSSProperties}
        >
          <span aria-hidden>{visual.icon}</span>
          {publicationStatusLabels[status]}
        </span>
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
        aria-label="Préparation à la publication"
      >
        <span style={{ width: `${percent}%` }} />
      </div>

      {readiness ? (
        <ul className="flex flex-col gap-1.5">
          {PUBLIC_READINESS_CHECK_ORDER.map((key) => {
            const ok = readiness.checks[key];
            return (
              <li key={key} className="flex items-start gap-2 text-sm">
                <span aria-hidden className={ok ? "text-[var(--crm-success)]" : "text-[var(--crm-text-faint)]"}>
                  {ok ? "✔" : "○"}
                </span>
                <span className={ok ? "text-[var(--crm-text)]" : "text-[var(--crm-text-dim)]"}>
                  {publicReadinessCheckLabels[key]}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Link href={previewHref} className="crm-btn crm-btn--sm crm-btn--ghost" prefetch={false}>
          Prévisualiser (privé)
        </Link>
        {isPublished && publicHref ? (
          <a href={publicHref} target="_blank" rel="noopener noreferrer" className="crm-btn crm-btn--sm crm-btn--ghost">
            Voir la page publique
          </a>
        ) : null}
      </div>

      {ready ? (
        <p className="crm-wrap rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2 text-xs crm-aging--frais">
          ✔ Tous les prérequis de publication sont réunis.
        </p>
      ) : (
        <p className="crm-wrap text-xs text-[var(--crm-text-dim)]">
          Complétez les critères ci-dessus pour pouvoir publier le bien.
        </p>
      )}

      {canDecide ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--crm-line-soft)] pt-3">
          {!isPublished ? (
            <button
              type="button"
              className="crm-btn crm-btn--gold crm-btn--sm"
              disabled={pending || !ready}
              onClick={() => run(() => publishPropertyAction({ propertyId }))}
            >
              {pending ? "Publication…" : config?.first_published_at ? "Republier (nouvelle version)" : "Publier"}
            </button>
          ) : (
            <button
              type="button"
              className="crm-btn crm-btn--sm"
              disabled={pending}
              onClick={() => run(() => publishPropertyAction({ propertyId }))}
            >
              {pending ? "…" : "Republier (nouvelle version)"}
            </button>
          )}
          {isPublished ? (
            <button
              type="button"
              className="crm-btn crm-btn--sm crm-btn--danger"
              disabled={pending}
              onClick={() => run(() => unpublishPropertyAction({ propertyId }))}
            >
              Dépublier
            </button>
          ) : null}
          <FieldError error={error} />
        </div>
      ) : canEdit ? (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--crm-line-soft)] pt-3">
          <StatusStepper propertyId={propertyId} status={status} />
          <span className="text-[11px] text-[var(--crm-text-faint)]">
            La publication et la dépublication sont réservées à un administrateur ou un manager.
          </span>
        </div>
      ) : null}
    </div>
  );
}

function StatusStepper({ propertyId, status }: { propertyId: string; status: PublicationStatus }) {
  const { pending, error, run } = useAction();
  const [target, setTarget] = useState<string>(
    ["brouillon", "en_preparation", "pret_a_publier"].includes(status) ? status : "en_preparation",
  );
  return (
    <>
      <select className="crm-select" value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="brouillon">Brouillon</option>
        <option value="en_preparation">En préparation</option>
        <option value="pret_a_publier">Prêt à publier</option>
      </select>
      <button
        type="button"
        className="crm-btn crm-btn--sm"
        disabled={pending || target === status}
        onClick={() =>
          run(() => setPublicationStatusAction({ propertyId, status: target as never }))
        }
      >
        {pending ? "…" : "Mettre à jour"}
      </button>
      <FieldError error={error} />
    </>
  );
}

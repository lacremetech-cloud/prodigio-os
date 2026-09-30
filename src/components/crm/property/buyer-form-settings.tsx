"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { safeAction } from "@/modules/crm/safe-action";
import { setBuyerFormSettingsAction } from "@/modules/buyers/crm/form-actions";
import { buildEmbedSnippet } from "@/components/public/buyer/embed-bridge";
import { FieldError, TextArea, TextField } from "./shared";

/**
 * Bloc « Formulaire acquéreur » du cockpit : identifiant public, activation,
 * brochure, domaines autorisés, et le code à coller.
 *
 * Il ne publie jamais la vitrine — c'est dit à l'écran, et garanti en base.
 */
export function BuyerFormSettings({
  propertyId,
  siteUrl,
  initialSlug,
  initialStatus,
  initialBrochureUrl,
  initialOrigins,
  publicationStatus,
  canActivate,
}: {
  propertyId: string;
  /** Origine canonique du site, pour composer l'URL remise à l'utilisateur. */
  siteUrl: string;
  initialSlug: string | null;
  initialStatus: string;
  initialBrochureUrl: string | null;
  initialOrigins: string[];
  publicationStatus: string;
  /** Activer la collecte est réservé aux décisionnaires. */
  canActivate: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [slug, setSlug] = useState(initialSlug ?? "");
  const [status, setStatus] = useState(initialStatus);
  const [brochureUrl, setBrochureUrl] = useState(initialBrochureUrl ?? "");
  const [origins, setOrigins] = useState(initialOrigins.join("\n"));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [rejected, setRejected] = useState<string[]>([]);
  const [copied, setCopied] = useState<"url" | "code" | null>(null);

  const formUrl = useMemo(
    () => (slug.trim() ? `${siteUrl.replace(/\/$/, "")}/bien/${slug.trim()}/interet` : ""),
    [siteUrl, slug],
  );

  async function copy(what: "url" | "code") {
    const text = what === "url" ? formUrl : buildEmbedSnippet(formUrl);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("La copie a échoué. Sélectionnez le texte manuellement.");
    }
  }

  function save(nextStatus?: string) {
    setError(null);
    setSaved(null);
    start(async () => {
      const res = await safeAction(() =>
        setBuyerFormSettingsAction({
          propertyId,
          slug: slug.trim() || null,
          status: nextStatus ?? null,
          brochureUrl: brochureUrl.trim(),
          allowedOrigins: origins,
        }),
      );
      if (!res.ok) {
        setError(res.error ?? "L'enregistrement n'a pas abouti.");
        return;
      }
      const data = (res as { data?: { slug: string | null; buyerFormStatus: string; rejectedOrigins: string[] } })
        .data;
      if (data) {
        setSlug(data.slug ?? "");
        setStatus(data.buyerFormStatus);
        setRejected(data.rejectedOrigins);
      }
      setSaved("Réglages enregistrés. La vitrine n’a pas été publiée.");
      router.refresh();
    });
  }

  const actif = status === "actif";

  return (
    <section className="crm-panel flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="crm-label">Formulaire acquéreur</h3>
        <span className={`crm-chip ${actif ? "crm-chip--ok" : ""}`}>
          {actif ? "Collecte ouverte" : "Collecte fermée"}
        </span>
      </div>

      <p className="crm-wrap text-[11px] text-[var(--crm-text-faint)]">
        Ces réglages ne publient pas la vitrine Prodigio (actuellement :{" "}
        <strong>{publicationStatus}</strong>). Le formulaire peut collecter des demandes
        depuis une annonce hébergée ailleurs, sans que la page Prodigio soit en ligne.
      </p>

      <TextField
        label="Identifiant public (slug)"
        value={slug}
        onChange={setSlug}
        placeholder="villa-jean-jaures"
      />

      <TextField
        label="Destination de la brochure"
        value={brochureUrl}
        onChange={setBrochureUrl}
        placeholder="https://…"
      />
      <p className="crm-wrap text-[11px] text-[var(--crm-text-faint)]">
        Remise à l’écran immédiatement après une demande valide. Jamais exposée avant :
        deviner l’identifiant public ne suffit pas à l’obtenir.
      </p>

      <TextArea
        label="Domaines autorisés à intégrer le formulaire"
        value={origins}
        onChange={setOrigins}
        rows={3}
        placeholder={"https://villa-jeanjaures-cassis.vercel.app\nhttps://www.exemple.fr"}
      />
      <p className="crm-wrap text-[11px] text-[var(--crm-text-faint)]">
        Une origine par ligne, schéma compris. Laissé vide, aucun site tiers ne peut
        encadrer la page — elle reste consultable en direct.
      </p>
      {rejected.length ? (
        <p role="alert" className="crm-wrap text-xs text-[var(--crm-danger)]">
          Écartées, car inexploitables comme origine : {rejected.join(" · ")}
        </p>
      ) : null}

      {formUrl ? (
        <div className="flex flex-col gap-2">
          <span className="crm-label">Adresse du formulaire</span>
          <code className="crm-wrap text-[11px]">{formUrl}</code>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="crm-btn crm-btn--sm" onClick={() => void copy("url")}>
              {copied === "url" ? "Copié" : "Copier l’adresse"}
            </button>
            <button type="button" className="crm-btn crm-btn--sm" onClick={() => void copy("code")}>
              {copied === "code" ? "Copié" : "Copier le code d’intégration"}
            </button>
          </div>
        </div>
      ) : (
        <p className="crm-wrap text-[11px] text-[var(--crm-text-faint)]">
          Définissez un identifiant public pour obtenir l’adresse à intégrer.
        </p>
      )}

      <FieldError error={error} />
      {saved ? (
        <p role="status" className="crm-wrap text-xs crm-aging--frais">
          {saved}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="crm-btn"
          onClick={() => save()}
          disabled={pending}
        >
          {pending ? "Enregistrement…" : "Enregistrer les réglages"}
        </button>
        {canActivate ? (
          <button
            type="button"
            className={`crm-btn ${actif ? "" : "crm-btn--gold"}`}
            onClick={() => save(actif ? "inactif" : "actif")}
            disabled={pending || !slug.trim()}
          >
            {actif ? "Fermer la collecte" : "Ouvrir la collecte"}
          </button>
        ) : (
          <span className="crm-wrap text-[11px] text-[var(--crm-text-faint)]">
            Seul un administrateur ou un manager ouvre la collecte.
          </span>
        )}
      </div>
    </section>
  );
}

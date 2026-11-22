import type { Metadata } from "next";
import { isMetaAdsReadConfigured, isPilotageCronConfigured, isSupabaseAdminConfigured } from "@/config";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canPiloter } from "@/modules/crm/auth/roles";
import { formatDate, formatDateTime, nowMs } from "@/modules/crm/format";
import { formatCentimes } from "@/modules/pilotage/affichage";
import { lireTableauMeta, type RattachementAffiche } from "@/modules/pilotage/meta/queries";
import type { PilotageMetaSynchroRow } from "@/lib/supabase/types";
import { Chip } from "@/components/crm/ui";
import { AccesReserve, ErreurLecture, NonInstalle } from "@/components/crm/pilotage/vues";
import { OngletsPilotage } from "@/components/crm/pilotage/onglets";
import { BoutonLireMaintenant, ExceptionCampagne, FormulaireRegle, RetirerRegle } from "@/components/crm/pilotage/meta";

export const metadata: Metadata = { title: "Pilotage — Meta Ads" };
/** « Lire Meta maintenant » peut durer : la première lecture remonte tout l'historique. */
export const maxDuration = 300;

const statutLabels: Record<PilotageMetaSynchroRow["statut"], string> = {
  en_cours: "En cours",
  reussie: "Réussie",
  partielle: "Partielle",
  echec: "Échec",
};

function Section({ id, titre, children }: { id: string; titre: string; children: React.ReactNode }) {
  return (
    <section className="crm-panel flex flex-col gap-4 p-5" aria-labelledby={id}>
      <h2 id={id} className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
        {titre}
      </h2>
      {children}
    </section>
  );
}

function Etat({ ok, libelle }: { ok: boolean; libelle: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2">
      <span className="text-sm text-[var(--crm-text)]">{libelle}</span>
      <Chip variant={ok ? "ok" : "danger"}>{ok ? "✓ configuré" : "✗ manquant"}</Chip>
    </li>
  );
}

/**
 * Une pastille courte (elle ne passe pas à la ligne) et, à côté, le détail en
 * texte courant, qui passe à la ligne sur un téléphone.
 */
function libelleRattachement(
  r: RattachementAffiche,
  nom: (id: string) => string,
): { etiquette: string; detail: string | null; variante: "ok" | "danger" | "neutral" } {
  const ra = r.rattachement;
  if (ra.type === "orpheline") return { etiquette: "Orpheline", detail: "rattachée à aucun bien", variante: "danger" };
  if (ra.type === "hors_portefeuille") return { etiquette: "Hors portefeuille", detail: null, variante: "neutral" };
  if (ra.biens.length === 1) return { etiquette: "Bien", detail: nom(ra.biens[0]!), variante: "ok" };
  if (!r.parts) {
    return {
      etiquette: "Groupe — prix manquant",
      detail: `${ra.biens.map(nom).join(" + ")} : répartition impossible`,
      variante: "danger",
    };
  }
  const pourcent = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
  return {
    etiquette: "Groupe",
    detail: r.parts.map((p) => `${nom(p.bien)} ${pourcent.format(p.pourcent)} %`).join(" · "),
    variante: "ok",
  };
}

const sourceLabels = {
  exception_campagne: "exception de campagne",
  nom_pub: "nom de la pub",
  nom_campagne: "nom de la campagne",
} as const;

export default async function PilotageMetaPage() {
  const session = await requireCrmSession("/crm/pilotage/meta");
  if (!canPiloter(session.roles)) return <AccesReserve />;

  const lecture = await lireTableauMeta(new Date(nowMs()));
  if (lecture.etat === "non_installe") return <NonInstalle />;
  if (lecture.etat === "erreur") return <ErreurLecture />;
  const t = lecture.donnees;

  const metaOk = isMetaAdsReadConfigured();
  const cronOk = isPilotageCronConfigured();
  const baseOk = isSupabaseAdminConfigured();
  const derniere = t.synchros[0] ?? null;
  const nomDuBien = (id: string) => t.biens.find((b) => b.id === id)?.nom ?? "bien inconnu";
  const enVigueur = t.regles.filter((r) => !r.retiree_le);
  const retirees = t.regles.filter((r) => r.retiree_le);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div>
          <p className="crm-eyebrow">Pilotage pub</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">Meta Ads — lecture seule</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--crm-text-dim)]">
            Chaque matin, Prodigio OS lit les statistiques du compte publicitaire : rien n’est jamais écrit chez Meta.
            Les dépenses se rattachent aux biens par les règles ci-dessous. Réservé aux administrateurs.
          </p>
        </div>
        <OngletsPilotage actif="meta" />
      </header>

      <Section id="configuration" titre="Configuration">
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Etat ok={metaOk} libelle="Jeton de lecture et compte publicitaire" />
          <Etat ok={cronOk} libelle="Lecture du matin (Vercel Cron)" />
          <Etat ok={baseOk} libelle="Clé serveur de la base" />
        </ul>
        {!metaOk || !cronOk ? (
          <p className="crm-wrap text-xs text-[var(--crm-text-dim)]">
            Les valeurs se collent dans Vercel (projet prodigio-os → Settings → Environment Variables), puis on redéploie.
            Aucune clé ne passe par une conversation. Marche à suivre : docs/33, § lecture Meta.
          </p>
        ) : null}
      </Section>

      <Section id="lecture" titre="Dernière lecture">
        {derniere ? (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3">
            <div>
              <dt className="crm-label">Le</dt>
              <dd className="text-sm text-[var(--crm-text)]">{formatDateTime(derniere.demarree_le)}</dd>
            </div>
            <div>
              <dt className="crm-label">Résultat</dt>
              <dd>
                <Chip variant={derniere.statut === "reussie" ? "ok" : derniere.statut === "en_cours" ? "gold" : "danger"}>
                  {statutLabels[derniere.statut]}
                </Chip>
              </dd>
            </div>
            <div>
              <dt className="crm-label">Période relue</dt>
              <dd className="text-sm text-[var(--crm-text)]">
                {derniere.periode_debut ? `${formatDate(derniere.periode_debut)} → ${formatDate(derniere.periode_fin)}` : "—"}
              </dd>
            </div>
            {derniere.erreur ? <p className="crm-avertissement crm-wrap sm:col-span-3">{derniere.erreur}</p> : null}
            {derniere.devise && derniere.devise !== "EUR" ? (
              <p className="crm-avertissement crm-wrap sm:col-span-3">
                Le compte publicitaire est tenu en {derniere.devise} : les montants ne sont pas des euros.
              </p>
            ) : null}
          </dl>
        ) : (
          <p className="text-sm text-[var(--crm-text-faint)]">Aucune lecture pour l’instant.</p>
        )}
        <BoutonLireMaintenant desactive={!metaOk || !baseOk} />
        {t.synchros.length > 1 ? (
          <details className="text-sm text-[var(--crm-text-dim)]">
            <summary className="cursor-pointer">Journal des lectures ({t.synchros.length})</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {t.synchros.map((s) => (
                <li key={s.id} className="crm-wrap text-xs">
                  {formatDateTime(s.demarree_le)} · {s.declencheur === "matin" ? "matin" : "manuel"} · {statutLabels[s.statut]} ·{" "}
                  {s.lignes_lues} lignes · {s.appels_api} appels{s.erreur ? ` — ${s.erreur}` : ""}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Section>

      <Section id="controle" titre="Contrôle : la somme des pubs égale la dépense du compte">
        {t.controlesLus === 0 ? (
          <p className="text-sm text-[var(--crm-text-faint)]">Pas encore de contrôle : il se fait à chaque lecture.</p>
        ) : t.ecarts.length === 0 ? (
          <p className="text-sm text-[var(--crm-text)]">
            ✓ Aucun écart sur les {t.controlesLus} derniers jours contrôlés (un centime par pub est un arrondi de Meta).
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {t.ecarts.map((e) => (
              <li key={e.jour} className="crm-avertissement crm-wrap">
                {formatDate(e.jour)} : pubs {formatCentimes(e.depense_pubs_cents)}, compte {formatCentimes(e.depense_compte_cents)} —
                écart {formatCentimes(Math.abs(e.depense_pubs_cents - e.depense_compte_cents))}.
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="campagnes" titre={`Campagnes et rattachement (${t.campagnes.length})`}>
        <p className="text-sm text-[var(--crm-text-dim)]">
          Depuis le début : {formatCentimes(t.totaux.depense)} dépensés
          {t.totaux.horsPortefeuille > 0 ? `, dont ${formatCentimes(t.totaux.horsPortefeuille)} hors portefeuille` : ""}.
        </p>
        {t.totaux.orpheline > 0 ? (
          <p className="crm-avertissement crm-wrap">
            ⚠ {formatCentimes(t.totaux.orpheline)} de dépense ne sont rattachés à aucun bien ({t.totaux.campagnesOrphelines}{" "}
            campagne{t.totaux.campagnesOrphelines > 1 ? "s" : ""}). Ils comptent dans les totaux et restent signalés tant
            qu’une règle ne les rattache pas.
          </p>
        ) : null}
        {t.campagnes.length === 0 ? (
          <p className="text-sm text-[var(--crm-text-faint)]">Aucune dépense lue pour l’instant.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {t.campagnes.map((c) => (
              <li
                key={c.campaignId ?? c.pubs[0]?.ad_id}
                className="flex flex-col gap-2 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="crm-wrap text-sm font-semibold text-[var(--crm-text)]">{c.campaignName ?? "Campagne sans nom"}</p>
                    <p className="text-xs text-[var(--crm-text-faint)]">
                      {c.campaignId ?? "sans identifiant"} · {formatDate(c.premierJour)} → {formatDate(c.dernierJour)}
                    </p>
                  </div>
                  <p className="text-sm tabular-nums text-[var(--crm-text)] sm:text-right">
                    {formatCentimes(c.depenseCentimes)}
                    <span className="block text-xs text-[var(--crm-text-dim)]">
                      {c.leads} lead{c.leads > 1 ? "s" : ""} · {c.pubs.length} pub{c.pubs.length > 1 ? "s" : ""}
                    </span>
                  </p>
                </div>
                <ul className="flex flex-col gap-1">
                  {c.rattachements.map((r) => {
                    const l = libelleRattachement(r, nomDuBien);
                    return (
                      <li key={r.cle} className="flex flex-wrap items-center gap-2 text-xs text-[var(--crm-text-dim)]">
                        <Chip variant={l.variante}>{l.etiquette}</Chip>
                        {l.detail ? <span className="crm-wrap font-medium text-[var(--crm-text)]">{l.detail}</span> : null}
                        {r.rattachement.type !== "orpheline" ? <span>par {sourceLabels[r.rattachement.source]}</span> : null}
                        {c.rattachements.length > 1 ? (
                          <span className="tabular-nums">
                            {formatCentimes(r.depenseCentimes)} · {r.pubs} pub{r.pubs > 1 ? "s" : ""}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
                <details className="text-xs text-[var(--crm-text-dim)]">
                  <summary className="cursor-pointer">Les pubs</summary>
                  <ul className="mt-1 flex flex-col gap-1">
                    {c.pubs.map((p) => {
                      const lien = t.liens.get(p.ad_id)?.lien_apercu;
                      return (
                        <li key={p.ad_id} className="crm-wrap">
                          {p.ad_name ?? p.ad_id} — {formatCentimes(p.depense_cents)} · {p.leads} lead{p.leads > 1 ? "s" : ""}
                          {lien ? (
                            <>
                              {" · "}
                              <a href={lien} target="_blank" rel="noopener noreferrer" className="text-[var(--crm-univers)] underline">
                                Voir la pub
                              </a>
                            </>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </details>
                {c.campaignId ? <ExceptionCampagne biens={t.biens} campagneId={c.campaignId} /> : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="regles" titre={`Règles de rattachement (${enVigueur.length})`}>
        <p className="crm-wrap text-xs text-[var(--crm-text-dim)]">
          Ordre : une exception de campagne prime ; sinon le BIEN du nom de la pub (« BIEN | ANGLE | FORMAT | V1 »), puis
          celui de la campagne (« PRODIGIO | BIEN | LEADS »). Changer une règle reclasse tout l’historique.
        </p>
        {enVigueur.length === 0 ? (
          <p className="text-sm text-[var(--crm-text-faint)]">Aucune règle : toute la dépense est orpheline.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {enVigueur.map((r) => {
              const cible =
                r.cible === "hors_portefeuille" ? "hors portefeuille" : r.biens.map(nomDuBien).join(" + ");
              const libelle = `${r.type_regle === "jeton" ? "jeton" : "campagne"} ${r.valeur}`;
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-start justify-between gap-3 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2"
                >
                  <div className="min-w-0 text-sm text-[var(--crm-text)]">
                    <span className="font-semibold">{r.type_regle === "jeton" ? `Jeton ${r.valeur}` : `Campagne ${r.valeur}`}</span>
                    {" → "}
                    {cible}
                    {r.note ? <span className="block text-xs text-[var(--crm-text-faint)]">{r.note}</span> : null}
                  </div>
                  <RetirerRegle regleId={r.id} libelle={libelle} />
                </li>
              );
            })}
          </ul>
        )}
        <div className="crm-panel-2 p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--crm-text)]">Ajouter une règle</h3>
          <FormulaireRegle biens={t.biens} />
        </div>
        {retirees.length > 0 ? (
          <details className="text-sm text-[var(--crm-text-dim)]">
            <summary className="cursor-pointer">Règles retirées ({retirees.length})</summary>
            <ul className="mt-2 flex flex-col gap-1 text-xs">
              {retirees.map((r) => (
                <li key={r.id} className="crm-wrap line-through">
                  {r.type_regle === "jeton" ? `Jeton ${r.valeur}` : `Campagne ${r.valeur}`} — retirée le {formatDateTime(r.retiree_le)}
                  {r.motif_retrait ? ` (« ${r.motif_retrait} »)` : ""}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </Section>
    </div>
  );
}

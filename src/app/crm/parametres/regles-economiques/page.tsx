import type { Metadata } from "next";
import Link from "next/link";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canAdminEconomicRules } from "@/modules/crm/auth/roles";
import {
  listEconomicRules,
  listHolderOrganizations,
} from "@/modules/mandates/lifecycle/queries";
import {
  economicRuleStatusLabels,
  feeBasisLabels,
} from "@/modules/mandates/lifecycle/labels";
import { formatDate } from "@/modules/crm/format";
import { Chip } from "@/components/crm/ui";
import {
  EconomicRuleForm,
  PartnerOrganizationForm,
} from "@/components/crm/mandate/economic-rules-manager";

export const metadata: Metadata = { title: "Règles économiques" };

export default async function EconomicRulesPage() {
  const session = await requireCrmSession("/crm/parametres/regles-economiques");
  if (!canAdminEconomicRules(session.roles)) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="crm-panel p-6">
          <h1 className="text-lg font-semibold text-[var(--crm-text)]">Accès restreint</h1>
          <p className="mt-2 text-sm text-[var(--crm-text-dim)]">
            Seul un administrateur administre les règles économiques et les organisations porteuses.
          </p>
          <Link href="/crm/parametres" className="mt-4 inline-block text-sm text-[var(--crm-gold)] underline">
            ← Retour aux paramètres
          </Link>
        </div>
      </div>
    );
  }

  const [rules, holders] = await Promise.all([
    listEconomicRules(),
    listHolderOrganizations(),
  ]);

  const holderName = new Map(holders.map((h) => [h.id, h.name]));

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <Link href="/crm/parametres" className="text-xs text-[var(--crm-text-dim)] hover:text-[var(--crm-text)]">
          ← Paramètres
        </Link>
        <p className="crm-eyebrow mt-2">Administration</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">
          Règles économiques &amp; organisations porteuses
        </h1>
        <p className="mt-1 text-sm text-[var(--crm-text-dim)]">
          Les conditions économiques sont <strong>versionnées</strong> (par partenaire / segment,
          date d’effet, historique). Un mandat proposé conserve une <strong>photographie</strong> des
          conditions applicables : désactiver une règle ne réinterprète jamais un mandat existant.
        </p>
      </header>

      <div className="crm-panel border-l-2 border-l-[var(--crm-gold)] p-4">
        <p className="crm-wrap text-xs text-[var(--crm-text-dim)]">
          Aucune valeur n’est préremplie comme vérité de production : le seuil premium, les partages
          (ex. 70/30 ou 40/60) et la base HT/TTC des honoraires ne sont que des <em>hypothèses de
          travail</em> tant qu’elles n’ont pas été validées et saisies ici. La base HT/TTC des
          honoraires ne doit jamais être confondue avec la valeur immobilière du bien.
        </p>
      </div>

      {holders.length === 0 ? (
        <section className="crm-panel p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
            Organisation porteuse
          </h2>
          <p className="mb-4 crm-wrap text-sm text-[var(--crm-text-dim)]">
            Aucune agence habilitée n’est encore configurée. Un mandat ne peut pas être porté par
            Prodigio : enregistrez d’abord l’entité immobilière habilitée qui portera juridiquement
            les mandats.
          </p>
          <PartnerOrganizationForm />
        </section>
      ) : (
        <section className="crm-panel p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
            Organisations porteuses (agences habilitées)
          </h2>
          <ul className="mb-4 flex flex-col gap-2">
            {holders.map((h) => (
              <li
                key={h.id}
                className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2.5"
              >
                <span className="crm-wrap text-sm text-[var(--crm-text)]">{h.name}</span>
                <Chip variant="neutral">{h.slug}</Chip>
              </li>
            ))}
          </ul>
          <details>
            <summary className="cursor-pointer text-xs text-[var(--crm-gold)]">
              Ajouter une organisation porteuse
            </summary>
            <div className="mt-3">
              <PartnerOrganizationForm />
            </div>
          </details>
        </section>
      )}

      <section className="crm-panel p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
          Nouvelle règle (ou nouvelle version)
        </h2>
        <EconomicRuleForm holders={holders.map((h) => ({ id: h.id, name: h.name }))} />
      </section>

      <section className="crm-panel p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
          Règles existantes ({rules.length})
        </h2>
        {rules.length === 0 ? (
          <p className="text-sm text-[var(--crm-text-faint)]">
            Aucune règle économique définie. Tant qu’aucune règle active n’existe, un mandat ne peut
            pas être proposé.
          </p>
        ) : (
          <div className="crm-scroll overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.06em] text-[var(--crm-text-faint)]">
                  <th className="py-2 pr-3">Nom</th>
                  <th className="py-2 pr-3">Segment</th>
                  <th className="py-2 pr-3">Porteuse</th>
                  <th className="py-2 pr-3">Base</th>
                  <th className="py-2 pr-3">Prodigio</th>
                  <th className="py-2 pr-3">Partenaire</th>
                  <th className="py-2 pr-3">Effet</th>
                  <th className="py-2 pr-3">Version</th>
                  <th className="py-2 pr-3">Statut</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--crm-line-soft)] align-top">
                    <td className="py-2 pr-3 text-[var(--crm-text)]">{r.name}</td>
                    <td className="py-2 pr-3 text-[var(--crm-text-dim)]">{r.segment}</td>
                    <td className="py-2 pr-3 text-[var(--crm-text-dim)]">
                      {r.organization_id ? holderName.get(r.organization_id) ?? "—" : "—"}
                    </td>
                    <td className="py-2 pr-3 text-[var(--crm-text-dim)]">
                      {feeBasisLabels[r.fee_basis] ?? r.fee_basis}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-[var(--crm-text-dim)]">
                      {r.prodigio_share_pct == null ? "—" : `${r.prodigio_share_pct} %`}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-[var(--crm-text-dim)]">
                      {r.partner_share_pct == null ? "—" : `${r.partner_share_pct} %`}
                    </td>
                    <td className="py-2 pr-3 text-[var(--crm-text-dim)]">
                      {formatDate(r.effective_from)}
                      {r.effective_to ? ` → ${formatDate(r.effective_to)}` : ""}
                    </td>
                    <td className="py-2 pr-3 tabular-nums text-[var(--crm-text-dim)]">v{r.version}</td>
                    <td className="py-2 pr-3">
                      <Chip variant={r.status === "actif" ? "ok" : "neutral"}>
                        {economicRuleStatusLabels[r.status] ?? r.status}
                      </Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

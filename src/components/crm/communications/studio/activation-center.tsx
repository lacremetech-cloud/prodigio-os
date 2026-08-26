import { Chip, SectionTitle } from "@/components/crm/ui";
import {
  MARKETING_DECISIONS,
  marketingActivation,
  transactionalReadiness,
  type ReadinessCheck,
  type TransactionalReadinessInput,
} from "@/modules/communications/studio";

/**
 * **Centre de préparation à l'activation.**
 *
 * Deux colonnes strictement séparées, parce que les deux questions ne se
 * répondent pas au même endroit : le transactionnel se règle dans la
 * configuration, le marketing se règle par des décisions prises hors du système.
 *
 * ⚠️ Aucune mention « Conforme RGPD » n'existe ici, ni ailleurs dans le studio.
 */

function CheckRow({ check }: { check: ReadinessCheck }) {
  return (
    <li className="min-w-0 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="crm-wrap text-sm font-medium text-[var(--crm-text)]">{check.label}</p>
        <Chip variant={check.ready ? "ok" : "neutral"} dot>
          {check.ready ? "Prêt" : "Non prêt"}
        </Chip>
      </div>
      <p className="crm-wrap mt-1 text-[12px] text-[var(--crm-text-dim)]">{check.meaning}</p>
      {!check.ready ? (
        <p className="crm-wrap mt-1 text-[12px] text-[var(--crm-text-faint)]">
          À faire : {check.todo}
        </p>
      ) : null}
    </li>
  );
}

export function ActivationCenter({ readiness }: { readiness: TransactionalReadinessInput }) {
  const checks = transactionalReadiness(readiness);
  const marketing = marketingActivation(MARKETING_DECISIONS);
  const readyCount = checks.filter((c) => c.ready).length;

  return (
    <section className="rounded-[14px] border border-[var(--crm-line)] bg-[var(--crm-panel)] p-4">
      <SectionTitle eyebrow="Préparation" title="Activation des communications" />
      <p className="crm-wrap mb-4 text-sm text-[var(--crm-text-dim)]">
        Deux activations distinctes, à ne jamais confondre. Le transactionnel dépend de la
        configuration ; le marketing dépend de décisions qui ne se prennent pas dans le code.
      </p>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--crm-text)]">Transactionnel</h3>
            <Chip variant={readyCount === checks.length ? "ok" : "neutral"}>
              {readyCount} / {checks.length} prêt(s)
            </Chip>
          </div>
          <ul className="flex flex-col gap-2">
            {checks.map((check) => (
              <CheckRow key={check.key} check={check} />
            ))}
          </ul>
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--crm-text)]">Marketing</h3>
            <Chip variant={marketing.blocked ? "danger" : "neutral"} dot>
              {marketing.blocked ? "Activation bloquée" : "Décisions tranchées"}
            </Chip>
          </div>
          <p
            role="status"
            className="crm-wrap rounded-[10px] border px-3 py-2.5 text-[13px] text-[var(--crm-text-dim)]"
            style={{ borderColor: "var(--crm-danger)", background: "var(--crm-panel-2)" }}
          >
            {marketing.statement} Aucune campagne ne peut partir tant qu&apos;elles ne le sont pas.
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {marketing.pending.map((decision) => (
              <li
                key={decision.key}
                className="min-w-0 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="crm-wrap text-sm font-medium text-[var(--crm-text)]">
                    {decision.label}
                  </p>
                  <Chip variant="danger" dot>
                    À trancher
                  </Chip>
                </div>
                <p className="crm-wrap mt-1 text-[12px] text-[var(--crm-text-dim)]">
                  {decision.question}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

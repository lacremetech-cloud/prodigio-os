import type { Metadata } from "next";
import Link from "next/link";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canViewContactDetails } from "@/modules/crm/auth/roles";
import { listVisites, repartirVisites, grouperParJour, type Visite } from "@/modules/buyers/crm/visites";
import { EmptyState } from "@/components/crm/ui";

export const metadata: Metadata = { title: "Visites" };

const JOUR = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
const HEURE = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" });

/**
 * Agenda des visites de biens.
 *
 * Le menu du commercial envoyait vers l'agenda des ESTIMATIONS — un agenda du
 * CRM Mandats, dont il ne voit rien et qui ne le concerne pas : il y trouvait
 * une page vide intitulée « Rendez-vous d'estimation planifiés ». Ce sont deux
 * métiers distincts : l'estimation se prend chez un vendeur pour décrocher un
 * mandat, la visite se cale avec un acquéreur sur un bien déjà au catalogue.
 *
 * La page ne montre que ce qui est réellement en base, et la RLS décide de ce
 * qui est visible.
 */
export default async function VisitesPage() {
  const session = await requireCrmSession("/crm/visites");
  const canViewContacts = canViewContactDetails(session.roles);

  const visites = await listVisites(canViewContacts);
  const { aVenir, passees } = repartirVisites(visites);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="crm-eyebrow">Acquéreurs</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">
            Agenda des visites
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--crm-text-dim)]">
            Les visites calées depuis les fiches acquéreurs. Pour en ajouter une, ouvrez la fiche
            de la personne et planifiez-la : le dossier passe à l’étape « Visite » dans le même
            geste.
          </p>
        </div>
        <Link href="/crm/acquereurs" className="crm-btn crm-btn--sm">
          ◉ Mes leads
        </Link>
      </header>

      {visites.length === 0 ? (
        <EmptyState
          title="Aucune visite planifiée."
          hint="Ouvrez une fiche acquéreur et utilisez « Planifier la visite » : elle apparaîtra ici."
          icon="◷"
        />
      ) : null}

      {aVenir.length > 0 ? (
        <Bloc titre="À venir" groupes={grouperParJour(aVenir)} />
      ) : visites.length > 0 ? (
        <p className="crm-panel px-4 py-5 text-center text-sm text-[var(--crm-text-dim)]">
          Aucune visite à venir.
        </p>
      ) : null}

      {passees.length > 0 ? (
        <Bloc titre="Déjà passées" groupes={grouperParJour(passees)} attenue />
      ) : null}
    </div>
  );
}

function Bloc({
  titre,
  groupes,
  attenue,
}: {
  titre: string;
  groupes: { jour: string; visites: Visite[] }[];
  attenue?: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--crm-text-dim)]">
        {titre}
      </h2>
      {groupes.map((g) => (
        <div key={g.jour} className="crm-panel flex flex-col gap-2 p-4">
          <p className="text-[13px] font-bold capitalize text-[var(--crm-text)]">
            {JOUR.format(new Date(g.jour))}
          </p>
          <ul className="flex flex-col gap-1.5">
            {g.visites.map((v) => (
              <li key={v.taskId}>
                <Link
                  href={`/crm/acquereurs/${v.buyerProfileId}`}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[10px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] px-3 py-2.5 transition-colors hover:border-[var(--crm-line-hover)]"
                  style={attenue ? { opacity: 0.75 } : undefined}
                >
                  <span className="shrink-0 text-[15px] font-bold tabular-nums text-[var(--crm-text)]">
                    {HEURE.format(new Date(v.startsAt))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="crm-ellipsis block text-sm font-semibold text-[var(--crm-text)]">
                      {v.name}
                    </span>
                    <span className="crm-ellipsis block text-[11px] text-[var(--crm-text-faint)]">
                      {v.propertyLabel ?? "Bien non précisé"}
                      {v.city ? ` · ${v.city}` : ""}
                      {v.assigneeName ? ` · ${v.assigneeName}` : ""}
                    </span>
                  </span>
                  {v.phoneMasked ? (
                    <span className="shrink-0 text-xs tabular-nums text-[var(--crm-text-dim)]">
                      {v.phoneMasked}
                    </span>
                  ) : null}
                  {v.status === "fait" ? (
                    <span className="shrink-0 text-[11px] font-semibold text-[var(--crm-success)]">
                      ✔ Réalisée
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { requireCrmSession } from "@/modules/crm/auth/session";
import { canOperate, canViewContactDetails, hasAnyRole } from "@/modules/crm/auth/roles";
import { TableauCommercial } from "@/components/crm/buyers/tableau-commercial";
import { loadBuyerList } from "@/modules/buyers/crm/queries";
import { listVisites, repartirVisites } from "@/modules/buyers/crm/visites";

export const metadata: Metadata = { title: "Prodigio OS" };

/**
 * La porte d'entrée de Prodigio OS, après connexion.
 *
 * Elle affichait la vue d'ensemble des MANDATS pour tout le monde : un
 * administrateur arrivait sur les chiffres d'un seul des deux métiers, comme si
 * l'autre n'existait pas. Elle propose désormais le choix — et seulement à qui
 * dispose réellement des deux.
 *
 * Le commercial, lui, n'a qu'un espace : lui faire choisir entre deux portes
 * dont une est fermée serait une politesse coûteuse. Il arrive directement sur
 * son travail du jour.
 */
export default async function AccueilPage() {
  const session = await requireCrmSession();
  const canView = canViewContactDetails(session.roles);

  if (hasAnyRole(session.roles, ["commercial"]) && !canOperate(session.roles)) {
    const [{ items, chargeA }, visites] = await Promise.all([
      loadBuyerList(canView),
      listVisites(canView),
    ]);
    const { aVenir } = repartirVisites(visites);
    return (
      <div className="flex flex-col gap-6">
        <header>
          <p className="crm-eyebrow">Aujourd&rsquo;hui</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">
            Vos acqu&eacute;reurs
          </h1>
          <p className="mt-1 text-sm text-[var(--crm-text-dim)]">
            Les demandes arriv&eacute;es sur les biens qui vous sont confi&eacute;s.
          </p>
        </header>
        <TableauCommercial items={items} visites={aVenir} chargeA={chargeA} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <header>
        <p className="crm-eyebrow">Prodigio OS</p>
        <h1 className="mt-1 text-2xl font-semibold text-[var(--crm-text)]">
          Par o&ugrave; commencez-vous&nbsp;?
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-[var(--crm-text-dim)]">
          Deux m&eacute;tiers, deux espaces de travail. La bascule reste disponible en haut du
          menu : on change d&rsquo;espace sans repasser par ici.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CarteEspace
          href="/crm/mandats"
          titre="Mandats"
          resume="L’acquisition des propriétaires."
          points={[
            "Leads vendeurs et qualification",
            "Affectation à un setter",
            "Estimations, relances et signature",
          ]}
          icone="☰"
          accent="--crm-st-nouveau"
        />
        <CarteEspace
          href="/crm/biens"
          titre="Biens"
          resume="Les projets commercialisés."
          points={[
            "Intervenants affectés et fabrique de biens",
            "Leads acquéreurs et visites",
            "Offres et ventes",
          ]}
          icone="◆"
          accent="--crm-st-signe"
        />
      </div>

      <p className="text-xs text-[var(--crm-text-faint)]">
        Les chiffres d&eacute;taill&eacute;s du funnel Mandats se trouvent dans{" "}
        <Link
          href="/crm/vue-ensemble"
          prefetch={false}
          className="font-medium text-[var(--crm-univers)] hover:underline"
        >
          la vue d&rsquo;ensemble
        </Link>
        .
      </p>
    </div>
  );
}

function CarteEspace({
  href,
  titre,
  resume,
  points,
  icone,
  accent,
}: {
  href: string;
  titre: string;
  resume: string;
  points: string[];
  icone: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="crm-panel flex flex-col gap-3 p-6 transition-colors hover:border-[var(--crm-univers)]"
    >
      <span
        aria-hidden
        className="flex h-11 w-11 items-center justify-center rounded-[10px] text-lg"
        style={{
          color: `var(${accent})`,
          background: `color-mix(in srgb, var(${accent}) 15%, var(--crm-panel))`,
        }}
      >
        {icone}
      </span>
      <span className="text-xl font-semibold text-[var(--crm-text)]">{titre}</span>
      <span className="text-sm text-[var(--crm-text-dim)]">{resume}</span>
      <ul className="mt-1 flex flex-col gap-1.5 text-[13px] text-[var(--crm-text-dim)]">
        {points.map((p) => (
          <li key={p} className="flex gap-2">
            <span aria-hidden className="text-[var(--crm-text-faint)]">
              ·
            </span>
            {p}
          </li>
        ))}
      </ul>
    </Link>
  );
}

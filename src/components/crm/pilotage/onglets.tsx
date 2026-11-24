import Link from "next/link";

/**
 * Les pages du pilotage pub, côte à côte : la vue générale, un onglet par bien,
 * puis les saisies et la lecture Meta. La période choisie suit d'un onglet de
 * chiffres à l'autre (`suffixe`, par exemple « ?periode=7_derniers_jours »).
 */
export function OngletsPilotage({
  actif,
  biens = [],
  suffixe = "",
}: {
  /** « general », « donnees », « meta », ou l'identifiant d'un bien. */
  actif: string;
  biens?: { id: string; nom: string }[];
  suffixe?: string;
}) {
  const onglets = [
    { href: `/crm/pilotage${suffixe}`, cle: "general", label: "Vue générale" },
    ...biens.map((b) => ({ href: `/crm/pilotage/biens/${b.id}${suffixe}`, cle: b.id, label: b.nom })),
    { href: "/crm/pilotage/donnees", cle: "donnees", label: "Biens : conditions, lots, coûts" },
    { href: "/crm/pilotage/meta", cle: "meta", label: "Meta Ads" },
  ];
  return (
    <nav aria-label="Pilotage pub" className="crm-tabs flex-wrap self-start">
      {onglets.map((o) => (
        <Link
          key={o.cle}
          href={o.href}
          prefetch={false}
          aria-current={o.cle === actif ? "page" : undefined}
          className={o.cle === actif ? "crm-tab crm-tab--active inline-flex items-center" : "crm-tab inline-flex items-center"}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}

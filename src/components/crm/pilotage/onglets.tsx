import Link from "next/link";

/** Les pages du pilotage pub, côte à côte. */
const ONGLETS = [
  { href: "/crm/pilotage/donnees", cle: "donnees", label: "Biens : conditions, lots, coûts" },
  { href: "/crm/pilotage/meta", cle: "meta", label: "Meta Ads" },
] as const;

export function OngletsPilotage({ actif }: { actif: (typeof ONGLETS)[number]["cle"] }) {
  return (
    <nav aria-label="Pilotage pub" className="crm-tabs self-start">
      {ONGLETS.map((o) => (
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

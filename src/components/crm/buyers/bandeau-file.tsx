import Link from "next/link";
import type { BuyerInboxRow } from "@/modules/buyers/crm/queries";
import { comptesDeLaFile } from "@/modules/buyers/crm/signaux";

/**
 * Ce qu'il y a à travailler, dit en une ligne, au-dessus de la file.
 *
 * Le besoin vient d'une plainte précise : la liste affichait un total, le
 * pipeline un autre, et personne ne savait lequel croire. Le total seul ne
 * suffisait pas non plus — « 16 dossiers » laisse croire à 16 appels à passer
 * alors que deux sont écartés.
 *
 * Les personnes écartées ne sont PAS cachées : le nombre est cliquable et ouvre
 * exactement celles-là, avec leurs notes et leur motif. Un chiffre qu'on ne
 * peut pas ouvrir est un chiffre qu'on finit par contester.
 */
export function BandeauFile({
  rows,
  base,
  contexte,
}: {
  rows: BuyerInboxRow[];
  /** Page vers laquelle pointe l'accès aux non qualifiées. */
  base: string;
  /** Projets et vue en cours, pour ne pas sortir de la sélection. */
  contexte?: string;
}) {
  const { actifs, nonQualifies, sorties } = comptesDeLaFile(rows);
  const lien = `${base}?signal=non_qualifies${contexte ? `&${contexte.replace(/^[?&]/, "")}` : ""}`;

  return (
    <p className="crm-bandeau-file" role="status">
      <strong>
        {actifs} personne{actifs === 1 ? "" : "s"} dans le pipeline actif
      </strong>
      {nonQualifies > 0 ? (
        <>
          {" — "}
          <Link href={lien} className="crm-bandeau-file__lien">
            {nonQualifies} non qualifiée{nonQualifies === 1 ? "" : "s"} hors traitement
          </Link>
        </>
      ) : null}
      {sorties > 0 ? (
        <span className="crm-bandeau-file__reste">
          {" · "}
          {sorties} sortie{sorties === 1 ? "" : "s"} du pipeline (pas intéressé, mauvais numéro)
        </span>
      ) : null}
    </p>
  );
}

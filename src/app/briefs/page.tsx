import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { BRIEFS } from "@/modules/briefs/registre";
import { jetonValide, nomDuCookie } from "@/modules/briefs/code";
import "./briefs.css";

export const metadata: Metadata = {
  title: "Briefs de production",
  robots: { index: false, follow: false, nocache: true },
};

/* Les cookies rendent la page dynamique : un cadenas déjà ouvert doit se voir. */
export const dynamic = "force-dynamic";

/**
 * LA GRILLE DES BRIEFS.
 *
 * Un seul lien à partager, à tout le monde. Chaque bien est verrouillé, et le
 * code décide de ce qu'on ouvre : le monteur qui a le code du 6511 ne voit que
 * le 6511, et il n'a pas besoin qu'on lui envoie une adresse différente.
 *
 * ELLE EST PUBLIQUE, donc elle ne porte QUE ce qui l'est déjà : le nom du bien,
 * sa ville, une photo. Jamais un prix, jamais un état commercial, jamais le nom
 * du mandataire — tout cela vit derrière le code.
 */
export default async function BriefsPage() {
  const magasin = await cookies();

  return (
    <main className="briefs">
      <header className="briefs__tete">
        <p className="briefs__sur">Prodigio</p>
        <h1>Briefs de production</h1>
        <p className="briefs__intro">
          Chaque bien est verrouillé. Ouvrez celui dont on vous a confié le code.
        </p>
      </header>

      <div className="briefs__grille">
        {BRIEFS.map((b) => {
          const ouvert = jetonValide(
            b.slug,
            b.empreinteDuCode,
            magasin.get(nomDuCookie(b.slug))?.value,
          );
          return (
            <Link
              key={b.slug}
              href={ouvert ? `/briefs/${b.slug}/document` : `/briefs/${b.slug}`}
              className="briefs__carte"
            >
              <span
                className="briefs__image"
                style={{ backgroundImage: `url(${b.couverture})` }}
                aria-hidden
              />
              <span className="briefs__corps">
                <span className="briefs__bien">{b.bien}</span>
                <span className="briefs__titre">{b.titre}</span>
                <span className="briefs__ville">{b.ville}</span>
                <span className="briefs__sous">{b.sousTitre}</span>
                <span className={`briefs__etat ${ouvert ? "briefs__etat--ouvert" : ""}`}>
                  {ouvert ? "Ouvert · lire le brief" : "Verrouillé · code requis"}
                </span>
              </span>
            </Link>
          );
        })}
      </div>

      <p className="briefs__pied">
        Ces dossiers sont internes à la production. Ne les rediffusez pas hors de l’équipe qui
        travaille sur le bien.
      </p>
    </main>
  );
}

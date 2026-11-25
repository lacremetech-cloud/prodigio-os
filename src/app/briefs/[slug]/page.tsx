import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { briefParSlug } from "@/modules/briefs/registre";
import { jetonValide, nomDuCookie } from "@/modules/briefs/code";
import { ouvrirLeBriefAction } from "../actions";
import "../briefs.css";

export const metadata: Metadata = {
  title: "Brief protégé",
  robots: { index: false, follow: false, nocache: true },
};

export const dynamic = "force-dynamic";

/**
 * LA PORTE D'UN BRIEF.
 *
 * Un formulaire, un champ, pas de compte à créer. Le code arrive par téléphone
 * ou par message : on le tape une fois, et le navigateur s'en souvient trente
 * jours.
 *
 * Pas de composant client ici, donc pas de JavaScript nécessaire : un
 * formulaire HTML et une action serveur. Un brief se lit parfois depuis un
 * téléphone en montagne, avec une barre de réseau.
 */
export default async function PorteDuBrief({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const brief = briefParSlug(slug);
  if (!brief) notFound();

  const magasin = await cookies();
  if (jetonValide(brief.slug, brief.empreinteDuCode, magasin.get(nomDuCookie(brief.slug))?.value)) {
    redirect(`/briefs/${brief.slug}/document`);
  }

  const sp = await searchParams;
  const erreur = sp.erreur === "1";

  return (
    <main className="briefs briefs--porte">
      <div className="porte">
        <span
          className="porte__image"
          style={{ backgroundImage: `url(${brief.couverture})` }}
          aria-hidden
        />
        <div className="porte__corps">
          <p className="briefs__sur">{brief.ville}</p>
          <h1>{brief.bien}</h1>
          <p className="porte__intro">
            Ce dossier est réservé à l’équipe qui travaille sur le bien. Saisissez le code qu’on
            vous a communiqué.
          </p>

          <form action={ouvrirLeBriefAction} className="porte__form">
            <input type="hidden" name="slug" value={brief.slug} />
            <label className="porte__label" htmlFor="code">
              Code d’accès
            </label>
            <input
              id="code"
              name="code"
              className="porte__champ"
              placeholder="XXXX-XXXX-XXXX"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              required
              aria-describedby={erreur ? "porte-erreur" : undefined}
            />
            {/* Un seul message, quelle que soit la cause. Dire « ce bien n'existe
                pas » plutôt que « code faux » renseignerait un curieux sur ce
                qui existe. */}
            {erreur ? (
              <p id="porte-erreur" className="porte__erreur" role="alert">
                Ce code ne correspond pas. Vérifiez-le, ou redemandez-le à votre contact chez
                Prodigio.
              </p>
            ) : null}
            <button type="submit" className="porte__bouton">
              Ouvrir le brief
            </button>
          </form>

          <Link href="/briefs" className="porte__retour">
            ← Tous les biens
          </Link>
        </div>
      </div>
    </main>
  );
}

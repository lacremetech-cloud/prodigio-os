import type { Metadata } from "next";
import { AttributionCapture } from "@/components/mandate/attribution-capture";
import { SiteFooter } from "@/components/mandate/landing/site-footer";
import { HomeHero } from "@/components/home/home-hero";
import { PositioningSection } from "@/components/home/positioning-section";
import { AccessSection } from "@/components/home/access-section";
import { media } from "@/lib/media";

const HOME_TITLE = "Prodigio — Mise en marché active de biens d'exception";
const HOME_DESCRIPTION =
  "Prodigio ne met pas votre bien en vente, Prodigio le vend. Système de mise " +
  "en marché active pour les propriétés d'exception : chaque bien devient une " +
  "marque, sa visibilité est financée et ses acquéreurs sont recherchés en " +
  "France comme à l'étranger.";

export const metadata: Metadata = {
  // Titre absolu : la page racine n'ajoute pas le suffixe « — Prodigio OS ».
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  // Canonique de la racine (résolue sur https://go.prodigio.fr/ en production
  // via `metadataBase`). Un seul canonique, jamais codé en dur.
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: [
      {
        url: media.hero.src,
        width: media.hero.width,
        height: media.hero.height,
        alt: media.hero.alt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: [media.hero.src],
  },
};

/**
 * Page d'accueil publique de `https://go.prodigio.fr/`.
 *
 * Porte d'entrée premium et courte vers l'écosystème Prodigio : hero
 * cinématographique (signature + double CTA), positionnement en points courts,
 * puis aiguillage « Choisissez votre accès ». Elle ne duplique pas la landing
 * propriétaire et n'expose aucune route interne (`/crm/*`).
 *
 * L'attribution marketing est captée dès l'arrivée sur la racine
 * (`AttributionCapture`) et conservée en `sessionStorage` : les UTM saisis à
 * l'entrée sont préservés jusqu'au dépôt, quelle que soit la navigation interne.
 */
export default function HomePage() {
  return (
    <main className="bg-ivory">
      <AttributionCapture />
      <HomeHero />
      <PositioningSection />
      <AccessSection />
      <SiteFooter />
    </main>
  );
}

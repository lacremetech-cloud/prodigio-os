import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { site } from "@/lib/site";

// Polices AUTO-HÉBERGÉES dans le dépôt (fichiers `src/app/fonts/*.woff2`, sous-
// ensemble latin) et servies via `next/font/local`. AUCUN appel réseau au build
// ni côté navigateur : le build ne dépend plus de fonts.gstatic.com (cause de
// l'échec Vercel). Fichiers sous licence SIL Open Font License (OFL), qui
// autorise l'auto-hébergement (voir `src/app/fonts/*-OFL-LICENSE.txt`).
//
// DEUX familles maîtrisées, identiques à l'existant (mêmes variables CSS, mêmes
// graisses/styles) :
//  - Cormorant Garamond : GRANDS titres éditoriaux uniquement (serif de luxe) —
//    graisses 500/600 normal + italique, et 700 normal (titre du hero
//    propriétaire, qui demande davantage de présence).
//  - Inter : tout le reste — textes, questions, choix, formulaires, boutons,
//    signature et intertitres — graisses 400/500/600.
const cormorant = localFont({
  variable: "--font-cormorant",
  display: "swap",
  src: [
    { path: "./fonts/cormorant-garamond-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/cormorant-garamond-latin-500-italic.woff2", weight: "500", style: "italic" },
    { path: "./fonts/cormorant-garamond-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/cormorant-garamond-latin-600-italic.woff2", weight: "600", style: "italic" },
    { path: "./fonts/cormorant-garamond-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
});

const inter = localFont({
  variable: "--font-inter",
  display: "swap",
  src: [
    { path: "./fonts/inter-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/inter-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/inter-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — Immobilier d'exception`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  applicationName: site.name,
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: site.name,
    title: `${site.name} — Immobilier d'exception`,
    description: site.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${site.name} — Immobilier d'exception`,
    description: site.description,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang={site.locale}
      // Le script ci-dessous ajoute la classe `js` sur <html> avant l'hydratation
      // (SEO / no-JS). Cette mutation intentionnelle est attendue et ne doit pas
      // déclencher d'avertissement d'hydratation.
      suppressHydrationWarning
      className={`${cormorant.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        {/* Marque le JS actif au plus tôt : les animations « au scroll » ne
            masquent le contenu que si le JavaScript fonctionne (SEO / no-JS). */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js');",
          }}
        />
        {children}
      </body>
    </html>
  );
}

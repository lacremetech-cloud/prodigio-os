import type { Metadata } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { site } from "@/lib/site";

// Polices auto-hébergées par Next.js lors du build (aucun appel Google Fonts
// depuis le navigateur). DEUX familles maîtrisées :
//  - Cormorant Garamond : GRANDS titres éditoriaux uniquement (serif de luxe).
//  - Inter : tout le reste — textes, questions, choix, formulaires, boutons,
//    signature et intertitres. Sans-serif extrêmement lisible et contemporaine.
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
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

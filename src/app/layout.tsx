import type { Metadata } from "next";
import { Cinzel, Cormorant_Garamond, Josefin_Sans } from "next/font/google";
import "./globals.css";
import { site } from "@/lib/site";

// Polices auto-hébergées par Next.js lors du build (aucun appel Google Fonts
// depuis le navigateur). Système typographique :
//  - Cinzel : signature et intertitres capitales espacées (usage titrage).
//  - Cormorant Garamond : titres éditoriaux (serif haut de gamme, presse de luxe).
//  - Josefin Sans : textes courants et interface.
const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const josefinSans = Josefin_Sans({
  variable: "--font-josefin",
  subsets: ["latin"],
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
      className={`${cinzel.variable} ${cormorant.variable} ${josefinSans.variable} h-full antialiased`}
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

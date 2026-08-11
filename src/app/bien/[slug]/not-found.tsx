import type { Metadata } from "next";
import Link from "next/link";

/**
 * 404 propre pour un slug inexistant, un brouillon ou un bien dépublié. Ne révèle
 * jamais l'existence interne d'un bien : message neutre, toujours `noindex`.
 */
export const metadata: Metadata = {
  title: "Propriété introuvable",
  robots: { index: false, follow: false },
};

export default function PropertyNotFound() {
  return (
    <main className="grain relative isolate flex min-h-dvh flex-col items-center justify-center bg-onyx px-6 text-center text-ivory">
      <div aria-hidden className="absolute inset-0" style={{ background: "var(--overlay-immersive)" }} />
      <div className="relative z-10 flex max-w-md flex-col items-center gap-5">
        <p className="eyebrow text-gold-soft">Prodigio</p>
        <h1 className="text-3xl font-medium sm:text-4xl">Cette propriété n’est pas disponible</h1>
        <p className="text-pretty text-text-on-dark-muted">
          La page que vous cherchez n’existe pas ou n’est plus présentée publiquement.
        </p>
        <Link
          href="/"
          className="cta-shine mt-2 inline-flex items-center gap-2 rounded-full bg-ivory px-7 py-3.5 text-sm font-semibold text-wood-black transition hover:-translate-y-0.5"
        >
          Retour à l’accueil
          <span aria-hidden>→</span>
        </Link>
      </div>
    </main>
  );
}

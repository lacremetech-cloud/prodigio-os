import Link from "next/link";

/**
 * Identité Prodigio (marque sérif). Deux éléments réutilisables :
 *  - `ProdigioMark` : le monogramme « P » (sérif) dans un cartouche — écho de la
 *    favicon.
 *  - `ProdigioLogo` : le verrou complet (monogramme + mot-symbole PRODIGIO), en
 *    lien vers la landing. Pensé pour fond sombre.
 *
 * Recréé en vectoriel/typographie (sérif Cormorant) pour rester net à toute
 * taille et cohérent avec la favicon ; remplaçable par un fichier fourni.
 */

export function ProdigioMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center border border-ivory/30 bg-ivory/[0.04] ${className}`}
    >
      <span className="font-display font-medium leading-none">P</span>
    </span>
  );
}

interface ProdigioLogoProps {
  href?: string;
  tagline?: string;
  className?: string;
}

export function ProdigioLogo({ href = "/proprietaire", tagline, className = "" }: ProdigioLogoProps) {
  return (
    <Link
      href={href}
      aria-label="Prodigio — accueil"
      className={`group inline-flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--color-focus)] ${className}`}
    >
      <ProdigioMark className="size-9 text-lg transition-colors duration-300 group-hover:border-ivory/60" />
      <span className="flex flex-col leading-none">
        <span className="font-display text-xl leading-none tracking-[0.14em] text-ivory">
          PRODIGIO
        </span>
        {tagline ? (
          <span className="mt-1.5 font-signature text-[0.58rem] uppercase tracking-[0.28em] text-ivory/65">
            {tagline}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

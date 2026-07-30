import Image from "next/image";
import Link from "next/link";

/**
 * Logo Prodigio officiel (mot-symbole sérif « PRODIGIO » + « Immobilier
 * d'exception »), fourni en PNG blanc sur transparent — pensé pour fond sombre.
 * Rendu via `next/image` (dimensions réelles 900×200) pour rester net sans
 * décalage de mise en page.
 */
interface ProdigioLogoProps {
  href?: string;
  className?: string;
  priority?: boolean;
  /** Classe de hauteur (largeur auto). Défaut : compact pour la nav. */
  sizeClassName?: string;
}

export function ProdigioLogo({
  href = "/proprietaire",
  className = "",
  priority = false,
  sizeClassName = "h-9 w-auto sm:h-11",
}: ProdigioLogoProps) {
  return (
    <Link
      href={href}
      aria-label="Prodigio — Immobilier d'exception — accueil"
      className={`inline-flex shrink-0 items-center transition-opacity duration-300 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[color:var(--color-focus)] ${className}`}
    >
      <Image
        src="/images/brand/logo-prodigio.png"
        alt="Prodigio — Immobilier d'exception"
        width={900}
        height={200}
        priority={priority}
        className={sizeClassName}
      />
    </Link>
  );
}

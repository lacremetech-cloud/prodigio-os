import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "contrast" | "ghost-dark" | "ghost-light";

const base =
  "group inline-flex min-h-[3rem] items-center justify-center gap-3 px-7 py-4 " +
  "text-sm font-medium tracking-[0.01em] transition-colors duration-200 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)] " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  // Contexte CLAIR : encre pleine, texte papier (contraste maximal, sobre).
  primary:
    "bg-wood-black text-surface border border-wood-black hover:bg-[color:#26272b]",
  // Contexte SOMBRE (hero, sélectivité) : bouton clair plein, texte encre —
  // immédiatement identifiable sur une photographie sombre.
  contrast:
    "bg-text-on-dark text-wood-black border border-text-on-dark hover:bg-white",
  // Secondaire sur fond sombre : contour clair qui se remplit au survol.
  "ghost-dark":
    "border border-[color:var(--color-border-strong-dark)] text-text-on-dark hover:bg-text-on-dark hover:text-wood-black",
  // Secondaire sur fond clair : contour visible.
  "ghost-light":
    "border border-[color:var(--color-border-strong)] text-wood-black hover:border-wood-black",
};

interface CtaLinkProps extends Omit<ComponentProps<typeof Link>, "className"> {
  variant?: Variant;
  children: ReactNode;
  className?: string;
}

/**
 * Lien d'appel à l'action premium (rectangulaire, contrasté, animation
 * discrète). S'appuie sur les tokens du design system.
 */
export function CtaLink({
  variant = "primary",
  children,
  className = "",
  ...props
}: CtaLinkProps) {
  return (
    <Link className={`${base} ${variants[variant]} ${className}`} {...props}>
      <span>{children}</span>
      <span
        aria-hidden="true"
        className="translate-x-0 transition-transform duration-200 group-hover:translate-x-1"
      >
        →
      </span>
    </Link>
  );
}

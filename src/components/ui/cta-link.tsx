import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "gold" | "ghost-dark" | "ghost-light";

const base =
  "group inline-flex items-center justify-center gap-3 px-7 py-4 text-sm " +
  "tracking-[0.02em] transition-colors duration-200 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold " +
  "disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  // Fond noir bois, texte ivoire — sobre et haut de gamme.
  primary:
    "bg-wood-black text-ivory border border-wood-black hover:bg-onyx-soft",
  // Or vieilli.
  gold: "bg-gold text-white border border-gold hover:bg-[#9d7c4b]",
  // Sur fond sombre (hero, analyse) : contour clair qui se remplit au survol.
  "ghost-dark":
    "border border-[color:var(--color-border-dark)] text-ivory hover:bg-ivory hover:text-wood-black",
  // Sur fond clair : contour discret.
  "ghost-light":
    "border border-[color:var(--color-border)] text-wood-black hover:border-gold hover:text-gold",
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

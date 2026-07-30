import { ProdigioLogo } from "@/components/ui/prodigio-logo";

/**
 * Pied de page sobre. Positionnement honnête : le Système Prodigio pilote la
 * mise en marché ; les mandats sont portés par une agence habilitée distincte.
 * Aucune mention de partenaire nommé, aucune obligation juridique inventée.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-wood-black px-6 py-14 text-ivory sm:px-10 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-8 border-b border-border-dark pb-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-md">
            <ProdigioLogo />
            <p className="mt-5 text-pretty text-sm leading-relaxed text-text-on-dark-muted">
              Le Système Prodigio pilote la mise en marché de propriétés
              d&apos;exception. Les mandats immobiliers sont portés par une agence
              immobilière habilitée, distincte du Système Prodigio.
            </p>
          </div>
          <div className="text-sm text-text-on-dark-muted">
            <p className="eyebrow text-gold-soft">Confidentialité</p>
            <p className="mt-4 max-w-xs text-pretty leading-relaxed">
              Chaque demande est étudiée individuellement. Vos informations
              restent confidentielles et sans engagement de votre part.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 text-xs text-text-on-dark-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} Prodigio · Immobilier d&apos;exception</p>
          <p>
            Développement et exploitation assurés par INDESCALE. Mentions légales
            à publier.
          </p>
        </div>
      </div>
    </footer>
  );
}

import { LandingCta } from "@/components/ui/landing-cta";
import { Reveal } from "@/components/ui/reveal";
import { ANALYSE_ROUTE, PROPRIETAIRE_ROUTE } from "@/lib/routes";
import { homeCopy } from "./home-copy";

/**
 * Aiguillage « Choisissez votre accès » : deux portes claires vers le bon
 * parcours — propriétaire (découverte + éligibilité) et espace sécurisé
 * (connexion). Section sombre pour un contraste fort avec le positionnement
 * clair. Aucune route interne (`/crm/*`) n'est exposée : l'espace sécurisé
 * conduit uniquement vers `/connexion`.
 */
export function AccessSection() {
  const { access } = homeCopy;

  return (
    <section
      aria-labelledby="access-title"
      className="bg-onyx px-6 py-20 text-ivory sm:px-10 sm:py-28 lg:px-16"
    >
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <Reveal>
            <p className="eyebrow text-gold-soft">{access.eyebrow}</p>
          </Reveal>
          <Reveal delayMs={80}>
            <h2
              id="access-title"
              className="mt-4 text-balance text-3xl leading-[1.1] text-ivory sm:text-4xl lg:text-[2.9rem]"
            >
              {access.title}
            </h2>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {/* Propriétaire d'un bien — audience principale. */}
          <Reveal
            variant="up"
            className="flex flex-col rounded-lg border border-border-dark bg-onyx-soft p-8 sm:p-10"
          >
            <h3 className="font-signature text-xs font-semibold uppercase tracking-[0.2em] text-gold-soft">
              {access.owner.label}
            </h3>
            <p className="mt-5 flex-1 text-pretty leading-relaxed text-text-on-dark-muted">
              {access.owner.text}
            </p>
            <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:flex-wrap">
              <LandingCta
                href={ANALYSE_ROUTE}
                tone="contrast"
                size="lg"
                className="w-full sm:w-auto"
              >
                {access.owner.linkEligibility}
              </LandingCta>
              <LandingCta
                href={PROPRIETAIRE_ROUTE}
                tone="ghost-dark"
                size="lg"
                className="w-full sm:w-auto"
              >
                {access.owner.linkSystem}
              </LandingCta>
            </div>
          </Reveal>

          {/* Espace sécurisé — clients, partenaires, équipe. */}
          <Reveal
            variant="up"
            delayMs={90}
            className="flex flex-col rounded-lg border border-border-dark bg-onyx-soft p-8 sm:p-10"
          >
            <h3 className="font-signature text-xs font-semibold uppercase tracking-[0.2em] text-gold-soft">
              {access.secure.label}
            </h3>
            <p className="mt-5 flex-1 text-pretty leading-relaxed text-text-on-dark-muted">
              {access.secure.text}
            </p>
            <div className="mt-8">
              <LandingCta
                href="/connexion"
                tone="ghost-dark"
                size="lg"
                className="w-full sm:w-auto"
              >
                {access.secure.link}
              </LandingCta>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

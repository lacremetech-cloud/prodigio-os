import { CtaLink } from "@/components/ui/cta-link";
import { ANALYSE_ROUTE } from "@/lib/routes";
import { CTA_PRIMARY, MICROCOPY, finalCta } from "./copy";

/**
 * Dernier appel à l'action, sur noir profond — clôture éditoriale avant le pied
 * de page. Un seul geste attendu : tester l'éligibilité.
 */
export function FinalCtaSection() {
  return (
    <section className="bg-onyx px-6 py-28 text-ivory sm:px-10 sm:py-36 lg:px-16">
      <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
        <p className="eyebrow text-gold-soft">{finalCta.eyebrow}</p>
        <h2 className="mt-6 max-w-2xl text-balance text-3xl leading-[1.14] text-ivory sm:text-4xl md:text-[2.9rem]">
          {finalCta.title}
        </h2>
        <p className="mt-6 max-w-xl text-pretty leading-relaxed text-ivory/80">
          {finalCta.text}
        </p>
        <div className="mt-11 flex flex-col items-center gap-4">
          <CtaLink href={ANALYSE_ROUTE} variant="contrast">
            {CTA_PRIMARY}
          </CtaLink>
          <p className="text-sm text-ivory/70">{MICROCOPY}</p>
        </div>
      </div>
    </section>
  );
}

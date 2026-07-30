import { Reveal } from "@/components/ui/reveal";
import { SectionMarker } from "./section-marker";
import { modele } from "./copy";

/**
 * Le modèle — argument de conversion fort : Prodigio finance la visibilité et
 * n'est rémunéré qu'au résultat. Fond ivoire, grande typographie, accent doré.
 */
export function ModeleSection() {
  return (
    <section className="bg-ivory px-6 py-24 text-wood-black sm:py-32 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <SectionMarker index={modele.index} label={modele.kicker} />
        </Reveal>
        <Reveal variant="rise" delayMs={80}>
          <h2 className="mt-8 text-balance text-4xl leading-[1.08] sm:text-5xl lg:text-6xl">
            {modele.title}{" "}
            <span className="italic text-[color:var(--color-gold)]">
              {modele.emphasis}
            </span>
          </h2>
        </Reveal>
        <Reveal delayMs={200}>
          <p className="mt-8 max-w-2xl text-pretty text-lg leading-relaxed text-text-secondary">
            {modele.text}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

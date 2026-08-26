import { Reveal } from "@/components/ui/reveal";
import { SectionLabel } from "./section-label";
import { manifeste } from "./copy";

function Colonne({
  label,
  items,
  tone,
  delayMs,
}: {
  label: string;
  items: readonly string[];
  tone: "neutral" | "accent";
  delayMs: number;
}) {
  return (
    <Reveal variant="blur" delayMs={delayMs} className="flex-1">
      <p
        className={`font-signature text-[0.72rem] uppercase tracking-[0.24em] ${
          tone === "accent" ? "text-gold-soft" : "text-text-on-dark-muted"
        }`}
      >
        {label}
      </p>
      <ul
        className={`mt-6 space-y-2 font-display text-xl leading-snug sm:text-2xl ${
          tone === "accent" ? "text-ivory" : "text-text-on-dark-muted"
        }`}
      >
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Reveal>
  );
}

/**
 * Le meilleur des deux mondes — la section qui doit faire comprendre le
 * positionnement Prodigio en moins de dix secondes.
 *
 * Une équation, littéralement : expertise immobilière + Système Prodigio™ =
 * commercialisation augmentée. Aucun paragraphe explicatif ; la composition
 * porte le sens.
 */
export function ManifesteSection() {
  return (
    <section className="bg-onyx px-5 py-24 text-ivory sm:px-10 sm:py-32 lg:px-14">
      <div className="mx-auto max-w-[88rem]">
        <Reveal>
          <SectionLabel tone="dark">{manifeste.eyebrow}</SectionLabel>
        </Reveal>
        <Reveal variant="rise" delayMs={70}>
          <h2 className="mt-8 max-w-[22ch] text-balance text-[1.9rem] leading-[1.08] sm:text-4xl lg:max-w-[26ch] lg:text-[3.4rem]">
            <span className="text-text-on-dark-muted">{manifeste.titleLine1}</span>{" "}
            <span className="text-ivory">{manifeste.titleLine2}</span>
          </h2>
        </Reveal>

        {/* L'équation. */}
        <div className="mt-20 flex flex-col gap-10 md:flex-row md:items-start md:gap-10">
          <Colonne
            label={manifeste.expertise.label}
            items={manifeste.expertise.items}
            tone="neutral"
            delayMs={0}
          />
          <Reveal delayMs={120} className="md:self-center">
            <span
              aria-hidden="true"
              className="block font-display text-4xl leading-none text-[color:var(--color-gold-soft)] sm:text-5xl"
            >
              +
            </span>
          </Reveal>
          <Colonne
            label={manifeste.systeme.label}
            items={manifeste.systeme.items}
            tone="accent"
            delayMs={180}
          />
        </div>

        <Reveal variant="rise" delayMs={120}>
          <div className="mt-16 border-t border-border-dark pt-12">
            <span
              aria-hidden="true"
              className="block font-display text-3xl leading-none text-[color:var(--color-gold-soft)] sm:text-4xl"
            >
              =
            </span>
            <p className="mt-4 max-w-[14ch] text-balance font-display text-[2.4rem] leading-[1.02] text-ivory sm:text-6xl lg:text-[5rem]">
              {manifeste.resultat}
            </p>
          </div>
        </Reveal>

        <Reveal delayMs={200}>
          <p className="mt-14 font-display text-xl leading-snug text-text-on-dark-muted sm:text-2xl">
            {manifeste.statementA}
          </p>
          <p className="font-display text-xl leading-snug text-ivory sm:text-2xl">
            {manifeste.statementB}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

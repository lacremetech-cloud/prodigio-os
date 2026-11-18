import { Reveal } from "@/components/ui/reveal";
import { marches } from "./copy";

/** Une colonne de marché — même traitement pour les deux, l'une n'écrase pas l'autre. */
function Marche({
  label,
  hint,
  items,
  tone,
}: {
  label: string;
  hint: string;
  items: readonly string[];
  tone: "neutral" | "gold";
}) {
  const isGold = tone === "gold";
  return (
    <div
      className={
        isGold
          ? "border border-[color:var(--color-gold)]/45 bg-surface p-8 shadow-[var(--shadow-md)] sm:p-10"
          : "border border-border p-8 sm:p-10"
      }
    >
      <p
        className={`font-signature text-xs uppercase tracking-[0.24em] ${
          isGold ? "text-[color:var(--color-gold)]" : "text-text-secondary"
        }`}
      >
        {label}
      </p>
      <p className="mt-3 text-sm text-text-secondary">{hint}</p>
      <ul className="mt-7 space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className={`text-lg leading-snug ${isGold ? "" : "text-text-secondary"}`}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Deux marchés — le positionnement, énoncé sans opposition.
 *
 * La cible connaît le métier : elle sait ce que valent les meilleures agences de
 * prestige. Prétendre le contraire décrédibiliserait Prodigio. La section
 * commence donc par leur donner raison — puis nomme le seul marché que
 * personne n'atteint.
 *
 * Les deux colonnes reçoivent **le même traitement** : le marché actif n'est pas
 * dévalorisé, il est simplement incomplet. Un test échoue si une formule
 * accusatoire réapparaît.
 */
export function MarchesSection() {
  return (
    <section className="bg-ivory px-6 py-20 text-wood-black sm:px-10 sm:py-28 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <p className="eyebrow text-[color:var(--color-gold)]">{marches.eyebrow}</p>
        </Reveal>
        <Reveal variant="rise" delayMs={70}>
          <h2 className="mt-6 max-w-3xl text-balance text-3xl leading-[1.14] sm:text-4xl">
            {marches.title}
          </h2>
        </Reveal>
        <Reveal delayMs={140}>
          <p className="mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-text-secondary">
            {marches.body}
          </p>
          <p className="mt-5 max-w-2xl font-display text-xl leading-snug sm:text-2xl">
            {marches.aside}
          </p>
        </Reveal>

        <div className="mt-14 grid gap-8 md:grid-cols-2">
          <Reveal variant="blur">
            <Marche
              label={marches.actif.label}
              hint={marches.actif.hint}
              items={marches.actif.items}
              tone="neutral"
            />
          </Reveal>
          <Reveal variant="rise" delayMs={120}>
            <Marche
              label={marches.latent.label}
              hint={marches.latent.hint}
              items={marches.latent.items}
              tone="gold"
            />
          </Reveal>
        </div>

        <Reveal variant="rise" delayMs={140}>
          <p className="mt-14 text-balance text-center font-display text-2xl leading-[1.2] sm:text-3xl lg:text-4xl">
            {marches.punchLine1}
            <br />
            <span className="text-[color:var(--color-gold)]">{marches.punchLine2}</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

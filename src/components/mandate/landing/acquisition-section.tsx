import Image from "next/image";
import { Reveal } from "@/components/ui/reveal";
import { media } from "@/lib/media";
import { acquisition } from "./copy";

/**
 * Maquette d'une publicité Prodigio sur un écran de téléphone.
 *
 * Décorative et explicitement présentée comme une illustration : elle montre où
 * se joue la campagne, sans imiter l'interface d'un réseau précis.
 */
function AdMock() {
  return (
    <figure className="mx-auto w-full max-w-[17rem]">
      <div className="overflow-hidden rounded-[2rem] border border-ivory/15 bg-onyx-soft p-2 shadow-[0_40px_90px_-30px_rgba(0,0,0,0.9)]">
        <div className="overflow-hidden rounded-[1.6rem] bg-onyx">
          <div className="flex items-center gap-2 px-4 py-3">
            <span aria-hidden="true" className="size-6 rounded-full bg-gold-soft/25" />
            <span className="font-signature text-[0.58rem] uppercase tracking-[0.18em] text-ivory/80">
              Prodigio
            </span>
            <span className="ml-auto font-signature text-[0.52rem] uppercase tracking-[0.16em] text-ivory/40">
              {acquisition.adMock.sponsored}
            </span>
          </div>
          <div className="relative aspect-[4/5] w-full">
            <Image
              src={media.categoryVilla.src}
              alt=""
              aria-hidden="true"
              fill
              sizes="272px"
              className="object-cover"
            />
          </div>
          <p className="px-4 pb-3 pt-3 text-[0.8rem] leading-snug text-ivory/85">
            {acquisition.adMock.caption}
          </p>
          <p className="mx-4 mb-4 bg-[color:var(--color-gold-soft)] px-3 py-2 text-center text-[0.72rem] font-semibold text-wood-black">
            {acquisition.adMock.cta}
          </p>
        </div>
      </div>
      <figcaption className="mt-3 text-center font-signature text-[0.56rem] uppercase tracking-[0.18em] text-ivory/40">
        {acquisition.adMock.note}
      </figcaption>
    </figure>
  );
}

/** Une colonne de la comparaison — deux natures d'objet, pas un bon et un mauvais. */
function Colonne({
  label,
  items,
  tone,
}: {
  label: string;
  items: readonly string[];
  tone: "neutral" | "gold";
}) {
  const isGold = tone === "gold";
  return (
    <div
      className={`border p-7 sm:p-8 ${
        isGold
          ? "border-[color:var(--color-gold-soft)]/45 bg-onyx-soft"
          : "border-border-strong-dark"
      }`}
    >
      <p
        className={`font-signature text-xs uppercase tracking-[0.24em] ${
          isGold ? "text-gold-soft" : "text-text-on-dark-muted"
        }`}
      >
        {label}
      </p>
      <ul className="mt-6 space-y-2.5">
        {items.map((item) => (
          <li
            key={item}
            className={`text-lg leading-snug ${isGold ? "text-ivory" : "text-text-on-dark-muted"}`}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Visibilité ≠ acquisition.
 *
 * L'un des deux messages décisifs de la page — et celui qui demande le plus de
 * précaution. **On n'écrit jamais que les réseaux sociaux ne fonctionnent
 * pas** : ils fonctionnent, et les meilleures agences les utilisent très bien.
 * La question posée est ailleurs : parmi ces vues, combien pouvaient acheter ?
 * Et qu'a-t-on appris pour la suite ?
 *
 * Les 50 000 vues du titre sont une hypothèse de raisonnement, jamais un
 * résultat Prodigio.
 */
export function AcquisitionSection() {
  return (
    <section className="grain relative isolate overflow-hidden bg-onyx px-6 py-20 text-ivory sm:px-10 sm:py-28 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-3xl">
          <Reveal>
            <p className="eyebrow text-gold-soft">{acquisition.eyebrow}</p>
          </Reveal>
          <Reveal variant="rise" delayMs={70}>
            <h2 className="mt-6 text-balance font-display text-[2rem] leading-[1.12] text-ivory sm:text-4xl lg:text-[3rem]">
              {acquisition.title}
            </h2>
          </Reveal>
          <Reveal delayMs={150}>
            <p className="mt-7 max-w-2xl text-pretty leading-relaxed text-text-on-dark-muted">
              {acquisition.body}
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-16">
          <div className="grid gap-6 sm:grid-cols-2">
            <Reveal variant="blur">
              <Colonne
                label={acquisition.publication.label}
                items={acquisition.publication.items}
                tone="neutral"
              />
            </Reveal>
            <Reveal variant="rise" delayMs={120}>
              <Colonne
                label={acquisition.campagne.label}
                items={acquisition.campagne.items}
                tone="gold"
              />
            </Reveal>
          </div>

          <Reveal variant="scale" delayMs={160}>
            <AdMock />
          </Reveal>
        </div>

        <Reveal variant="rise" delayMs={140}>
          <p className="mt-14 text-balance text-center font-display text-2xl leading-[1.2] sm:text-3xl lg:text-4xl">
            {acquisition.punchLine1}
            <br />
            <span className="text-gold-soft">{acquisition.punchLine2}</span>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

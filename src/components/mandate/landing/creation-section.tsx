import Image from "next/image";
import { Reveal } from "@/components/ui/reveal";
import { media, type MediaAsset } from "@/lib/media";
import { creation } from "./copy";

/** Cadre d'illustration : image complète, jamais recadrée — on lit les détails. */
function Shot({
  asset,
  caption,
  tone = "light",
}: {
  asset: MediaAsset;
  caption?: string;
  tone?: "light" | "gold";
}) {
  return (
    <figure className="overflow-hidden border border-border bg-surface shadow-[var(--shadow-md)]">
      <Image
        src={asset.src}
        alt={asset.alt}
        width={asset.width}
        height={asset.height}
        sizes="(max-width: 1024px) 100vw, 48vw"
        className="h-auto w-full"
      />
      {caption ? (
        <figcaption
          className={`px-4 py-2.5 font-signature text-[0.64rem] uppercase tracking-[0.2em] ${
            tone === "gold" ? "text-[color:var(--color-gold)]" : "text-text-secondary"
          }`}
        >
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

/**
 * La création — pourquoi l'écrin existe.
 *
 * Elle n'est pas l'innovation principale : elle est le moteur de l'acquisition
 * active. Pour arrêter l'attention de quelqu'un qui ne cherchait rien, encore
 * faut-il lui donner une raison de regarder.
 *
 * Section essentiellement **visuelle** : la comparaison porte le propos, le
 * texte se contente de la nommer.
 */
export function CreationSection() {
  const { captions } = creation.prodigio;

  return (
    <section className="bg-ivory px-6 py-20 text-wood-black sm:px-10 sm:py-28 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <Reveal>
            <p className="eyebrow text-[color:var(--color-gold)]">{creation.eyebrow}</p>
          </Reveal>
          <Reveal variant="rise" delayMs={70}>
            <h2 className="mt-6 text-balance text-3xl leading-[1.12] sm:text-4xl lg:text-[2.9rem]">
              {creation.title}
            </h2>
          </Reveal>
          <Reveal delayMs={150}>
            <p className="mt-6 text-pretty text-lg leading-relaxed text-text-secondary">
              {creation.subtitle}
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-8">
          {/* Annonce classique — présentée sans mépris : c'est un format, pas une faute. */}
          <Reveal variant="blur">
            <p className="font-signature text-xs uppercase tracking-[0.28em] text-text-secondary">
              {creation.classique.label}
            </p>
            <div className="mt-6 space-y-5">
              <Shot asset={media.ecrinAgence1} />
              <Shot asset={media.ecrinAgence2} />
            </div>
          </Reveal>

          {/* Expérience Prodigio — l'écrin dédié. */}
          <Reveal variant="rise" delayMs={140}>
            <p className="font-signature text-xs uppercase tracking-[0.28em] text-[color:var(--color-gold)]">
              {creation.prodigio.label}
            </p>
            <div className="mt-6 space-y-5">
              <Shot asset={media.ecrinProdigio} caption={captions.ecrinProdigio} tone="gold" />
              <div className="grid grid-cols-2 gap-5">
                <Shot asset={media.ecrinIdentite} caption={captions.ecrinIdentite} tone="gold" />
                <Shot
                  asset={media.ecrinBrochureCover}
                  caption={captions.ecrinBrochureCover}
                  tone="gold"
                />
              </div>
            </div>
          </Reveal>
        </div>

        <Reveal delayMs={120}>
          <ul className="mt-16 flex flex-wrap justify-center gap-x-10 gap-y-3">
            {creation.disciplines.map((d) => (
              <li
                key={d}
                className="font-signature text-xs uppercase tracking-[0.24em] text-text-secondary"
              >
                {d}
              </li>
            ))}
          </ul>
        </Reveal>

        <Reveal variant="rise" delayMs={180}>
          <p className="mt-10 text-balance text-center font-display text-3xl leading-tight sm:text-4xl">
            {creation.punch}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

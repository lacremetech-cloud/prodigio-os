import Image from "next/image";
import { Reveal } from "@/components/ui/reveal";
import { media, type MediaAsset } from "@/lib/media";
import { SectionMarker } from "./section-marker";
import { constat, ecrin } from "./copy";

/** Cadre d'illustration (image complète, jamais recadrée : on lit tous les détails). */
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
 * Section 01 — Le constat / L'écrin. **Comparaison en deux parties** : à gauche,
 * les fiches d'agences classiques (complètes : prix, descriptif, vignettes —
 * marques neutralisées) montrant un format identique partout ; à droite, l'écrin
 * Prodigio (site dédié, carte d'identité, brochure). Aucune image recadrée : on
 * voit vraiment ce qui distingue les deux approches.
 */
export function ConstatSection() {
  const { captions } = ecrin.prodigio;

  return (
    <section className="bg-ivory px-6 py-24 text-wood-black sm:px-10 sm:py-32 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <Reveal>
            <SectionMarker index={constat.index} label={constat.kicker} />
          </Reveal>
          <Reveal variant="rise" delayMs={80}>
            <h2 className="mt-7 text-balance text-3xl leading-[1.12] sm:text-4xl lg:text-[2.9rem]">
              {constat.title}
            </h2>
          </Reveal>
          <Reveal delayMs={180}>
            <p className="mt-7 text-pretty text-lg leading-relaxed text-text-secondary">
              {constat.body}
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-8">
          {/* Partout ailleurs — fiches d'agences classiques */}
          <Reveal variant="blur">
            <p className="font-signature text-xs uppercase tracking-[0.28em] text-text-secondary">
              {ecrin.classique.label}
            </p>
            <h3 className="mt-3 font-display text-2xl text-wood-black sm:text-3xl">
              {ecrin.classique.title}
            </h3>
            <p className="mt-4 max-w-md text-pretty leading-relaxed text-text-secondary">
              {ecrin.classique.text}
            </p>
            <div className="mt-7 space-y-5">
              <Shot asset={media.ecrinAgence1} caption="Agence classique — fiche standard" />
              <Shot asset={media.ecrinAgence2} caption="Autre agence — même présentation" />
            </div>
          </Reveal>

          {/* Avec Prodigio — écrin dédié */}
          <Reveal variant="rise" delayMs={140}>
            <p className="font-signature text-xs uppercase tracking-[0.28em] text-[color:var(--color-gold)]">
              {ecrin.prodigio.label}
            </p>
            <h3 className="mt-3 font-display text-2xl text-wood-black sm:text-3xl">
              {ecrin.prodigio.title}
            </h3>
            <p className="mt-4 max-w-md text-pretty leading-relaxed text-text-secondary">
              {ecrin.prodigio.text}
            </p>
            <div className="mt-7 space-y-5">
              <Shot asset={media.ecrinProdigio} caption={captions.ecrinProdigio} tone="gold" />
              <div className="grid grid-cols-2 gap-5">
                <Shot asset={media.ecrinIdentite} caption={captions.ecrinIdentite} tone="gold" />
                <Shot asset={media.ecrinBrochureCover} caption={captions.ecrinBrochureCover} tone="gold" />
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

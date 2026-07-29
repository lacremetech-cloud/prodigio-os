import Image from "next/image";
import { env } from "@/config";
import { media } from "@/lib/media";

/**
 * Espace de présentation vidéo (VSL).
 *
 * - Si `NEXT_PUBLIC_MANDATE_VSL_URL` est défini : intègre le lecteur (Vimeo/
 *   Wistia) en 16:9.
 * - Sinon : affiche un visuel éditorial premium. Aucun faux lecteur, aucun faux
 *   bouton de lecture, aucune mention « vidéo bientôt disponible ».
 */
export function VslSection() {
  const vslUrl = env.NEXT_PUBLIC_MANDATE_VSL_URL;

  return (
    <section className="bg-ivory px-6 py-20 sm:px-10 sm:py-28 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <p className="eyebrow text-center text-text-secondary">La présentation</p>
        <h2 className="mx-auto mt-5 max-w-2xl text-balance text-center text-3xl leading-[1.15] text-wood-black sm:text-4xl">
          Le Système Prodigio, en quelques minutes.
        </h2>

        <div className="mt-12 overflow-hidden border border-border bg-onyx shadow-[var(--shadow-lg)]">
          <div className="relative aspect-video w-full">
            {vslUrl ? (
              <iframe
                src={vslUrl}
                title="Présentation du Système Prodigio"
                className="absolute inset-0 h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            ) : (
              <Image
                src={media.vsl.src}
                alt={media.vsl.alt}
                fill
                sizes="(max-width: 1024px) 100vw, 1024px"
                className="object-cover"
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

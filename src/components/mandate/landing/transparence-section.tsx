import type { CSSProperties } from "react";
import { Reveal } from "@/components/ui/reveal";
import { transparence } from "./copy";

/**
 * Transparence — le propriétaire suit la commercialisation au lieu de la
 * deviner.
 *
 * L'interface est une **illustration** : aucune valeur n'est affichée, seuls
 * les indicateurs suivis le sont, et la mention le dit explicitement. Montrer
 * des chiffres inventés dans une maquette reviendrait à les faire passer pour
 * des résultats.
 *
 * Elle se présente comme une **démonstration produit** : le panneau arrive très
 * légèrement incliné, se redresse face caméra, puis les niveaux montent l'un
 * après l'autre. Pas de 3D artificielle — une inclinaison de six degrés suffit
 * à donner l'objet.
 */
export function TransparenceSection() {
  return (
    <section className="bg-onyx px-6 py-20 text-ivory sm:px-10 sm:py-24 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <p className="eyebrow text-gold-soft">{transparence.eyebrow}</p>
        </Reveal>
        <Reveal variant="rise" delayMs={70}>
          <h2 className="mt-6 max-w-2xl text-balance text-3xl leading-[1.14] text-ivory sm:text-4xl">
            {transparence.title}
          </h2>
        </Reveal>

        <Reveal delayMs={160}>
          <div className="dash-panel mt-12 overflow-hidden border border-border-dark bg-onyx-soft shadow-[0_40px_90px_-36px_rgba(0,0,0,0.9)]">
            <div className="flex items-center gap-2 border-b border-border-dark px-5 py-3">
              <span aria-hidden="true" className="flex gap-1.5">
                <span className="size-2 rounded-full bg-ivory/20" />
                <span className="size-2 rounded-full bg-ivory/20" />
                <span className="size-2 rounded-full bg-ivory/20" />
              </span>
              <span className="ml-1 font-signature text-[0.6rem] uppercase tracking-[0.2em] text-ivory/50">
                Suivi de commercialisation
              </span>
            </div>

            <ul className="grid gap-px bg-border-dark sm:grid-cols-2 lg:grid-cols-5">
              {transparence.metrics.map((metric, i) => (
                <li key={metric.label} className="bg-onyx-soft px-5 py-8">
                  <span
                    aria-hidden="true"
                    className="block h-px w-8 bg-[color:var(--color-gold-soft)]/60"
                  />
                  {/* Barre de niveau décorative : une hauteur, jamais un chiffre. */}
                  <span
                    aria-hidden="true"
                    className="mt-6 flex h-16 items-end gap-1"
                  >
                    {[0.35, 0.55, 0.45, 0.75, 0.6].map((h, j) => (
                      <span
                        key={j}
                        className="dash-bar w-2 bg-gold-soft/30"
                        style={{
                          height: `${h * (1 - i * 0.12) * 100}%`,
                          // Les niveaux montent colonne après colonne, de la
                          // gauche vers la droite. Assez court pour qu'on ne
                          // l'attende pas.
                          "--dash-delay": `${180 + i * 70 + j * 45}ms`,
                        } as CSSProperties}
                      />
                    ))}
                  </span>
                  <span className="mt-5 block text-sm leading-snug text-text-on-dark-muted">
                    {metric.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delayMs={220}>
          <p className="mt-10 font-display text-2xl leading-snug text-ivory sm:text-3xl">
            {transparence.body}
          </p>
          <p className="mt-5 text-[0.78rem] text-ivory/45">{transparence.disclaimer}</p>
        </Reveal>
      </div>
    </section>
  );
}

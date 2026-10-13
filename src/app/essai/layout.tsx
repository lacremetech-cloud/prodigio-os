import type { Metadata } from "next";
import "../crm/crm.css";

export const metadata: Metadata = {
  title: "Banc d’essai CRM",
  robots: { index: false, follow: false },
};

/**
 * Enveloppe du banc d'essai.
 *
 * Elle charge la MÊME feuille de style que le CRM et pose les mêmes attributs
 * que son enveloppe réelle. Sans cela, les écrans se rendent sans aucun style
 * et toute mesure — hauteur de la première carte, filtres repliés, champ
 * masqué par le clavier — ne mesure rien du tout. C'est l'erreur que la
 * première série de captures a rendue évidente.
 *
 * Elle ne reprend volontairement PAS `CrmShell` : la barre de navigation
 * exigerait une session, et ce n'est pas elle qu'on vérifie ici. Les écrans,
 * eux, sont les vrais.
 */
export default function EssaiLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="crm-root" data-crm-theme="light">
      {children}
    </div>
  );
}

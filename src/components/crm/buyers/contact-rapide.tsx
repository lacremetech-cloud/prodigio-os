"use client";

/**
 * Trois gestes, un doigt : appeler, envoyer un SMS, ouvrir WhatsApp. Sur un
 * téléphone, c'est tout ce qu'un commercial fait d'un lead qui vient
 * d'arriver — et c'est la raison pour laquelle il ouvre le CRM.
 *
 * Vit à part de la boîte de réception depuis que la fiche s'en sert aussi : le
 * même geste doit se faire de la même manière aux deux endroits.
 */

/**
 * Un numéro masqué (rôle sans accès aux coordonnées) n'est jamais composable.
 * On renvoie `null` plutôt que de proposer un bouton qui appellerait « ••• ».
 */
export function numeroAppelable(masque: string | null): string | null {
  if (!masque || masque.includes("masqu")) return null;
  const compact = masque.replace(/[^\d+]/g, "");
  return compact.length >= 6 ? compact : null;
}

export function ContactRapide({ numero, className }: { numero: string; className?: string }) {
  // WhatsApp veut le numéro sans le plus ni les espaces.
  const wa = numero.replace(/\D/g, "");
  const actions: { href: string; label: string; icone: string }[] = [
    { href: `tel:${numero}`, label: "Appeler", icone: "✆" },
    { href: `sms:${numero}`, label: "SMS", icone: "✉︎" },
    { href: `https://wa.me/${wa}`, label: "WhatsApp", icone: "●" },
  ];
  return (
    <div className={`relative z-10 flex flex-wrap gap-1.5 ${className ?? ""}`}>
      {actions.map((a) => (
        <a
          key={a.label}
          href={a.href}
          {...(a.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          onClick={(e) => e.stopPropagation()}
          className="crm-btn crm-btn--sm min-h-[38px]"
          aria-label={`${a.label} au ${numero}`}
        >
          <span aria-hidden>{a.icone}</span> {a.label}
        </a>
      ))}
    </div>
  );
}

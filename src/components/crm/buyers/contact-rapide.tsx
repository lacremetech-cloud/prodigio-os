"use client";

/**
 * Trois gestes, un doigt : appeler, envoyer un SMS, ouvrir WhatsApp. Sur un
 * téléphone, c'est tout ce qu'un commercial fait d'un lead qui vient
 * d'arriver — et c'est la raison pour laquelle il ouvre le CRM.
 *
 * Vit à part de la boîte de réception depuis que la fiche s'en sert aussi : le
 * même geste doit se faire de la même manière aux deux endroits.
 */

export function ContactRapide({
  numero,
  className,
  compact,
}: {
  numero: string;
  className?: string;
  /** En liste, l'icone seule suffit : le libelle reste pour les lecteurs d'ecran. */
  compact?: boolean;
}) {
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
          className={`crm-btn crm-btn--sm ${compact ? "min-h-[34px] px-2.5" : "min-h-[38px]"}`}
          aria-label={`${a.label} au ${numero}`}
          title={a.label}
        >
          <span aria-hidden>{a.icone}</span>
          {compact ? <span className="crm-sr-only">{a.label}</span> : a.label}
        </a>
      ))}
    </div>
  );
}

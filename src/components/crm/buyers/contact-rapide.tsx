"use client";

/**
 * Trois gestes, un doigt : appeler, écrire, ouvrir WhatsApp. Sur un téléphone,
 * c'est tout ce qu'un commercial fait d'un lead qui vient d'arriver — et c'est
 * la raison pour laquelle il ouvre le CRM.
 *
 * Vit à part de la boîte de réception depuis que la fiche s'en sert aussi : le
 * même geste doit se faire de la même manière aux deux endroits.
 *
 * Les pictogrammes étaient des caractères typographiques (`✆`, `✉︎`, `●`) :
 * leur dessin dépendait de la police installée, et le rond noir de WhatsApp
 * n'évoquait rien. Ce sont maintenant de vraies icônes dessinées en SVG,
 * identiques partout.
 *
 * Chaque bouton arrête la propagation du clic : la ligne entière ouvre le
 * dossier, et sans cela appeler quelqu'un depuis la liste ouvrait sa fiche en
 * même temps.
 */

function IconeTelephone() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

function IconeEnveloppe() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden
         stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 6 10-6" />
    </svg>
  );
}

function IconeWhatsApp() {
  // Glyphe officiel, en aplat : il doit rester reconnaissable à 18 px.
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.9 9.9 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.13h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.22 8.22 0 0 1-1.26-4.36c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.19 8.19 0 0 1 2.41 5.82c0 4.54-3.7 8.21-8.24 8.21Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.17.24-.64.8-.79.97-.14.16-.29.18-.54.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.13-.15.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.23.25-.86.85-.86 2.07s.89 2.4 1.01 2.56c.12.17 1.74 2.66 4.22 3.73.59.25 1.05.4 1.41.52.59.19 1.13.16 1.56.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.29Z" />
    </svg>
  );
}

export function ContactRapide({
  numero,
  email,
  className,
  compact,
}: {
  numero: string | null;
  /** Adresse e-mail, si elle est connue et visible pour ce rôle. */
  email?: string | null;
  className?: string;
  /** En liste, l'icône seule suffit : le libellé reste pour les lecteurs d'écran. */
  compact?: boolean;
}) {
  // WhatsApp veut le numéro sans le plus ni les espaces.
  const wa = numero ? numero.replace(/\D/g, "") : "";

  const actions: {
    cle: string;
    href: string;
    label: string;
    icone: React.ReactNode;
    externe?: boolean;
    vert?: boolean;
  }[] = [];
  if (numero) {
    actions.push({
      cle: "tel",
      href: `tel:${numero}`,
      label: `Appeler le ${numero}`,
      icone: <IconeTelephone />,
    });
  }
  if (email) {
    actions.push({
      cle: "mail",
      href: `mailto:${email}`,
      label: `Écrire à ${email}`,
      icone: <IconeEnveloppe />,
    });
  }
  if (numero) {
    actions.push({
      cle: "wa",
      href: `https://wa.me/${wa}`,
      label: `WhatsApp au ${numero}`,
      icone: <IconeWhatsApp />,
      externe: true,
      vert: true,
    });
  }
  if (actions.length === 0) return null;

  return (
    <div className={`crm-contacts ${className ?? ""}`}>
      {actions.map((a) => (
        <a
          key={a.cle}
          href={a.href}
          {...(a.externe ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          /* La ligne entière ouvre le dossier : sans cet arrêt, appeler
             quelqu'un depuis la liste ouvrait sa fiche par-dessus. */
          onClick={(e) => e.stopPropagation()}
          className={`crm-contact ${a.vert ? "crm-contact--whatsapp" : ""}`}
          aria-label={a.label}
          title={a.label}
        >
          {a.icone}
          {compact ? null : (
            <span className="text-[13px] font-semibold">
              {a.cle === "tel" ? "Appeler" : a.cle === "mail" ? "E-mail" : "WhatsApp"}
            </span>
          )}
        </a>
      ))}
    </div>
  );
}

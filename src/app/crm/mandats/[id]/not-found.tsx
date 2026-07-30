import Link from "next/link";

export default function LeadNotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-[14px] border border-[var(--crm-line)] bg-[var(--crm-panel)] px-6 py-16 text-center">
      <span aria-hidden className="text-2xl text-[var(--crm-gold)]">
        ◇
      </span>
      <p className="text-sm font-semibold text-[var(--crm-text)]">Dossier introuvable.</p>
      <p className="text-sm text-[var(--crm-text-dim)]">
        Ce dossier n’existe pas ou n’est pas accessible avec votre rôle.
      </p>
      <Link href="/crm/mandats" className="crm-btn crm-btn--sm">
        Retour aux leads
      </Link>
    </div>
  );
}

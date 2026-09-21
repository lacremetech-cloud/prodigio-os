import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isPreviewDeployment } from "@/config";
import { SectionTitle } from "@/components/crm/ui";
import { BriefFactory } from "@/components/crm/property/brief-factory";
import { canAdminEconomicRules, canDecideMandate } from "@/modules/crm/auth/roles";
import { requireCrmSession } from "@/modules/crm/auth/session";

export const metadata: Metadata = { title: "Créer un bien à partir d'un brief" };

/**
 * Seconde porte d'entrée de la Fabrique : un bien détenu par une organisation
 * partenaire, commercialisé sans mandat Prodigio. La première porte reste la
 * transformation d'un mandat signé (`crm_handoff_create_property`).
 *
 * L'autorisation est vérifiée ici (rendu), dans l'action serveur, et enfin en
 * base (`crm_can_decide()`), qui fait autorité.
 */
export default async function NewPropertyFromBriefPage() {
  const session = await requireCrmSession("/crm/biens/nouveau");
  if (!canDecideMandate(session.roles)) redirect("/crm/biens");

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <SectionTitle
        eyebrow="Fabrique de biens"
        title="Créer un bien à partir d’un brief"
      />

      <p className="crm-wrap text-xs text-[var(--crm-text-faint)]">
        Pour un bien détenu par une organisation partenaire qui le commercialise elle-même :
        ni mandat, ni opportunité, mais une organisation porteuse obligatoire. Un bien issu
        d’un mandat signé se crée depuis son dossier, pas ici.
      </p>

      <BriefFactory
        canCreateOrganization={canAdminEconomicRules(session.roles)}
        previewBlocked={isPreviewDeployment()}
      />

      <p className="crm-wrap text-[11px] text-[var(--crm-text-faint)]">
        <Link href="/crm/biens" className="underline">
          Revenir au portefeuille
        </Link>
      </p>
    </div>
  );
}

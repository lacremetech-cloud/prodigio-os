import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { contactName } from "@/modules/crm/format";
import { maskContactValue } from "@/modules/crm/auth/roles";
import { getMembersMap, memberDisplayName } from "@/modules/crm/data/queries";
import type {
  BuyerInterestRow,
  BuyerProfileRow,
  ContactRow,
  PropertyRow,
  TaskRow,
} from "@/lib/supabase/types";

/**
 * Agenda des VISITES de biens — à ne pas confondre avec l'agenda des
 * rendez-vous d'estimation du CRM Mandats.
 *
 * Ce sont deux métiers différents : une estimation se prend chez un vendeur
 * pour décrocher un mandat, une visite se cale avec un acquéreur sur un bien
 * déjà au catalogue. Elles n'ont ni les mêmes participants, ni les mêmes
 * statuts, ni le même agenda — et un commercial du bien n'a rien à voir dans
 * les estimations. Il atterrissait pourtant sur leur agenda, forcément vide.
 *
 * La visite est lue sur `tasks.kind = 'visite'`, jamais sur l'étape du
 * pipeline : celle-ci avance dès que la visite est passée, ce qui aurait fait
 * disparaître de l'agenda tout ce qui a eu lieu.
 *
 * La RLS fait l'autorisation : cette requête ne voit que les dossiers déjà
 * visibles par l'utilisateur. Les coordonnées sont masquées côté serveur.
 */
export interface Visite {
  taskId: string;
  buyerProfileId: string;
  /** Début de la visite. Une tâche de visite sans échéance n'existe pas. */
  startsAt: string;
  title: string;
  status: string;
  name: string;
  phoneMasked: string | null;
  propertyLabel: string | null;
  city: string | null;
  /** Qui tient la visite. */
  assigneeName: string | null;
}

function propertyLabelOf(p: PropertyRow | undefined): string | null {
  if (!p) return null;
  const nom = (p as { name?: string | null }).name ?? null;
  return nom ?? p.location_city ?? null;
}

export async function listVisites(canViewContacts: boolean): Promise<Visite[]> {
  const supabase = await createSupabaseServerClient();

  const { data: taskRows } = await supabase
    .from("tasks")
    .select("*")
    .eq("kind", "visite")
    .not("buyer_profile_id", "is", null)
    .not("due_at", "is", null)
    .neq("status", "annule")
    .order("due_at", { ascending: true });

  const tasks = (taskRows ?? []) as TaskRow[];
  if (tasks.length === 0) return [];

  const profileIds = [
    ...new Set(tasks.map((t) => t.buyer_profile_id).filter((v): v is string => Boolean(v))),
  ];

  const [{ data: profileRows }, members] = await Promise.all([
    supabase.from("buyer_profiles").select("*").in("id", profileIds),
    getMembersMap(),
  ]);

  const profiles = (profileRows ?? []) as BuyerProfileRow[];
  const profileById = new Map(profiles.map((p) => [p.id, p]));

  const contactIds = [...new Set(profiles.map((p) => p.contact_id))];
  const { data: contactRows } = contactIds.length
    ? await supabase.from("contacts").select("*").in("id", contactIds)
    : { data: [] };
  const contactById = new Map(((contactRows ?? []) as ContactRow[]).map((c) => [c.id, c]));

  // Le bien se lit sur le dernier intérêt du dossier : c'est celui qu'on va
  // visiter. Rien n'est inventé si le dossier n'en a aucun.
  const { data: interestRows } = profileIds.length
    ? await supabase
        .from("buyer_interests")
        .select("*")
        .in("buyer_profile_id", profileIds)
        .order("created_at", { ascending: false })
    : { data: [] };
  const interests = (interestRows ?? []) as BuyerInterestRow[];
  const dernierInteret = new Map<string, BuyerInterestRow>();
  for (const i of interests) {
    if (i.buyer_profile_id && !dernierInteret.has(i.buyer_profile_id)) {
      dernierInteret.set(i.buyer_profile_id, i);
    }
  }
  const propertyIds = [...new Set([...dernierInteret.values()].map((i) => i.property_id))];
  const { data: propertyRows } = propertyIds.length
    ? await supabase.from("properties").select("*").in("id", propertyIds)
    : { data: [] };
  const propertyById = new Map(((propertyRows ?? []) as PropertyRow[]).map((p) => [p.id, p]));

  const visites: Visite[] = [];
  for (const t of tasks) {
    const profileId = t.buyer_profile_id;
    // La RLS a pu masquer le dossier sans masquer la tâche : sans dossier, on
    // n'affiche rien plutôt qu'une ligne anonyme.
    if (!profileId) continue;
    const profile = profileById.get(profileId);
    if (!profile || !t.due_at) continue;

    const contact = contactById.get(profile.contact_id) ?? null;
    const interet = dernierInteret.get(profileId);
    const property = interet ? propertyById.get(interet.property_id) : undefined;

    visites.push({
      taskId: t.id,
      buyerProfileId: profileId,
      startsAt: t.due_at,
      title: t.title,
      status: t.status,
      name: contactName(contact?.first_name ?? null, contact?.last_name ?? null),
      phoneMasked: maskContactValue(contact?.phone ?? null, canViewContacts),
      propertyLabel: propertyLabelOf(property),
      city: property?.location_city ?? null,
      assigneeName: t.assignee_user_id
        ? memberDisplayName(t.assignee_user_id, members)
        : null,
    });
  }
  return visites;
}

/** Visites à venir / passées, à partir d'un instant donné. Fonction pure. */
export function repartirVisites(
  visites: Visite[],
  now: number = Date.now(),
): { aVenir: Visite[]; passees: Visite[] } {
  const aVenir: Visite[] = [];
  const passees: Visite[] = [];
  for (const v of visites) {
    const t = new Date(v.startsAt).getTime();
    if (!Number.isNaN(t) && t >= now) aVenir.push(v);
    else passees.push(v);
  }
  // Les passées se lisent de la plus récente à la plus ancienne : ce qui vient
  // d'avoir lieu est ce qu'on doit débriefer.
  passees.reverse();
  return { aVenir, passees };
}

/** Regroupe des visites par journée, dans l'ordre reçu. Fonction pure. */
export function grouperParJour(visites: Visite[]): { jour: string; visites: Visite[] }[] {
  const groupes: { jour: string; visites: Visite[] }[] = [];
  for (const v of visites) {
    const jour = v.startsAt.slice(0, 10);
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.jour === jour) dernier.visites.push(v);
    else groupes.push({ jour, visites: [v] });
  }
  return groupes;
}

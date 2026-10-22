import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { env, mandateCrmBaseUrl } from "@/config";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadBuyerList, toInboxRow } from "@/modules/buyers/crm/queries";
import { porteLeSignal } from "@/modules/buyers/crm/signaux";
import {
  construireRecap,
  fenetreRecap,
  type DossiersDormants,
  type LeadRecap,
} from "@/modules/buyers/notifications/recap";
import { meriteAlerteImmediate } from "@/modules/buyers/notifications/urgence";

/**
 * CE QUE MAKE VIENT CHERCHER TROIS FOIS PAR JOUR.
 *
 * Make est planifie a 8h30, 13h00 et 17h30 (fuseau de l'organisation, donc le
 * passage a l'heure d'hiver ne decale rien), appelle cette route, et envoie
 * `sujet` / `html` tels quels via le compte Google de l'agence — le meme que
 * l'alerte immediate. Toute la mise en forme est ICI, pour qu'un changement de
 * rendu ne demande pas d'ouvrir Make.
 *
 * `envoyer: false` ⇒ Make ne poste rien. Un creneau sans nouveau lead ne doit
 * pas produire de mail : ce serait la pollution qu'on supprime.
 */

export const dynamic = "force-dynamic";

/** Comparaison a duree constante : une egalite naive fuite la longueur. */
function jetonValide(fourni: string, attendu: string): boolean {
  const a = createHash("sha256").update(fourni).digest();
  const b = createHash("sha256").update(attendu).digest();
  return timingSafeEqual(a, b);
}

function jetonDeLaRequete(request: Request): string {
  const entete = request.headers.get("authorization");
  if (entete) return entete.replace(/^Bearer\s+/i, "").trim();
  return (request.headers.get("x-recap-token") ?? "").trim();
}

export async function GET(request: Request) {
  const attendu = env.RECAP_LEADS_TOKEN;

  /* Pas de jeton configure ⇒ la route n'existe pas. Elle rend des noms et des
     telephones : elle ne doit jamais s'ouvrir par defaut. */
  if (!attendu) {
    return NextResponse.json({ envoyer: false, raison: "non configure" }, { status: 404 });
  }
  if (!jetonValide(jetonDeLaRequete(request), attendu)) {
    return NextResponse.json({ envoyer: false, raison: "refuse" }, { status: 401 });
  }

  const maintenant = new Date();
  const { debut, manuel } = fenetreRecap(maintenant);
  const base = mandateCrmBaseUrl(env);
  const admin = getSupabaseAdminClient();

  const [{ data: interets }, { data: biens }] = await Promise.all([
    admin
      .from("buyer_interests")
      .select(
        "id, created_at, buyer_profile_id, property_id, budget_choice, contact_first_name, contact_last_name, contact_phone_raw",
      )
      .gte("created_at", debut.toISOString())
      .order("created_at", { ascending: true }),
    admin.from("properties").select("id, project_name"),
  ]);

  const nomDuBien = new Map((biens ?? []).map((b) => [b.id, b.project_name]));

  const leads: LeadRecap[] = (interets ?? []).map((i) => {
    const recuLe = new Date(i.created_at as string);
    const nom = `${i.contact_first_name ?? ""} ${i.contact_last_name ?? ""}`.trim();
    return {
      nom: nom || null,
      telephone: i.contact_phone_raw ?? null,
      bien: (i.property_id && nomDuBien.get(i.property_id)) || null,
      budgetChoice: i.budget_choice ?? null,
      recuLe,
      ficheUrl: `${base}/crm/acquereurs${
        i.buyer_profile_id ? `/${encodeURIComponent(i.buyer_profile_id)}` : ""
      }`,
      /* Marque « deja alerte » selon la MEME regle que l'alerte immediate :
         deux calculs separes finiraient par se contredire. */
      dejaAlerte: meriteAlerteImmediate(
        { budgetChoice: i.budget_choice ?? null, recuLe },
        env.ALERTE_LEAD_IMMEDIATE,
      ),
    };
  });

  /* Les deux compteurs du bas viennent du chargeur des ECRANS, pas d'un compte
     maison : c'est ce qui garantit que « 4 en retard » ouvre bien quatre
     dossiers. */
  let dormants: DossiersDormants = {
    enRetard: 0,
    sansAction: 0,
    urlEnRetard: `${base}/crm/acquereurs?signal=en_retard`,
    urlSansAction: `${base}/crm/acquereurs?signal=sans_action`,
  };
  try {
    const bundle = await loadBuyerList(true, admin);
    const lignes = bundle.items.map(toInboxRow);
    dormants = {
      ...dormants,
      enRetard: lignes.filter((r) => porteLeSignal(r, "en_retard")).length,
      sansAction: lignes.filter((r) => porteLeSignal(r, "sans_action")).length,
    };
  } catch {
    /* Le recapitulatif des NOUVEAUX leads est l'essentiel : il part meme si le
       comptage des dossiers qui dorment echoue. Le bandeau disparait, le reste
       arrive. */
    console.error("recapitulatif : echec du comptage des dossiers en souffrance");
  }

  const recap = construireRecap({ leads, dormants, maintenant, depuis: debut });

  return NextResponse.json(
    {
      envoyer: recap.envoyer,
      sujet: recap.sujet,
      html: recap.html,
      nombre: recap.nombre,
      depuis: debut.toISOString(),
      manuel,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

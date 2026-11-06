import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { env, mandateCrmBaseUrl } from "@/config";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadBuyerList, toInboxRow } from "@/modules/buyers/crm/queries";
import { budgetEffectif } from "@/modules/buyers/crm/budget";
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

  const [{ data: interets }, { data: biens }, { data: profils }, { data: destinataires }] =
    await Promise.all([
    admin
      .from("buyer_interests")
      .select(
        "id, created_at, buyer_profile_id, property_id, budget_choice, contact_first_name, contact_last_name, contact_phone_raw",
      )
      .gte("created_at", debut.toISOString())
      .order("created_at", { ascending: true }),
    admin.from("properties").select("id, project_name"),
    /* LES CORRECTIONS DE BUDGET. Sans elles, le récapitulatif de 8 h 30
       annoncerait « 500 000 € – 1 M€ » pour quelqu'un que l'équipe a reclassé
       au-dessus du million la veille — et le mail contredirait l'écran que
       JC et Antoine ont sous les yeux. */
    admin.from("buyer_profiles").select("id, budget_choice_corrige"),
    /* QUI RECOIT LE RECAPITULATIF DE CHAQUE BIEN. Deduit de qui suit le bien,
       jamais d'une liste ecrite dans Make : confier un bien a quelqu'un suffit
       pour qu'il le recoive. Reservee a `service_role`, d'ou l'appel ici et
       nulle part dans les ecrans. */
    admin.rpc("crm_recap_recipients"),
  ]);

  const nomDuBien = new Map((biens ?? []).map((b) => [b.id, b.project_name]));
  const correctionDuProfil = new Map(
    ((profils ?? []) as { id: string; budget_choice_corrige: string | null }[])
      .filter((p) => p.budget_choice_corrige)
      .map((p) => [p.id, p.budget_choice_corrige]),
  );

  /* Le bien voyage A COTE du lead : `LeadRecap` ne porte que son NOM, et deux
     biens pourraient un jour porter le meme. Le regroupement se fait sur
     l'identifiant. */
  const lignes: { propertyId: string | null; lead: LeadRecap }[] = (interets ?? []).map((i) => {
    const recuLe = new Date(i.created_at as string);
    const nom = `${i.contact_first_name ?? ""} ${i.contact_last_name ?? ""}`.trim();
    /* Le budget RETENU, le même que partout ailleurs. */
    const budget = budgetEffectif(
      i.budget_choice ?? null,
      i.buyer_profile_id ? (correctionDuProfil.get(i.buyer_profile_id) ?? null) : null,
    );
    const lead: LeadRecap = {
      nom: nom || null,
      telephone: i.contact_phone_raw ?? null,
      bien: (i.property_id && nomDuBien.get(i.property_id)) || null,
      budgetChoice: budget,
      recuLe,
      ficheUrl: `${base}/crm/acquereurs${
        i.buyer_profile_id ? `/${encodeURIComponent(i.buyer_profile_id)}` : ""
      }`,
      /* Marque « deja alerte » selon la MEME regle que l'alerte immediate :
         deux calculs separes finiraient par se contredire. */
      dejaAlerte: meriteAlerteImmediate(
        { budgetChoice: budget, recuLe },
        env.ALERTE_LEAD_IMMEDIATE,
      ),
    };
    return { propertyId: (i.property_id as string | null) ?? null, lead };
  });

  const leads: LeadRecap[] = lignes.map((l) => l.lead);

  /* Les deux compteurs du bas viennent du chargeur des ECRANS, pas d'un compte
     maison : c'est ce qui garantit que « 4 en retard » ouvre bien quatre
     dossiers. */
  /* Le lien porte le filtre de bien : sans lui, Edouard cliquerait sur
     « 4 en retard » et ouvrirait une liste ou trois de ces quatre dossiers
     sont des dossiers de Cassis, qu'il n'a pas le droit de voir. Un chiffre
     qui n'ouvre pas ce qu'il annonce est pire que pas de chiffre. */
  const urlSignal = (signal: string, propertyId: string | null) =>
    `${base}/crm/acquereurs?${
      propertyId ? `projets=${encodeURIComponent(propertyId)}&` : ""
    }signal=${signal}`;

  let rangs: ReturnType<typeof toInboxRow>[] = [];
  try {
    const bundle = await loadBuyerList(true, admin);
    rangs = bundle.items.map(toInboxRow);
  } catch {
    /* Le recapitulatif des NOUVEAUX leads est l'essentiel : il part meme si le
       comptage des dossiers qui dorment echoue. Le bandeau disparait, le reste
       arrive. */
    console.error("recapitulatif : echec du comptage des dossiers en souffrance");
  }

  const dormantsDe = (propertyId: string | null): DossiersDormants => {
    /* Une personne peut s'interesser a DEUX biens. Si elle dort, elle dort
       pour les deux : `some` et non une appartenance unique. */
    const champ = propertyId
      ? rangs.filter((r) => r.properties.some((b) => b.id === propertyId))
      : rangs;
    return {
      enRetard: champ.filter((r) => porteLeSignal(r, "en_retard")).length,
      sansAction: champ.filter((r) => porteLeSignal(r, "sans_action")).length,
      urlEnRetard: urlSignal("en_retard", propertyId),
      urlSansAction: urlSignal("sans_action", propertyId),
    };
  };

  const dormants = dormantsDe(null);
  const recap = construireRecap({ leads, dormants, maintenant, depuis: debut });

  /* ----------------------------------------------------------------------
     UN RECAPITULATIF PAR BIEN.
 
     L'envoi unique melangeait tout : Edouard n'etait pas destinataire et ne
     voyait aucun lead des 2 Alpes ; Nicolas, qui ne suit que Cassis, lisait
     ceux des 2 Alpes. L'isolation tenait dans le CRM et pas dans ce mail.
 
     Make n'arbitre plus rien : il parcourt `recaps` et envoie chaque entree a
     ses `destinataires`. Confier un bien a quelqu'un suffit pour qu'il le
     recoive — aucun scenario a rouvrir.
     ---------------------------------------------------------------------- */
  const adressesDuBien = new Map<string, string[]>();
  for (const d of destinataires ?? []) {
    if (!d.email) continue;
    const cle = d.property_id ?? "";
    const liste = adressesDuBien.get(cle) ?? [];
    if (!liste.includes(d.email)) liste.push(d.email);
    adressesDuBien.set(cle, liste);
  }

  const leadsDuBien = new Map<string, LeadRecap[]>();
  for (const l of lignes) {
    const cle = l.propertyId ?? "";
    const liste = leadsDuBien.get(cle) ?? [];
    liste.push(l.lead);
    leadsDuBien.set(cle, liste);
  }

  const recaps = [...leadsDuBien.entries()]
    .map(([cle, sesLeads]) => {
      const propertyId = cle || null;
      const nom = propertyId ? (nomDuBien.get(propertyId) ?? null) : null;
      const adresses = adressesDuBien.get(cle) ?? [];
      const r = construireRecap({
        leads: sesLeads,
        dormants: dormantsDe(propertyId),
        maintenant,
        depuis: debut,
        bien: nom,
      });
      return {
        property_id: propertyId,
        bien: nom,
        destinataires: adresses,
        /* Sans destinataire, il n'y a rien a envoyer — et un envoi sans
           destinataire ferait echouer le scenario sur un faux probleme. */
        envoyer: r.envoyer && adresses.length > 0,
        sujet: r.sujet,
        html: r.html,
        nombre: r.nombre,
      };
    })
    .sort((a, b) => (a.bien ?? "").localeCompare(b.bien ?? "", "fr"));

  return NextResponse.json(
    {
      /* LES CHAMPS GLOBAUX RESTENT. Le scenario Make bascule sur `recaps`
         dans un second temps : entre le deploiement et cette bascule, il
         continue de lire ceux-ci et rien ne s'arrete. */
      envoyer: recap.envoyer,
      sujet: recap.sujet,
      html: recap.html,
      nombre: recap.nombre,
      /** Un recapitulatif par bien, avec ses propres destinataires. */
      recaps,
      depuis: debut.toISOString(),
      manuel,
      /* La politique d'alerte immediate, en clair dans la reponse. Sans elle,
         savoir si la bascule `urgents` a bien pris effet exige d'attendre un
         lead hors horaires : on ne peut pas verifier une mise en service a la
         demande. Visible seulement du porteur du jeton. */
      politique: env.ALERTE_LEAD_IMMEDIATE,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

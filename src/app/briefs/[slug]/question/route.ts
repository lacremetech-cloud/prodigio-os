import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { briefParSlug } from "@/modules/briefs/registre";
import { jetonValide, nomDuCookie } from "@/modules/briefs/code";
import { LONGUEUR_MAX_QUESTION, repondreSurLeBien } from "@/modules/briefs/assistant";

export const dynamic = "force-dynamic";

/**
 * POSER UNE QUESTION SUR LE BIEN.
 *
 * DERRIÈRE LE MÊME CODE QUE LE DOCUMENT. Sans cette vérification, cette route
 * serait un oracle ouvert sur un dossier confidentiel : il suffirait de
 * demander « combien de chambres ? » pour obtenir ce que le code protège.
 * C'est le genre de porte dérobée qu'on ouvre sans y penser en ajoutant une
 * API à côté d'une page protégée.
 */

/* Quinze questions par quart d'heure et par lecteur : de quoi préparer un
   tournage, pas de quoi faire tourner une facture.

   LIMITE ASSUMÉE : ce compteur vit dans la mémoire de l'instance. En
   serverless, plusieurs instances comptent chacune de leur côté, et un
   redémarrage remet à zéro. Il décourage l'emballement d'un onglet ouvert, il
   n'arrête pas quelqu'un de déterminé. Le jour où ça compte, il faudra un
   compteur partagé. */
const PLAFOND = 15;
const FENETRE_MS = 15 * 60 * 1000;
const compteur = new Map<string, number[]>();

function tropDeQuestions(cle: string): boolean {
  const maintenant = Date.now();
  const recentes = (compteur.get(cle) ?? []).filter((t) => maintenant - t < FENETRE_MS);
  if (recentes.length >= PLAFOND) {
    compteur.set(cle, recentes);
    return true;
  }
  recentes.push(maintenant);
  compteur.set(cle, recentes);
  /* La table ne doit pas grossir indéfiniment sur une instance qui vit
     longtemps : au-delà de mille lecteurs suivis, on repart de zéro. */
  if (compteur.size > 1_000) compteur.clear();
  return false;
}

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const brief = briefParSlug(slug);

  const magasin = await cookies();
  const jeton = brief ? magasin.get(nomDuCookie(brief.slug))?.value : undefined;
  if (!brief || !jetonValide(brief.slug, brief.empreinteDuCode, jeton)) {
    return NextResponse.json({ erreur: "Accès refusé." }, { status: 403 });
  }

  /* Le jeton identifie le lecteur mieux qu'une adresse IP — il est propre au
     navigateur qui a saisi le code — et on n'en garde que les douze premiers
     caractères, de quoi compter sans conserver le jeton entier. */
  if (tropDeQuestions(`${brief.slug}:${(jeton ?? "").slice(0, 12)}`)) {
    return NextResponse.json(
      { erreur: "Beaucoup de questions d’un coup. Reprenez dans quelques minutes." },
      { status: 429 },
    );
  }

  let question = "";
  try {
    const corps = (await req.json()) as unknown;
    if (typeof corps === "object" && corps !== null && "question" in corps) {
      question = String((corps as { question: unknown }).question ?? "");
    }
  } catch {
    return NextResponse.json({ erreur: "Requête illisible." }, { status: 400 });
  }

  if (question.trim().length === 0) {
    return NextResponse.json({ erreur: "Posez une question." }, { status: 400 });
  }
  if (question.length > LONGUEUR_MAX_QUESTION) {
    return NextResponse.json(
      { erreur: `Question trop longue (${LONGUEUR_MAX_QUESTION} caractères au maximum).` },
      { status: 400 },
    );
  }

  const r = await repondreSurLeBien(question, brief.matiere);
  if (!r.ok) {
    /* Chaque cause a sa phrase : dire « réessayez » à quelqu'un pour qui
       réessayer ne changera rien est la pire des réponses. */
    const phrases: Record<typeof r.motif, string> = {
      non_configure: "L’assistant n’est pas activé sur ce dossier.",
      vide: "Posez une question.",
      refus: "Je ne peux pas répondre à cette question.",
      indisponible: "L’assistant est momentanément indisponible. Réessayez dans un instant.",
    };
    return NextResponse.json({ erreur: phrases[r.motif] }, { status: 503 });
  }

  return NextResponse.json(
    { reponse: r.reponse },
    { headers: { "cache-control": "private, no-store" } },
  );
}

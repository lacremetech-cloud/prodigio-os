"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  codeCorrespond,
  jetonDeLecture,
  nomDuCookie,
  normaliserLaSaisie,
} from "@/modules/briefs/code";
import { briefParSlug } from "@/modules/briefs/registre";

/** Trente jours : la durée d'un tournage et de son montage, pas davantage. */
const DUREE_DU_JETON = 60 * 60 * 24 * 30;

/**
 * OUVRIR UN BRIEF AVEC SON CODE.
 *
 * Une seule réponse en cas d'échec, quelle qu'en soit la cause — brief
 * inconnu, code faux, saisie vide. Distinguer « ce bien n'existe pas » de
 * « le code est faux » dirait à un curieux quels biens existent.
 */
export async function ouvrirLeBriefAction(formData: FormData): Promise<void> {
  const slug = String(formData.get("slug") ?? "");
  const saisie = normaliserLaSaisie(String(formData.get("code") ?? ""));
  const brief = briefParSlug(slug);

  /* Un délai sur l'échec, et sur lui seul. Le code fait 32^12 combinaisons,
     donc la force brute est déjà hors de portée ; ce délai rend simplement
     l'essai en rafale inconfortable, sans ralentir qui tape juste. */
  if (!brief || saisie.length === 0 || !codeCorrespond(saisie, brief.empreinteDuCode)) {
    await new Promise((r) => setTimeout(r, 600));
    redirect(`/briefs/${encodeURIComponent(slug)}?erreur=1`);
  }

  const magasin = await cookies();
  magasin.set(nomDuCookie(brief.slug), jetonDeLecture(brief.slug, brief.empreinteDuCode), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/briefs",
    maxAge: DUREE_DU_JETON,
  });
  redirect(`/briefs/${brief.slug}/document`);
}

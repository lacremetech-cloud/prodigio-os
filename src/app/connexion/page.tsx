import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { LoginForm } from "@/components/crm/login-form";

export const metadata: Metadata = {
  /* `absolute` : le gabarit du site ajoute « — Prodigio OS » a tout titre, ce
     qui donnait « Connexion | Prodigio OS — Prodigio OS ». */
  title: { absolute: "Connexion | Prodigio OS" },
  robots: { index: false, follow: false },
};

/**
 * Entrée unique de Prodigio OS.
 *
 * Elle s'appelait « CRM Mandats » alors que la plateforme couvre désormais les
 * mandats ET les biens : la porte d'entrée n'annonçait qu'un des deux métiers.
 *
 * Connexion COMMUNE à tous les rôles : on ne demande à personne de déclarer qui
 * il est avant de s'authentifier. Le rôle est connu après, côté serveur, et
 * c'est lui qui décide où l'on arrive. Demander le rôle avant la connexion
 * donnerait au passage un indice gratuit à qui essaie des mots de passe.
 */
export default async function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const params = await searchParams;
  const redirectTo =
    typeof params.redirect === "string" && params.redirect.startsWith("/crm")
      ? params.redirect
      : "/crm";
  const accessError = params.error === "acces";

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-[#151A23] px-6 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-7 flex flex-col items-center text-center">
          <Image
            src="/images/brand/prodigio-blanc.png"
            alt="Prodigio"
            width={400}
            height={92}
            priority
            className="h-8 w-auto"
          />
          {/* La police sans de l'application : une regle globale `h1,h2,h3` impose
              sinon la serif d'affichage du site public, qui n'est pas celle du
              CRM dans lequel on entre. */}
          <h1
            className="mt-7 text-[22px] font-semibold text-white"
            style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}
          >
            Connexion à Prodigio OS
          </h1>
          <p className="mt-1.5 text-sm text-white/65">Accédez à votre espace de travail.</p>
        </div>

        <div className="rounded-[10px] bg-white p-7 shadow-[0_18px_48px_rgba(0,0,0,0.35)]">
          <LoginForm redirectTo={redirectTo} accessError={accessError} />
        </div>

        {/*
         * « Mot de passe oublié ? » est VOLONTAIREMENT absent : aucun parcours
         * de récupération n'existe dans cette application. Un lien qui mène à
         * une impasse coûte plus cher qu'un lien manquant — la personne essaie,
         * échoue, et appelle quand même.
         */}
        <p className="mt-6 text-center text-xs text-white/55">
          <Link href="/" className="underline-offset-4 hover:text-white/80 hover:underline">
            Retour au site public
          </Link>
        </p>
      </div>
    </main>
  );
}

"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOutAction } from "@/modules/crm/auth/actions";
import { roleLabels } from "@/modules/crm/labels";
import { isCommercialOnly, type CrmRole } from "@/modules/crm/auth/roles";
import { Avatar } from "@/components/crm/ui";
import { ThemeProvider } from "@/components/crm/theme/theme-provider";
import {
  resolveTheme,
  themeNoFlashScript,
  type ThemePreference,
} from "@/components/crm/theme/theme";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
}

export type Univers = "mandats" | "biens";

/**
 * Le CRM couvre deux metiers : les mandats (vendeurs) et les biens avec leurs
 * acquereurs. Un menu unique melangeait les deux, et on cherchait « Acquereurs »
 * du cote des mandats. Chaque univers a donc son menu et sa couleur, et une
 * bascule en haut dit en permanence ou l'on se trouve.
 */
const UNIVERS: Record<Univers, { label: string; accueil: string; items: NavItem[] }> = {
  mandats: {
    label: "Mandats",
    accueil: "/crm/mandats",
    items: [
      { href: "/crm/mandats", label: "Leads", icon: "☰" },
      { href: "/crm/mandats/pipeline", label: "Pipeline", icon: "▤" },
    ],
  },
  biens: {
    label: "Biens",
    accueil: "/crm/biens",
    items: [
      { href: "/crm/biens", label: "Fabrique de biens", icon: "◆" },
      { href: "/crm/acquereurs", label: "Acquéreurs", icon: "◉" },
      { href: "/crm/visites", label: "Visites", icon: "◷" },
    ],
  },
};

/** Ordre d'affichage de la bascule. */
const ORDRE_UNIVERS: Univers[] = ["mandats", "biens"];

/** Entrees communes aux deux univers : elles ne changent pas de couleur. */
const NAV_HAUT: NavItem[] = [
  { href: "/crm", label: "Vue d’ensemble", icon: "◈", exact: true },
];
const NAV_BAS: NavItem[] = [
  { href: "/crm/rendez-vous", label: "Agenda", icon: "◷" },
  { href: "/crm/taches", label: "Tâches", icon: "✓" },
  { href: "/crm/communications", label: "Communications", icon: "✉" },
  { href: "/crm/parametres", label: "Paramètres", icon: "⚙" },
];

/**
 * Menu du commercial : ses leads, son agenda, ses tâches. Rien d'autre.
 *
 * Il vend un bien dont le mandat est déjà réglé de son côté. La fabrique de
 * biens, les mandats, les communications et les paramètres d'équipe ne le
 * concernent pas — et la base les lui refuse de toute façon. Lui montrer ces
 * portes, c'est les lui promettre fermées.
 */
const NAV_COMMERCIAL: NavItem[] = [
  { href: "/crm", label: "Mon tableau de bord", icon: "◈", exact: true },
  { href: "/crm/acquereurs", label: "Mes leads", icon: "◉" },
  // Les VISITES, pas les estimations : « Agenda » envoyait vers l'agenda des
  // rendez-vous d'estimation du CRM Mandats, dont il ne voit rien.
  { href: "/crm/visites", label: "Visites", icon: "◷" },
  { href: "/crm/taches", label: "Tâches", icon: "✓" },
];

/**
 * L'univers se deduit de l'adresse, pas d'un etat memorise : un lien profond
 * vers une fiche acquereur ouvre l'interface du bon cote, et un rechargement
 * ne perd rien.
 */
export function universDeLaRoute(pathname: string): Univers {
  if (
    pathname.startsWith("/crm/biens") ||
    pathname.startsWith("/crm/acquereurs") ||
    pathname.startsWith("/crm/visites")
  ) {
    return "biens";
  }
  return "mandats";
}

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  // Le pipeline est une sous-route de /crm/mandats : on l'exclut pour que les
  // deux entrees ne s'allument pas ensemble.
  if (item.href === "/crm/mandats") {
    return (
      (pathname === "/crm/mandats" || pathname.startsWith("/crm/mandats/")) &&
      !pathname.startsWith("/crm/mandats/pipeline")
    );
  }
  // « Acquereurs » couvre aussi son pipeline et ses fiches.
  if (item.href === "/crm/acquereurs") {
    return pathname === "/crm/acquereurs" || pathname.startsWith("/crm/acquereurs/");
  }
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function Lien({
  item,
  actif,
  onNavigate,
}: {
  item: NavItem;
  actif: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={actif ? "page" : undefined}
      className="crm-nav-item"
    >
      <span aria-hidden className="crm-nav-item__icon">
        {item.icon}
      </span>
      {item.label}
    </Link>
  );
}

function Bascule({ actif, onNavigate }: { actif: Univers; onNavigate?: () => void }) {
  return (
    <div className="crm-bascule" role="group" aria-label="Univers de travail">
      {ORDRE_UNIVERS.map((cle) => (
        <Link
          key={cle}
          href={UNIVERS[cle].accueil}
          onClick={onNavigate}
          aria-current={cle === actif}
          className="crm-bascule__seg"
        >
          {UNIVERS[cle].label}
        </Link>
      ))}
    </div>
  );
}

function NavLinks({
  onNavigate,
  commercial,
}: {
  onNavigate?: () => void;
  commercial: boolean;
}) {
  const pathname = usePathname();
  const actif = universDeLaRoute(pathname);
  const univers = UNIVERS[actif];

  if (commercial) {
    return (
      <nav className="flex flex-col gap-1" aria-label="Navigation">
        {NAV_COMMERCIAL.map((item) => (
          <Lien key={item.href} item={item} actif={isActive(pathname, item)} onNavigate={onNavigate} />
        ))}
      </nav>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <nav className="flex flex-col gap-1">
        {NAV_HAUT.map((item) => (
          <Lien key={item.href} item={item} actif={isActive(pathname, item)} onNavigate={onNavigate} />
        ))}
      </nav>

      <Bascule actif={actif} onNavigate={onNavigate} />

      <nav className="flex flex-col gap-1" aria-label={univers.label}>
        {univers.items.map((item) => (
          <Lien key={item.href} item={item} actif={isActive(pathname, item)} onNavigate={onNavigate} />
        ))}
      </nav>

      <nav className="flex flex-col gap-1 border-t border-[var(--crm-line-soft)] pt-4">
        {NAV_BAS.map((item) => (
          <Lien key={item.href} item={item} actif={isActive(pathname, item)} onNavigate={onNavigate} />
        ))}
      </nav>
    </div>
  );
}

/**
 * La marque, sans monogramme.
 *
 * Le « P » dans son carre noir doublait le mot qu'il abrege, a deux
 * centimetres de lui. Le nom seul, pose, suffit — et la ligne du dessous dit
 * ou l'on est, ce que le monogramme ne disait pas.
 */
function Brand() {
  return (
    <Link href="/crm" className="block">
      {/*
        Le logo de marque, en blanc : il ne vit que sur la barre laterale
        anthracite, donc une seule version suffit. Sur une surface claire il
        serait invisible — s'il doit un jour sortir d'ici, il faudra la
        variante sombre.

        Pose en `Image` avec ses dimensions reelles : sans elles, la page
        saute au chargement le temps que le navigateur decouvre la hauteur.
      */}
      <Image
        src="/images/brand/prodigio-blanc.png"
        alt="Prodigio"
        width={400}
        height={92}
        className="h-auto w-[164px]"
        priority
      />
      {/*
        Le logo porte deja sa signature (« immobilier d'exception »). Posee
        juste dessous dans la meme graisse, « Espace commercial » se lisait
        comme une deuxieme signature, et les deux se brouillaient. Un filet et
        de l'air la detachent : elle ne dit pas la meme chose — l'une est la
        marque, l'autre l'endroit du produit ou l'on se trouve.
      */}
      <span className="mt-3 block border-t border-white/10 pt-2.5 text-[9.5px] uppercase tracking-[0.26em] text-[var(--crm-sb-faible)]">
        Espace commercial
      </span>
    </Link>
  );
}

function GlobalSearch({ commercial }: { commercial: boolean }) {
  const router = useRouter();
  // La recherche menait toujours aux leads vendeurs : pour un commercial,
  // c'etait une porte sur une page vide.
  const base = commercial ? "/crm/acquereurs" : "/crm/mandats";
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const value = new FormData(e.currentTarget).get("q");
        const q = typeof value === "string" ? value.trim() : "";
        router.push(q ? `${base}?q=${encodeURIComponent(q)}` : base);
      }}
      className="hidden min-w-0 flex-1 sm:block"
    >
      <input
        name="q"
        type="search"
        placeholder={
          commercial
            ? "Rechercher un acquéreur (nom, e-mail, téléphone…)"
            : "Rechercher un lead (nom, e-mail, ville…)"
        }
        aria-label="Recherche globale"
        className="crm-input max-w-md"
      />
    </form>
  );
}

export function CrmShell({
  email,
  roles,
  photo,
  themePreference,
  children,
}: {
  email: string | null;
  roles: string[];
  /** Photo de profil du membre connecte, si sa fiche en porte une. */
  photo?: string | null;
  themePreference: ThemePreference;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  // L'univers actif teinte toute la coquille via `--crm-univers`.
  const commercial = isCommercialOnly(roles);
  // Le commercial ne quitte jamais l'univers des biens : la bascule n'existe
  // pas pour lui, et l'accent doit rester le sien.
  const universRoute = universDeLaRoute(usePathname());
  const univers = commercial ? "biens" : universRoute;
  const rootRef = useRef<HTMLDivElement>(null);
  const primary = roles.find((r) => r in roleLabels) as CrmRole | undefined;
  const name = email ?? "Utilisateur";
  // Thème rendu côté serveur (le script en ligne corrige « système » avant paint).
  const ssrTheme = resolveTheme(themePreference, null);

  return (
    <div
      ref={rootRef}
      className="crm-root flex min-h-dvh"
      data-crm-theme={ssrTheme}
      data-crm-univers={univers}
      style={{ colorScheme: ssrTheme }}
      suppressHydrationWarning
    >
      {/* Anti-flash : applique le thème (dont « système ») avant le premier paint. */}
      <script dangerouslySetInnerHTML={{ __html: themeNoFlashScript() }} />
      <ThemeProvider initialPreference={themePreference} rootRef={rootRef}>
      {/* Sidebar desktop */}
      {/*
        Hauteur de fenetre exactement, jamais plus : la navigation defile si
        elle deborde, le profil reste colle en bas. Sans ça, sur un portable
        13 pouces a 100 %, « Deconnexion » passait sous le pli — visible
        seulement en faisant defiler une barre qu'on ne pense pas a faire
        defiler.
      */}
      <aside className="crm-sidebar sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col p-4 lg:flex">
        <div className="px-2 py-2">
          <Brand />
        </div>
        <div className="crm-scroll mt-6 min-h-0 flex-1 overflow-y-auto">
          <NavLinks commercial={commercial} />
        </div>
        <UserCard name={name} photo={photo} roleLabel={primary ? roleLabels[primary] : "Sans rôle"} />
      </aside>

      {/* Drawer mobile */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <aside className="crm-sidebar absolute left-0 top-0 flex h-full w-[268px] flex-col p-4 crm-fade-in">
            <div className="px-2 py-2">
              <Brand />
            </div>
            <div className="crm-scroll mt-6 min-h-0 flex-1 overflow-y-auto">
              <NavLinks commercial={commercial} onNavigate={() => setOpen(false)} />
            </div>
            <UserCard name={name} photo={photo} roleLabel={primary ? roleLabels[primary] : "Sans rôle"} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--crm-line)] bg-[var(--crm-topbar)] px-4 backdrop-blur">
          <button
            aria-label="Ouvrir le menu"
            className="crm-btn crm-btn--ghost crm-btn--sm lg:hidden"
            onClick={() => setOpen(true)}
          >
            ☰
          </button>
          <GlobalSearch commercial={commercial} />
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              aria-label="Actualiser"
              title="Actualiser"
              onClick={() => router.refresh()}
              className="crm-btn crm-btn--ghost crm-btn--sm"
            >
              ↻ <span className="hidden sm:inline">Actualiser</span>
            </button>
            {/* Pas de portrait ici : l'identite vit en bas de la barre
                laterale, avec la deconnexion. En haut, elle ne servait a rien
                qu'a repeter ce qui est deja ecrit a l'ecran d'a cote. */}
          </div>
        </header>

        <main className="crm-scroll min-w-0 flex-1 overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </main>
      </div>
      </ThemeProvider>
    </div>
  );
}

/**
 * Pied de la barre laterale : qui est connecte, et comment en sortir.
 *
 * La deconnexion siegeait en haut a droite, a deux centimetres
 * d'« Actualiser » — deux boutons de meme poids visuel dont l'un recharge la
 * page et l'autre met dehors. Elle descend sous l'identite, la ou on la
 * cherche, et le haut ne garde que le profil.
 */
function UserCard({
  name,
  roleLabel,
  photo,
}: {
  name: string;
  roleLabel: string;
  photo?: string | null;
}) {
  return (
    <div className="crm-sidebar__profil mt-4 flex shrink-0 flex-col gap-2 rounded-[10px] px-3 py-2.5">
      <div className="flex items-center gap-3">
        <Avatar name={name} size={32} photo={photo} />
        <div className="min-w-0">
          <p className="crm-ellipsis text-xs font-medium text-[var(--crm-sb-texte)]" title={name}>
            {name}
          </p>
          <p className="crm-ellipsis text-[11px] text-[var(--crm-sb-faible)]">{roleLabel}</p>
        </div>
      </div>
      <form action={signOutAction}>
        <button type="submit" className="crm-sidebar__sortie w-full">
          Déconnexion
        </button>
      </form>
    </div>
  );
}

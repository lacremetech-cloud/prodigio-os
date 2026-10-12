"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOutAction } from "@/modules/crm/auth/actions";
import { roleLabels } from "@/modules/crm/labels";
import type { CrmRole } from "@/modules/crm/auth/roles";
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
 * L'univers se deduit de l'adresse, pas d'un etat memorise : un lien profond
 * vers une fiche acquereur ouvre l'interface du bon cote, et un rechargement
 * ne perd rien.
 */
export function universDeLaRoute(pathname: string): Univers {
  if (pathname.startsWith("/crm/biens") || pathname.startsWith("/crm/acquereurs")) {
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

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const actif = universDeLaRoute(pathname);
  const univers = UNIVERS[actif];
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

function Brand() {
  return (
    <Link href="/crm" className="flex items-center gap-2.5">
      <span className="crm-brand-badge">
        P
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold text-[var(--crm-text)]">Prodigio</span>
        <span className="block text-[10px] uppercase tracking-[0.2em] text-[var(--crm-text-faint)]">
          Mandats &amp; Biens
        </span>
      </span>
    </Link>
  );
}

function GlobalSearch() {
  const router = useRouter();
  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const value = new FormData(e.currentTarget).get("q");
        const q = typeof value === "string" ? value.trim() : "";
        router.push(q ? `/crm/mandats?q=${encodeURIComponent(q)}` : "/crm/mandats");
      }}
      className="hidden min-w-0 flex-1 sm:block"
    >
      <input
        name="q"
        type="search"
        placeholder="Rechercher un lead (nom, e-mail, ville…)"
        aria-label="Recherche globale"
        className="crm-input max-w-md"
      />
    </form>
  );
}

export function CrmShell({
  email,
  roles,
  themePreference,
  children,
}: {
  email: string | null;
  roles: string[];
  themePreference: ThemePreference;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  // L'univers actif teinte toute la coquille via `--crm-univers`.
  const univers = universDeLaRoute(usePathname());
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
      <aside className="hidden w-[248px] shrink-0 flex-col border-r border-[var(--crm-line)] bg-[var(--crm-panel)] p-4 lg:flex">
        <div className="px-2 py-2">
          <Brand />
        </div>
        <div className="mt-6 flex-1">
          <NavLinks />
        </div>
        <UserCard name={name} roleLabel={primary ? roleLabels[primary] : "Sans rôle"} />
      </aside>

      {/* Drawer mobile */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Fermer le menu"
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[268px] flex-col border-r border-[var(--crm-line)] bg-[var(--crm-panel)] p-4 crm-fade-in">
            <div className="px-2 py-2">
              <Brand />
            </div>
            <div className="mt-6 flex-1">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <UserCard name={name} roleLabel={primary ? roleLabels[primary] : "Sans rôle"} />
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
          <GlobalSearch />
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
            <div className="hidden items-center gap-2 sm:flex">
              <Avatar name={name} size={28} />
            </div>
            <form action={signOutAction}>
              <button type="submit" className="crm-btn crm-btn--ghost crm-btn--sm">
                Déconnexion
              </button>
            </form>
          </div>
        </header>

        <main className="crm-scroll min-w-0 flex-1 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
      </ThemeProvider>
    </div>
  );
}

function UserCard({ name, roleLabel }: { name: string; roleLabel: string }) {
  return (
    <div className="mt-4 flex items-center gap-3 rounded-[10px] border border-[var(--crm-line)] bg-[var(--crm-panel-2)] px-3 py-2.5">
      <Avatar name={name} size={32} />
      <div className="min-w-0">
        <p className="crm-ellipsis text-xs font-medium text-[var(--crm-text)]" title={name}>{name}</p>
        <p className="crm-ellipsis text-[11px] text-[var(--crm-text-faint)]">{roleLabel}</p>
      </div>
    </div>
  );
}

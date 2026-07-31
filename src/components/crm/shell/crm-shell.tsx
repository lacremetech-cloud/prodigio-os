"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOutAction } from "@/modules/crm/auth/actions";
import { roleLabels } from "@/modules/crm/labels";
import type { CrmRole } from "@/modules/crm/auth/roles";
import { Avatar } from "@/components/crm/ui";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { href: "/crm", label: "Vue d’ensemble", icon: "◈", exact: true },
  { href: "/crm/mandats", label: "Leads Mandats", icon: "☰" },
  { href: "/crm/mandats/pipeline", label: "Pipeline", icon: "▤" },
  { href: "/crm/rendez-vous", label: "Agenda", icon: "◷" },
  { href: "/crm/taches", label: "Tâches", icon: "✓" },
  { href: "/crm/parametres", label: "Paramètres", icon: "⚙" },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  if (item.href === "/crm/mandats") {
    return pathname === "/crm/mandats" || pathname.startsWith("/crm/mandats/");
  }
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((item) => {
        const active = isActive(pathname, item);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm transition-colors ${
              active
                ? "bg-[var(--crm-elevated)] text-[var(--crm-text)]"
                : "text-[var(--crm-text-dim)] hover:bg-[var(--crm-panel-2)] hover:text-[var(--crm-text)]"
            }`}
          >
            <span
              aria-hidden
              className={`text-[15px] ${active ? "text-[var(--crm-gold)]" : "text-[var(--crm-text-faint)]"}`}
            >
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link href="/crm" className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[rgba(203,180,136,0.4)] bg-[rgba(203,180,136,0.12)] text-sm font-semibold text-[var(--crm-gold)]">
        P
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold text-[var(--crm-text)]">Prodigio</span>
        <span className="block text-[10px] uppercase tracking-[0.2em] text-[var(--crm-text-faint)]">
          CRM Mandats
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
  children,
}: {
  email: string | null;
  roles: string[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const primary = roles.find((r) => r in roleLabels) as CrmRole | undefined;
  const name = email ?? "Utilisateur";

  return (
    <div className="crm-root flex min-h-dvh">
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
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--crm-line)] bg-[rgba(11,11,13,0.85)] px-4 backdrop-blur">
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

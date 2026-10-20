"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Navigation du studio. Une seule barre d'onglets, réutilisant `crm-tabs` du
 * design system : cohérence visuelle et clavier avec le reste du CRM.
 *
 * Les sections réservées ne sont pas rendues du tout lorsque le rôle ne les
 * autorise pas — un onglet visible mais refusé serait une fausse promesse.
 */
export interface StudioSection {
  href: string;
  label: string;
  icon: string;
}

export function StudioNav({ sections }: { sections: StudioSection[] }) {
  const pathname = usePathname();

  return (
    <div className="crm-scroll -mx-1 overflow-x-auto px-1">
      <nav className="crm-tabs flex-nowrap" aria-label="Sections du studio de communications">
        {sections.map((section) => {
          const active =
            section.href === "/crm/communications"
              ? pathname === section.href
              : pathname === section.href || pathname.startsWith(section.href + "/");
          return (
            <Link
              key={section.href}
              href={section.href}
              aria-current={active ? "page" : undefined}
              className={`crm-tab whitespace-nowrap ${active ? "crm-tab--active" : ""}`}
            >
              <span aria-hidden className="mr-1.5">
                {section.icon}
              </span>
              {section.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

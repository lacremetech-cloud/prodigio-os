"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { LeadSort, QuickFilter } from "@/modules/crm/leads";

const QUICK_FILTERS: { value: QuickFilter; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "nouveau", label: "Nouveau" },
  { value: "non_affecte", label: "Non affecté" },
  { value: "fort_potentiel", label: "Fort potentiel" },
  { value: "a_rappeler", label: "À rappeler" },
  { value: "en_retard", label: "En retard" },
];

const SORTS: { value: LeadSort; label: string }[] = [
  { value: "recent", label: "Plus récents" },
  { value: "ancien", label: "Plus anciens" },
  { value: "priorite", label: "Priorité" },
  { value: "compatibilite", label: "Compatibilité" },
  { value: "maturite", label: "Maturité" },
];

export function FilterBar({
  quick,
  sort,
  search,
  counts,
}: {
  quick: QuickFilter;
  sort: LeadSort;
  search: string;
  counts: Record<QuickFilter, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(search);

  const push = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  };

  return (
    <div className="flex flex-col gap-3">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          push({ q: q.trim() || null });
        }}
        className="flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          placeholder="Rechercher un lead (nom, e-mail, téléphone, ville…)"
          aria-label="Rechercher"
          className="crm-input"
        />
        <button type="submit" className="crm-btn crm-btn--sm shrink-0">
          Rechercher
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_FILTERS.map((f) => {
            const active = quick === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => push({ filter: f.value === "tous" ? null : f.value })}
                className={`crm-chip ${active ? "crm-chip--gold" : ""} cursor-pointer`}
                aria-pressed={active}
              >
                {f.label}
                <span className="tabular-nums opacity-70">{counts[f.value]}</span>
              </button>
            );
          })}
        </div>
        <label className="ml-auto flex items-center gap-2 text-xs text-[var(--crm-text-faint)]">
          Trier
          <select
            className="crm-select text-xs"
            value={sort}
            onChange={(e) => push({ sort: e.target.value })}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

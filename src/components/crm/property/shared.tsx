"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/modules/properties/factory/actions";

/**
 * Primitives client partagées du cockpit Fabrique de biens : hook d'action
 * (transition + rafraîchissement), erreurs accessibles, indicateur « enregistré »
 * et champs de saisie. Aucune logique métier — l'autorité reste côté serveur /
 * base. Les messages d'erreur sont neutres (jamais techniques).
 */

export function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const run = (fn: () => Promise<ActionResult>, onOk?: (res: ActionResult) => void) => {
    setError(null);
    setDone(false);
    start(async () => {
      const res = await fn();
      if (res.ok) {
        setDone(true);
        onOk?.(res);
        router.refresh();
      } else {
        setError(res.error ?? "Une erreur est survenue.");
      }
    });
  };
  return { pending, error, done, run };
}

export function FieldError({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="crm-wrap text-xs text-[var(--crm-danger)]">
      {error}
    </p>
  );
}

export function Saved({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="text-xs crm-aging--frais">Enregistré</span>;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  inputMode?: "text" | "decimal" | "numeric";
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="crm-label">{label}</span>
      <input
        className="crm-input"
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="crm-label">{label}</span>
      <textarea
        className="crm-textarea"
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

/** Parse un nombre depuis une saisie libre FR (« 1 250,5 » → 1250.5). null si vide, undefined si invalide. */
export function parseNumber(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const normalized = trimmed.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(normalized)) return undefined;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : undefined;
}

export function numToField(n: number | null | undefined): string {
  return n == null ? "" : String(n);
}

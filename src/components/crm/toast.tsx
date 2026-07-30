"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

/**
 * Toasts CRM — retour visuel discret après chaque action (succès / erreur).
 * Premium, sombre, accessible (`role="status"` + `aria-live`). Sans dépendance.
 */

type ToastKind = "success" | "error" | "info";

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  toast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé dans un <ToastProvider>.");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const toast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = ++counter.current;
    setItems((prev) => [...prev, { id, kind, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex max-w-sm items-start gap-2.5 rounded-[10px] border px-4 py-3 text-sm shadow-[var(--shadow-lg)] crm-fade-in ${
              t.kind === "success"
                ? "border-[rgba(120,190,150,0.4)] bg-[#12211a] text-[#c7ecd4]"
                : t.kind === "error"
                  ? "border-[rgba(240,165,140,0.4)] bg-[#241512] text-[var(--color-danger-on-dark)]"
                  : "border-[var(--crm-line)] bg-[var(--crm-panel-2)] text-[var(--crm-text)]"
            }`}
          >
            <span aria-hidden className="mt-px text-[13px]">
              {t.kind === "success" ? "✓" : t.kind === "error" ? "⚠" : "ℹ"}
            </span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

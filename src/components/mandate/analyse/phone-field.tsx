"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { AsYouType, type CountryCode } from "libphonenumber-js";
import {
  findCountry,
  getCountryOptions,
  type CountryOption,
} from "./phone-countries";

interface PhoneFieldProps {
  label: string;
  /** Numéro tel que saisi (national ou international). */
  numberValue: string;
  /** Pays sélectionné (ISO 3166-1 alpha-2). */
  country: string;
  onNumberChange: (value: string) => void;
  onCountryChange: (iso: string) => void;
  error?: string;
  autoFocus?: boolean;
}

/**
 * Champ téléphone international premium.
 *
 * - Sélecteur de pays custom (drapeau + indicatif visible, recherche) — **aucune
 *   apparence de composant brut** : mêmes tokens que le reste du parcours.
 * - France sélectionnée par défaut ; saisie nationale « 06 25 77 35 92 » acceptée.
 * - Le navigateur ne fait qu'afficher/mettre en forme ; la **validité** et la
 *   conversion **E.164** sont contrôlées par le schéma / le serveur.
 */
export function PhoneField({
  label,
  numberValue,
  country,
  onNumberChange,
  onCountryChange,
  error,
  autoFocus,
}: PhoneFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const numberRef = useRef<HTMLInputElement | null>(null);

  const options = useMemo(() => getCountryOptions(), []);
  const selected: CountryOption =
    findCountry(country) ??
    findCountry("FR") ??
    options[0] ?? {
      iso: "FR" as CountryCode,
      name: "France",
      dialCode: "33",
      flag: "🇫🇷",
    };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso.toLowerCase().includes(q) ||
        `+${c.dialCode}`.includes(q) ||
        c.dialCode.includes(q),
    );
  }, [options, query]);

  // Fermeture au clic extérieur et à la touche Échap.
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Ouverture : focus le champ de recherche.
  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  function selectCountry(iso: string) {
    onCountryChange(iso);
    setOpen(false);
    setQuery("");
    // Reste sur le numéro pour poursuivre la saisie.
    requestAnimationFrame(() => numberRef.current?.focus());
  }

  /**
   * Met en forme le numéro en notation nationale à la sortie du champ —
   * UNIQUEMENT s'il est valide, pour ne jamais dénaturer une saisie en cours
   * ou incorrecte (l'utilisateur garde exactement ce qu'il a tapé).
   */
  function handleBlur() {
    const raw = numberValue.trim();
    if (!raw) return;
    const formatter = new AsYouType(selected.iso as CountryCode);
    formatter.input(raw);
    const parsed = formatter.getNumber();
    if (parsed && parsed.isValid()) {
      const national = parsed.formatNational();
      if (national && national !== raw) onNumberChange(national);
    }
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      const first = filtered[0];
      if (first) selectCountry(first.iso);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <label
        htmlFor={id}
        className="block text-xs uppercase tracking-[0.18em] text-text-on-dark-muted"
      >
        {label}
      </label>

      <div
        className={`mt-2 flex min-h-[3.25rem] items-stretch overflow-hidden rounded-[var(--radius-md)] border bg-surface shadow-[var(--shadow-sm)] transition-shadow ${
          error
            ? "border-[color:var(--color-danger-on-light)] focus-within:ring-2 focus-within:ring-[color:var(--color-danger-on-light)]"
            : "border-[color:var(--color-border)] focus-within:border-[color:var(--color-gold-soft)] focus-within:ring-2 focus-within:ring-[color:var(--color-gold-soft)]"
        }`}
      >
        {/* Sélecteur de pays */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Pays : ${selected.name} (+${selected.dialCode}). Modifier le pays.`}
          className="flex shrink-0 items-center gap-2 py-2.5 pl-4 pr-3 text-lg text-wood-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-focus)]"
        >
          <span aria-hidden="true" className="text-xl leading-none">
            {selected.flag}
          </span>
          <span className="tabular-nums text-wood-black">
            +{selected.dialCode}
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className={`size-4 text-text-secondary transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <path d="M6 8l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {/* Séparateur fin */}
        <span aria-hidden="true" className="my-2 w-px bg-[color:var(--color-border)]" />

        {/* Numéro */}
        <input
          id={id}
          ref={numberRef}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          autoFocus={autoFocus}
          value={numberValue}
          onChange={(e) => onNumberChange(e.target.value)}
          onBlur={handleBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          placeholder="06 25 77 35 92"
          className="ml-3 w-full border-0 bg-transparent py-2.5 pr-4 text-lg text-wood-black placeholder:text-text-secondary/50 focus:outline-none focus:ring-0"
        />
      </div>

      {error ? (
        <p id={errorId} className="mt-2 text-sm text-[color:var(--color-danger-on-dark)]">
          {error}
        </p>
      ) : null}

      {/* Liste déroulante des pays */}
      {open ? (
        <div className="absolute left-0 right-0 z-30 mt-2 max-h-80 overflow-hidden rounded-[var(--radius-md)] border border-[color:var(--color-border)] bg-surface text-wood-black shadow-[var(--shadow-lg)]">
          <div className="border-b border-[color:var(--color-border)] p-2">
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Rechercher un pays ou un indicatif…"
              aria-label="Rechercher un pays"
              className="w-full bg-transparent px-3 py-2 text-sm text-wood-black placeholder:text-text-secondary/60 focus:outline-none"
            />
          </div>
          <ul role="listbox" aria-label="Pays" className="max-h-64 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-text-secondary">
                Aucun pays trouvé.
              </li>
            ) : (
              filtered.map((c) => {
                const isActive = c.iso === selected.iso;
                return (
                  <li key={c.iso} role="option" aria-selected={isActive}>
                    <button
                      type="button"
                      onClick={() => selectCountry(c.iso)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-ivory-muted focus-visible:bg-ivory-muted focus-visible:outline-none ${
                        isActive ? "bg-ivory-muted text-wood-black" : "text-wood-black/90"
                      }`}
                    >
                      <span aria-hidden="true" className="text-lg leading-none">
                        {c.flag}
                      </span>
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="tabular-nums text-text-secondary">
                        +{c.dialCode}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

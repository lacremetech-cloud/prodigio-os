"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Chip } from "@/components/crm/ui";
import { KANBAN_COLUMNS, stageLabels } from "@/modules/crm/labels";
import { evaluateMove, isProtectedTarget, type KanbanLead } from "@/modules/crm/kanban";
import { moveLeadStage } from "@/modules/crm/data/mutations";

/**
 * Kanban glisser-déposer. Le déplacement passe par la mutation serveur existante
 * (`crm_change_stage`), re-vérifie le rôle en base et écrit l'audit. Les colonnes
 * protégées (proposition / signature / perdu) refusent le dépôt et renvoient vers
 * l'action métier. Déplacement optimiste + rollback en cas de refus. Alternative
 * accessible : menu « Déplacer vers… » et déplacement au clavier.
 */

interface Grabbed {
  id: string;
  fromStage: string;
  targetIndex: number;
}

export function KanbanBoard({
  leads,
  canMove,
  canView,
}: {
  leads: KanbanLead[];
  canMove: boolean;
  canView: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Position optimiste : stage courant par dossier (surcharge le stade serveur).
  const [stageOverride, setStageOverride] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ opportunityId: string; text: string; action?: "mandat" | "resultat" } | null>(null);
  const [live, setLive] = useState("");
  const [grabbed, setGrabbed] = useState<Grabbed | null>(null);

  // Filtres (stables au déplacement : ils ne dépendent pas de la position).
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<"tous" | "non_affecte" | "en_retard" | "fort_potentiel">("tous");

  const byId = useMemo(() => new Map(leads.map((l) => [l.opportunityId, l])), [leads]);
  const stageOf = (l: KanbanLead) => stageOverride[l.opportunityId] ?? l.stage;

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return leads.filter((l) => {
      if (needle) {
        const hay = `${l.name} ${l.city ?? ""} ${l.propertyLabel}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (quick === "non_affecte") return l.unassigned;
      if (quick === "en_retard") return l.overdue;
      if (quick === "fort_potentiel") return l.highPotential;
      return true;
    });
  }, [leads, search, quick]);

  const columns = useMemo(() => {
    const fallback: Record<string, string> = {
      rendez_vous_realise: "rendez_vous_planifie",
      en_attente_de_signature: "proposition_de_mandat",
    };
    const map = new Map<string, KanbanLead[]>();
    for (const col of KANBAN_COLUMNS) map.set(col, []);
    for (const l of visible) {
      const s = stageOf(l);
      const col = map.has(s) ? s : fallback[s] ?? "nouveau";
      map.get(col)?.push(l);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, stageOverride]);

  const commitMove = (opportunityId: string, fromStage: string, toStage: string) => {
    const evalResult = evaluateMove(fromStage, toStage);
    if (evalResult.noop) return;
    if (!evalResult.allowed) {
      setNotice({ opportunityId, text: evalResult.reason ?? "Déplacement non autorisé.", action: evalResult.requiresAction });
      setLive(`Déplacement refusé : ${evalResult.reason ?? ""}`);
      return;
    }
    if (savingId) return; // un seul déplacement à la fois

    setNotice(null);
    setSavingId(opportunityId);
    setStageOverride((prev) => ({ ...prev, [opportunityId]: toStage })); // optimiste
    const name = byId.get(opportunityId)?.name ?? "Dossier";
    setLive(`${name} déplacé vers « ${stageLabels[toStage] ?? toStage} », enregistrement…`);

    startTransition(async () => {
      const res = await moveLeadStage({ opportunityId, fromStage, toStage });
      setSavingId(null);
      if (res.ok) {
        setLive(`${name} enregistré dans « ${stageLabels[toStage] ?? toStage} ».`);
        // Réconciliation serveur (source de vérité) ; on nettoie l'override.
        setStageOverride((prev) => {
          const next = { ...prev };
          delete next[opportunityId];
          return next;
        });
        router.refresh();
      } else {
        // Rollback : la carte revient à sa position initiale.
        setStageOverride((prev) => {
          const next = { ...prev };
          delete next[opportunityId];
          return next;
        });
        setNotice({ opportunityId, text: res.error ?? "Enregistrement impossible.", action: res.requiresAction });
        setLive(`Échec du déplacement : ${res.error ?? ""}`);
      }
    });
  };

  // --- Clavier -----------------------------------------------------------------
  const moveGrabbedTarget = (delta: number) => {
    setGrabbed((g) => {
      if (!g) return g;
      const next = Math.max(0, Math.min(KANBAN_COLUMNS.length - 1, g.targetIndex + delta));
      setLive(`Cible : « ${stageLabels[KANBAN_COLUMNS[next]!] ?? ""} »`);
      return { ...g, targetIndex: next };
    });
  };
  const onCardKeyDown = (e: React.KeyboardEvent, l: KanbanLead) => {
    if (!canMove) return;
    const currentStage = stageOf(l);
    if (!grabbed || grabbed.id !== l.opportunityId) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        const idx = Math.max(0, KANBAN_COLUMNS.indexOf(currentStage as (typeof KANBAN_COLUMNS)[number]));
        setGrabbed({ id: l.opportunityId, fromStage: currentStage, targetIndex: idx });
        setLive(`${l.name} saisi. Flèches gauche/droite pour choisir la colonne, Entrée pour déposer, Échap pour annuler.`);
      }
      return;
    }
    // Carte saisie
    if (e.key === "ArrowRight") { e.preventDefault(); moveGrabbedTarget(1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); moveGrabbedTarget(-1); }
    else if (e.key === "Escape") { e.preventDefault(); setGrabbed(null); setLive("Déplacement annulé."); }
    else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const target = KANBAN_COLUMNS[grabbed.targetIndex]!;
      setGrabbed(null);
      commitMove(l.opportunityId, grabbed.fromStage, target);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Filtres (préservés au déplacement) */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="crm-input max-w-[240px] text-sm"
          placeholder="Rechercher (nom, ville…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Rechercher un dossier"
        />
        <div className="crm-tabs">
          {([
            ["tous", "Tous"],
            ["non_affecte", "Non affectés"],
            ["en_retard", "En retard"],
            ["fort_potentiel", "Fort potentiel"],
          ] as const).map(([v, label]) => (
            <button key={v} type="button" className={`crm-tab ${quick === v ? "crm-tab--active" : ""}`} onClick={() => setQuick(v)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">{live}</p>

      <div className="crm-kanban crm-scroll">
        {KANBAN_COLUMNS.map((col) => {
          const items = columns.get(col) ?? [];
          const protectedCol = isProtectedTarget(col);
          const isOver = overStage === col && dragId != null;
          const dropBlocked = isOver && protectedCol;
          return (
            <div key={col} className="crm-kanban-col flex flex-col">
              <div className="mb-2 flex items-center justify-between px-1">
                <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--crm-text-dim)]">
                  {stageLabels[col]}
                  {protectedCol ? <span title="Colonne pilotée par une action métier dédiée" className="ml-1 text-[var(--crm-text-faint)]">🔒</span> : null}
                </h2>
                <span className="crm-chip tabular-nums">{items.length}</span>
              </div>
              <div
                className={`crm-kanban-dropzone flex min-h-[120px] flex-col gap-2 rounded-[12px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel)] p-2 ${isOver && !dropBlocked ? "crm-kanban-dropzone--over" : ""} ${dropBlocked ? "crm-kanban-dropzone--blocked" : ""}`}
                onDragOver={(e) => {
                  if (!canMove || !dragId) return;
                  e.preventDefault();
                  setOverStage(col);
                }}
                onDragLeave={() => setOverStage((s) => (s === col ? null : s))}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || dragId;
                  setOverStage(null);
                  setDragId(null);
                  const lead = id ? byId.get(id) : null;
                  if (lead) commitMove(lead.opportunityId, stageOf(lead), col);
                }}
              >
                {items.length === 0 ? (
                  <p className="px-2 py-6 text-center text-[11px] text-[var(--crm-text-faint)]">Vide</p>
                ) : (
                  items.map((l) => (
                    <Card
                      key={l.opportunityId}
                      lead={l}
                      canView={canView}
                      canMove={canMove}
                      saving={savingId === l.opportunityId}
                      grabbed={grabbed?.id === l.opportunityId}
                      grabbedTarget={grabbed?.id === l.opportunityId ? stageLabels[KANBAN_COLUMNS[grabbed.targetIndex]!] ?? "" : null}
                      notice={notice?.opportunityId === l.opportunityId ? notice : null}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", l.opportunityId);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(l.opportunityId);
                      }}
                      onDragEnd={() => { setDragId(null); setOverStage(null); }}
                      onKeyDown={(e) => onCardKeyDown(e, l)}
                      onMenuMove={(toStage) => commitMove(l.opportunityId, stageOf(l), toStage)}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Card({
  lead,
  canView,
  canMove,
  saving,
  grabbed,
  grabbedTarget,
  notice,
  onDragStart,
  onDragEnd,
  onKeyDown,
  onMenuMove,
}: {
  lead: KanbanLead;
  canView: boolean;
  canMove: boolean;
  saving: boolean;
  grabbed: boolean;
  grabbedTarget: string | null;
  notice: { text: string; action?: "mandat" | "resultat" } | null;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onMenuMove: (toStage: string) => void;
}) {
  return (
    <div
      className={`crm-panel-2 crm-kanban-card flex flex-col gap-2 p-3 ${saving ? "crm-kanban-card--saving" : ""} ${grabbed ? "ring-1 ring-[var(--crm-gold)]" : ""}`}
      draggable={canMove && !saving}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      aria-roledescription={canMove ? "Carte déplaçable" : undefined}
    >
      <div className="flex items-start gap-2">
        {canMove ? (
          <button
            type="button"
            className="crm-kanban-grip mt-0.5 shrink-0 text-sm"
            aria-label={`Déplacer ${lead.name}`}
            onKeyDown={onKeyDown}
            title="Glisser, ou Entrée pour déplacer au clavier"
          >
            ⠿
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <Link href={`/crm/mandats/${lead.opportunityId}`} className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="crm-ellipsis text-sm font-medium text-[var(--crm-text)]" title={lead.name}>{lead.name}</span>
              {lead.highPotential ? <Chip variant="gold">★</Chip> : null}
            </div>
            <p className="crm-ellipsis mt-1 text-xs text-[var(--crm-text-faint)]" title={`${lead.propertyLabel}${lead.city ? ` · ${lead.city}` : ""}`}>
              {lead.propertyLabel}{lead.city ? ` · ${lead.city}` : ""}
            </p>
            <p className="crm-ellipsis mt-0.5 text-xs text-[var(--crm-text-faint)]">{lead.valueLabel}</p>
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--crm-text-dim)]">
            <span className="tabular-nums">C {lead.compatibilityScore ?? "—"}</span>
            <span className="tabular-nums">M {lead.maturityScore ?? "—"}</span>
            {lead.unassigned ? <Chip variant="danger">Non affecté</Chip> : null}
            {lead.overdue ? <Chip variant="danger">En retard</Chip> : null}
          </div>
          {canView && lead.phoneMasked ? (
            <p className="mt-1 text-[11px] text-[var(--crm-text-faint)]">{lead.phoneMasked}</p>
          ) : null}
        </div>
        {saving ? <span className="shrink-0 text-[11px] text-[var(--crm-gold)]">…</span> : null}
      </div>

      {grabbed ? (
        <p className="rounded-[6px] bg-[var(--crm-panel)] px-2 py-1 text-[11px] text-[var(--crm-gold)]">
          Cible : « {grabbedTarget} » — Entrée pour déposer, Échap pour annuler.
        </p>
      ) : null}

      {canMove ? (
        <label className="flex items-center gap-1.5">
          <span className="sr-only">Déplacer {lead.name} vers un stade</span>
          <select
            className="crm-select text-xs"
            value=""
            disabled={saving}
            onChange={(e) => {
              const v = e.target.value;
              e.currentTarget.selectedIndex = 0;
              if (v) onMenuMove(v);
            }}
            aria-label={`Déplacer ${lead.name} vers un stade`}
          >
            <option value="">Déplacer vers…</option>
            {KANBAN_COLUMNS.filter((c) => c !== lead.stage).map((c) => (
              <option key={c} value={c}>
                {stageLabels[c]}{isProtectedTarget(c) ? " (action dédiée)" : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {notice ? (
        <div className="rounded-[8px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel)] p-2">
          <p className="crm-wrap text-[11px] text-[var(--crm-text-dim)]">{notice.text}</p>
          {notice.action ? (
            <Link href={`/crm/mandats/${lead.opportunityId}`} className="mt-1 inline-block text-[11px] text-[var(--crm-gold)] underline">
              {notice.action === "mandat" ? "Ouvrir le dossier (mandat)" : "Ouvrir le dossier (résultat)"}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

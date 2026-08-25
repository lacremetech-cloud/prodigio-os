"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Chip } from "@/components/crm/ui";
import { cssVarRef } from "@/modules/crm/status-visuals";
import {
  BUYER_KANBAN_COLUMNS,
  buyerStageLabels,
  buyerStageVisual,
} from "@/modules/buyers/crm/labels";
import {
  evaluateBuyerMove,
  isProtectedBuyerStage,
  movableBuyerStages,
  type BuyerKanbanCard,
} from "@/modules/buyers/crm/pipeline";
import { moveBuyerCardAction } from "@/modules/buyers/crm/actions";
import { safeAction } from "@/modules/crm/safe-action";

/**
 * Kanban Acquéreurs — mêmes standards que le Kanban Mandats :
 *  • glisser-déposer desktop ;
 *  • alternative accessible « Déplacer vers… » et déplacement au clavier ;
 *  • annonce `aria-live` de chaque étape du déplacement ;
 *  • déplacement optimiste avec rollback en cas de refus ;
 *  • verrou anti-double-envoi (un seul déplacement à la fois) ;
 *  • aucune carte dupliquée (une carte = un dossier, placé dans une colonne) ;
 *  • filtres conservés après déplacement (ils ne dépendent pas de la position) ;
 *  • transitions sensibles protégées CÔTÉ SERVEUR (offre / gagné / perdu).
 */

interface Grabbed {
  id: string;
  fromStage: string;
  targetIndex: number;
}

export function BuyerKanbanBoard({
  cards,
  canMove,
}: {
  cards: BuyerKanbanCard[];
  canMove: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [stageOverride, setStageOverride] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [notice, setNotice] = useState<{
    buyerProfileId: string;
    text: string;
    action?: "offre" | "resultat" | "reouverture";
  } | null>(null);
  const [live, setLive] = useState("");
  const [grabbed, setGrabbed] = useState<Grabbed | null>(null);

  // Filtres : stables au déplacement (ils ne dépendent pas de la position).
  const [search, setSearch] = useState("");
  const [quick, setQuick] = useState<
    "tous" | "non_affecte" | "en_retard" | "fort_potentiel" | "sans_action"
  >("tous");

  const byId = useMemo(() => new Map(cards.map((c) => [c.buyerProfileId, c])), [cards]);
  const stageOf = (c: BuyerKanbanCard) => stageOverride[c.buyerProfileId] ?? c.stage;

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return cards.filter((c) => {
      if (needle) {
        const hay = `${c.name} ${c.city ?? ""} ${c.propertyLabel ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (quick === "non_affecte") return c.unassigned;
      if (quick === "en_retard") return c.overdue;
      if (quick === "fort_potentiel") return c.recommendedPriority === "prioritaire";
      if (quick === "sans_action") return c.noNextAction;
      return true;
    });
  }, [cards, search, quick]);

  const columns = useMemo(() => {
    const map = new Map<string, BuyerKanbanCard[]>();
    for (const col of BUYER_KANBAN_COLUMNS) map.set(col, []);
    for (const c of visible) {
      const s = stageOf(c);
      // Une carte n'est placée qu'UNE fois : colonne connue, sinon « nouveau ».
      const col = map.has(s) ? s : "nouveau";
      map.get(col)?.push(c);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, stageOverride]);

  const commitMove = (buyerProfileId: string, fromStage: string, toStage: string) => {
    const evaluation = evaluateBuyerMove(fromStage, toStage);
    if (evaluation.noop) return;
    if (!evaluation.allowed) {
      setNotice({
        buyerProfileId,
        text: evaluation.reason ?? "Déplacement non autorisé.",
        action: evaluation.requiresAction,
      });
      setLive(`Déplacement refusé : ${evaluation.reason ?? ""}`);
      return;
    }
    if (savingId) return; // verrou anti-double-envoi

    setNotice(null);
    setSavingId(buyerProfileId);
    setStageOverride((prev) => ({ ...prev, [buyerProfileId]: toStage })); // optimiste
    const name = byId.get(buyerProfileId)?.name ?? "Dossier";
    setLive(`${name} déplacé vers « ${buyerStageLabels[toStage] ?? toStage} », enregistrement…`);

    startTransition(async () => {
      const res = await safeAction(() =>
        moveBuyerCardAction({ buyerProfileId, fromStage, toStage }),
      );
      setSavingId(null);
      // Dans les deux cas on retire l'override : le serveur fait autorité.
      setStageOverride((prev) => {
        const next = { ...prev };
        delete next[buyerProfileId];
        return next;
      });
      if (res.ok) {
        setLive(`${name} enregistré dans « ${buyerStageLabels[toStage] ?? toStage} ».`);
        router.refresh();
      } else {
        setNotice({
          buyerProfileId,
          text: res.error ?? "Enregistrement impossible.",
          // Un échec technique n'a pas d'action métier associée : `in` distingue
          // le refus métier (qui en propose une) de la panne (qui n'en a pas).
          action: "requiresAction" in res ? res.requiresAction : undefined,
        });
        setLive(`Échec du déplacement : ${res.error ?? ""}`);
      }
    });
  };

  // --- Clavier ---------------------------------------------------------------
  const moveGrabbedTarget = (delta: number) => {
    setGrabbed((g) => {
      if (!g) return g;
      const next = Math.max(0, Math.min(BUYER_KANBAN_COLUMNS.length - 1, g.targetIndex + delta));
      setLive(`Cible : « ${buyerStageLabels[BUYER_KANBAN_COLUMNS[next]!] ?? ""} »`);
      return { ...g, targetIndex: next };
    });
  };

  const onCardKeyDown = (e: React.KeyboardEvent, c: BuyerKanbanCard) => {
    if (!canMove) return;
    const currentStage = stageOf(c);
    if (!grabbed || grabbed.id !== c.buyerProfileId) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        const idx = Math.max(0, BUYER_KANBAN_COLUMNS.indexOf(currentStage as never));
        setGrabbed({ id: c.buyerProfileId, fromStage: currentStage, targetIndex: idx });
        setLive(
          `${c.name} saisi. Flèches gauche/droite pour choisir la colonne, Entrée pour déposer, Échap pour annuler.`,
        );
      }
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      moveGrabbedTarget(1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      moveGrabbedTarget(-1);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setGrabbed(null);
      setLive("Déplacement annulé.");
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const target = BUYER_KANBAN_COLUMNS[grabbed.targetIndex]!;
      setGrabbed(null);
      commitMove(c.buyerProfileId, grabbed.fromStage, target);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="crm-input max-w-[260px] text-sm"
          placeholder="Rechercher (nom, ville, bien…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Rechercher un dossier acquéreur"
        />
        <div className="crm-tabs flex-wrap">
          {(
            [
              ["tous", "Tous"],
              ["non_affecte", "Non affectés"],
              ["en_retard", "En retard"],
              ["sans_action", "Sans action"],
              ["fort_potentiel", "Fort potentiel"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              className={`crm-tab ${quick === v ? "crm-tab--active" : ""}`}
              aria-pressed={quick === v}
              onClick={() => setQuick(v)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {live}
      </p>

      <div className="crm-kanban crm-scroll">
        {BUYER_KANBAN_COLUMNS.map((col) => {
          const items = columns.get(col) ?? [];
          const protectedCol = isProtectedBuyerStage(col);
          const isOver = overStage === col && dragId != null;
          const dropBlocked = isOver && protectedCol;
          const visual = buyerStageVisual(col);
          return (
            <div key={col} className="crm-kanban-col flex flex-col">
              <div
                className="crm-kanban-head mb-2 flex items-center justify-between gap-2"
                style={
                  { ["--col-accent" as keyof CSSProperties]: cssVarRef(visual.cssVar) } as CSSProperties
                }
              >
                <h2 className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--crm-text-dim)]">
                  <span aria-hidden style={{ color: cssVarRef(visual.cssVar) }}>
                    {visual.icon}
                  </span>
                  <span className="crm-ellipsis">{visual.label}</span>
                  {protectedCol ? (
                    <span
                      title="Colonne pilotée par une action métier dédiée (confirmation, motif, audit)"
                      className="shrink-0 text-[var(--crm-text-faint)]"
                    >
                      🔒
                    </span>
                  ) : null}
                </h2>
                <span className="crm-chip shrink-0 tabular-nums">{items.length}</span>
              </div>
              <div
                className={`crm-kanban-dropzone flex min-h-[120px] flex-col gap-2 rounded-[12px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel)] p-2 ${
                  isOver && !dropBlocked ? "crm-kanban-dropzone--over" : ""
                } ${dropBlocked ? "crm-kanban-dropzone--blocked" : ""}`}
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
                  const card = id ? byId.get(id) : null;
                  if (card) commitMove(card.buyerProfileId, stageOf(card), col);
                }}
              >
                {items.length === 0 ? (
                  <p className="px-2 py-6 text-center text-[11px] text-[var(--crm-text-faint)]">
                    Vide
                  </p>
                ) : (
                  items.map((c) => (
                    <Card
                      key={c.buyerProfileId}
                      card={c}
                      canMove={canMove}
                      saving={savingId === c.buyerProfileId}
                      grabbed={grabbed?.id === c.buyerProfileId}
                      grabbedTarget={
                        grabbed?.id === c.buyerProfileId
                          ? buyerStageLabels[BUYER_KANBAN_COLUMNS[grabbed.targetIndex]!] ?? ""
                          : null
                      }
                      notice={notice?.buyerProfileId === c.buyerProfileId ? notice : null}
                      currentStage={stageOf(c)}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", c.buyerProfileId);
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(c.buyerProfileId);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStage(null);
                      }}
                      onKeyDown={(e) => onCardKeyDown(e, c)}
                      onMenuMove={(toStage) => commitMove(c.buyerProfileId, stageOf(c), toStage)}
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
  card,
  canMove,
  saving,
  grabbed,
  grabbedTarget,
  notice,
  currentStage,
  onDragStart,
  onDragEnd,
  onKeyDown,
  onMenuMove,
}: {
  card: BuyerKanbanCard;
  canMove: boolean;
  saving: boolean;
  grabbed: boolean;
  grabbedTarget: string | null;
  notice: { text: string; action?: "offre" | "resultat" | "reouverture" } | null;
  currentStage: string;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onMenuMove: (toStage: string) => void;
}) {
  const targets = movableBuyerStages(currentStage);
  return (
    <div
      className={`crm-panel-2 crm-kanban-card flex flex-col gap-2 p-3 ${
        saving ? "crm-kanban-card--saving" : ""
      } ${grabbed ? "ring-1 ring-[var(--crm-gold)]" : ""}`}
      draggable={canMove && !saving && targets.length > 0}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      aria-roledescription={canMove ? "Carte déplaçable" : undefined}
    >
      <div className="flex items-start gap-2">
        {canMove && targets.length > 0 ? (
          <button
            type="button"
            className="crm-kanban-grip mt-0.5 shrink-0 text-sm"
            aria-label={`Déplacer ${card.name}`}
            onKeyDown={onKeyDown}
            title="Glisser, ou Entrée pour déplacer au clavier"
          >
            ⠿
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <Link href={`/crm/acquereurs/${card.buyerProfileId}`} className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="crm-ellipsis text-sm font-medium text-[var(--crm-text)]"
                title={card.name}
              >
                {card.name}
              </span>
              {card.recommendedPriority === "prioritaire" ? <Chip variant="gold">★</Chip> : null}
            </div>
            <p
              className="crm-ellipsis mt-1 text-xs text-[var(--crm-text-faint)]"
              title={`${card.propertyLabel ?? ""}${card.city ? ` · ${card.city}` : ""}`}
            >
              {card.propertyLabel ?? "Aucun bien rattaché"}
              {card.city ? ` · ${card.city}` : ""}
            </p>
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--crm-text-dim)]">
            <span className="tabular-nums" title="Meilleur score automatique du funnel">
              Score {card.bestScore ?? "—"}
            </span>
            <span title="Qualification validée par un humain">{card.qualificationLabel}</span>
            {card.interestCount > 1 ? <span>{card.interestCount} intérêts</span> : null}
            {card.unassigned ? <Chip variant="danger">Non affecté</Chip> : null}
            {card.overdue ? <Chip variant="danger">En retard</Chip> : null}
            {card.noNextAction ? <Chip variant="danger">Sans action</Chip> : null}
            {card.newInterest ? <Chip variant="gold">Nouvel intérêt</Chip> : null}
          </div>
          {card.phoneMasked ? (
            <p className="mt-1 text-[11px] text-[var(--crm-text-faint)]">{card.phoneMasked}</p>
          ) : null}
        </div>
        {saving ? <span className="shrink-0 text-[11px] text-[var(--crm-gold)]">…</span> : null}
      </div>

      {grabbed ? (
        <p className="rounded-[6px] bg-[var(--crm-panel)] px-2 py-1 text-[11px] text-[var(--crm-gold)]">
          Cible : « {grabbedTarget} » — Entrée pour déposer, Échap pour annuler.
        </p>
      ) : null}

      {canMove && targets.length > 0 ? (
        <label className="flex items-center gap-1.5">
          <span className="sr-only">Déplacer {card.name} vers une étape</span>
          <select
            className="crm-select text-xs"
            value=""
            disabled={saving}
            onChange={(e) => {
              const v = e.target.value;
              e.currentTarget.selectedIndex = 0;
              if (v) onMenuMove(v);
            }}
            aria-label={`Déplacer ${card.name} vers une étape`}
          >
            <option value="">Déplacer vers…</option>
            {targets.map((s) => (
              <option key={s} value={s}>
                {buyerStageLabels[s]}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {notice ? (
        <div className="rounded-[8px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel)] p-2">
          <p className="crm-wrap text-[11px] text-[var(--crm-text-dim)]">{notice.text}</p>
          {notice.action ? (
            <Link
              href={`/crm/acquereurs/${card.buyerProfileId}`}
              className="mt-1 inline-block text-[11px] text-[var(--crm-gold)] underline"
            >
              {notice.action === "offre"
                ? "Ouvrir la fiche (enregistrer une offre)"
                : notice.action === "resultat"
                  ? "Ouvrir la fiche (enregistrer le résultat)"
                  : "Ouvrir la fiche (rouvrir le dossier)"}
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { Chip } from "@/components/crm/ui";
import { BadgeProjet } from "./barre-projets";
import { cssVarRef, vifVar } from "@/modules/crm/status-visuals";
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
import type { BuyerInboxRow } from "@/modules/buyers/crm/queries";
import { positionDansLaFile, suivantDansLaFile } from "@/modules/buyers/crm/file-appels";
import { PanneauTraitement } from "./panneau-traitement";
import { ContactRapide } from "./contact-rapide";
import { formatDateTime, formatJour } from "@/modules/crm/format";
import {
  QUALIFICATION_BADGE,
  QUALIFICATION_LABELS,
} from "@/modules/buyers/crm/qualification";
import { libelleBudget } from "@/modules/buyers/crm/budget";

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
  montrerProjet = true,
  contexte = "",
  rows = [],
  membres = [],
  moiUserId = null,
  peutAffecterAutrui = false,
}: {
  cards: BuyerKanbanCard[];
  canMove: boolean;
  /**
   * Les MEMES dossiers que `cards`, en entier.
   *
   * Une carte ne porte que de quoi se dessiner : ni e-mail, ni qualification,
   * ni derniere note, ni prochaine tache. Le panneau a besoin de tout cela, et
   * la page le charge deja pour le bandeau — aucune requete de plus.
   */
  rows?: BuyerInboxRow[];
  /** Pour « M'attribuer » et le choix du responsable dans le panneau. */
  membres?: { userId: string; name: string }[];
  /** Mon identifiant, et mon droit de confier un dossier a autrui. */
  moiUserId?: string | null;
  peutAffecterAutrui?: boolean;
  /** Afficher le badge de projet sur chaque carte. */
  montrerProjet?: boolean;
  /** Selection courante, recopiee dans chaque lien de fiche. */
  contexte?: string;
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

  /*
   * Tout ce tableau etait indexe sur la PERSONNE. Depuis qu'une carte
   * represente une personne SUR UN PROJET, deux cartes du meme acquereur
   * partageaient alors le meme identifiant : les deplacer l'une deplaçait
   * l'autre, et l'affichage optimiste peignait les deux.
   *
   * La cle d'une carte est sa manifestation. Le repli sur la personne ne sert
   * qu'au dossier sans aucune manifestation, qui ne devrait pas exister.
   */
  const cleCarte = (c: BuyerKanbanCard) => c.interestId ?? c.buyerProfileId;
  const byId = useMemo(
    () => new Map(cards.map((c) => [c.interestId ?? c.buyerProfileId, c])),
    [cards],
  );
  const stageOf = (c: BuyerKanbanCard) => stageOverride[cleCarte(c)] ?? c.stage;

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return cards.filter((c) => {
      if (needle) {
        const hay = `${c.name} ${c.city ?? ""} ${c.properties.map((p) => p.label).join(" ")}`
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    /* PLUS DE FILTRE LOCAL ICI. Le tableau en appliquait un, avec son propre
       vocabulaire, PAR-DESSUS celui que la page applique deja depuis l'URL
       (`?signal=`). Deux mecanismes pour une seule intention : les pastilles
       annonçaient un etat que les colonnes ne reflétaient pas, et aucun des
       deux ne portait de compteur. La page filtre, le tableau dessine. */
  }, [cards, search]);

  /* ---------------------------------------------------------------------
     LE PANNEAU DE TRAITEMENT, SUR LE PIPELINE

     Exactement le meme composant que la liste, avec la meme garde : une note
     dictee au telephone et perdue en changeant de carte, et l'outil est
     abandonne le jour meme.
     --------------------------------------------------------------------- */
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [ordreFile, setOrdreFile] = useState<string[]>([]);
  const saleRef = useRef(false);

  const rowsById = useMemo(
    () => new Map(rows.map((r) => [r.interestId ?? r.buyerProfileId, r])),
    [rows],
  );

  /** Vrai si l'on peut quitter le dossier ouvert : sinon on demande. */
  function peutQuitter(): boolean {
    if (!saleRef.current) return true;
    return window.confirm(
      "Vous avez une saisie non enregistrée sur ce dossier. La perdre ?",
    );
  }

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

  /* « Suivant » suit l'ordre DU TABLEAU — colonne par colonne, de haut en bas
     — et non l'ordre d'urgence de la liste : ici on voit les colonnes, et un
     « suivant » qui sauterait ailleurs serait incomprehensible. */
  const ordreTableau = useMemo(() => {
    const ordre: string[] = [];
    for (const col of BUYER_KANBAN_COLUMNS) {
      for (const c of columns.get(col) ?? []) ordre.push(cleCarte(c));
    }
    return ordre;
  }, [columns]);

  const rowOuverte = ouvert ? rowsById.get(ouvert) ?? null : null;
  const { position, total: totalFile } = positionDansLaFile(ordreFile, ouvert);

  /** Ouvrir une carte demarre une file : celle du tableau affiche. */
  function ouvrirDossier(c: BuyerKanbanCard) {
    const cle = cleCarte(c);
    if (cle === ouvert) return;
    if (!peutQuitter()) return;
    if (ordreFile.length === 0) setOrdreFile(ordreTableau);
    setOuvert(cle);
  }

  const commitMove = (cle: string, fromStage: string, toStage: string) => {
    const evaluation = evaluateBuyerMove(fromStage, toStage);
    if (evaluation.noop) return;
    if (!evaluation.allowed) {
      setNotice({
        buyerProfileId: cle,
        text: evaluation.reason ?? "Déplacement non autorisé.",
        action: evaluation.requiresAction,
      });
      setLive(`Déplacement refusé : ${evaluation.reason ?? ""}`);
      return;
    }
    if (savingId) return; // verrou anti-double-envoi

    setNotice(null);
    setSavingId(cle);
    setStageOverride((prev) => ({ ...prev, [cle]: toStage })); // optimiste
    const carte = byId.get(cle);
    const name = carte?.name ?? "Dossier";
    setLive(`${name} déplacé vers « ${buyerStageLabels[toStage] ?? toStage} », enregistrement…`);

    startTransition(async () => {
      // Sans manifestation, il n'y a pas d'etape a deplacer : on le dit plutot
      // que d'envoyer une requete qui echouerait en base.
      const manifestation = carte?.interestId ?? null;
      if (!carte || !manifestation) {
        setSavingId(null);
        setStageOverride((prev) => {
          const next = { ...prev };
          delete next[cle];
          return next;
        });
        setNotice({
          buyerProfileId: cle,
          text: "Ce dossier n'est rattaché à aucun projet : son étape ne peut pas être déplacée.",
        });
        return;
      }
      const res = await safeAction(() =>
        moveBuyerCardAction({
          buyerProfileId: carte.buyerProfileId,
          interestId: manifestation,
          fromStage,
          toStage,
        }),
      );
      setSavingId(null);
      // Dans les deux cas on retire l'override : le serveur fait autorité.
      setStageOverride((prev) => {
        const next = { ...prev };
        delete next[cle];
        return next;
      });
      if (res.ok) {
        setLive(`${name} enregistré dans « ${buyerStageLabels[toStage] ?? toStage} ».`);
        router.refresh();
      } else {
        setNotice({
          buyerProfileId: cle,
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
    if (!grabbed || grabbed.id !== cleCarte(c)) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        const idx = Math.max(0, BUYER_KANBAN_COLUMNS.indexOf(currentStage as never));
        setGrabbed({ id: cleCarte(c), fromStage: currentStage, targetIndex: idx });
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
      commitMove(cleCarte(c), grabbed.fromStage, target);
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
            <div
              key={col}
              className="crm-kanban-col flex flex-col"
              style={
                {
                  ["--col-accent" as keyof CSSProperties]: cssVarRef(visual.cssVar),
                  ["--col-vif" as keyof CSSProperties]: cssVarRef(vifVar(visual.cssVar)),
                } as CSSProperties
              }
            >
              <div className="crm-kanban-head">
                <h2 className="crm-kanban-head__pastille">
                  <span aria-hidden>{visual.icon}</span>
                  <span className="crm-ellipsis">{visual.label}</span>
                  {protectedCol ? (
                    <span
                      title="Colonne pilotée par une action métier dédiée (confirmation, motif, audit)"
                      aria-label="Colonne pilotée par une action dédiée"
                      className="shrink-0 opacity-80"
                    >
                      🔒
                    </span>
                  ) : null}
                </h2>
                <span className="crm-kanban-head__compte">{items.length}</span>
              </div>
              <div
                className={`crm-kanban-dropzone crm-kanban-zone flex min-h-[120px] flex-col gap-2 rounded-[12px] p-2 ${
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
                  if (card) commitMove(cleCarte(card), stageOf(card), col);
                }}
              >
                {items.length === 0 ? (
                  <p className="px-2 py-6 text-center text-[11px] text-[var(--crm-text-faint)]">
                    Vide
                  </p>
                ) : (
                  items.map((c) => (
                    <Card
                      key={cleCarte(c)}
                      card={c}
                      canMove={canMove}
                      saving={savingId === cleCarte(c)}
                      grabbed={grabbed?.id === cleCarte(c)}
                      grabbedTarget={
                        grabbed?.id === cleCarte(c)
                          ? buyerStageLabels[BUYER_KANBAN_COLUMNS[grabbed.targetIndex]!] ?? ""
                          : null
                      }
                      notice={notice?.buyerProfileId === cleCarte(c) ? notice : null}
                      montrerProjet={montrerProjet}
                      contexte={contexte}
                      currentStage={stageOf(c)}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/plain", cleCarte(c));
                        e.dataTransfer.effectAllowed = "move";
                        setDragId(cleCarte(c));
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStage(null);
                      }}
                      onKeyDown={(e) => onCardKeyDown(e, c)}
                      onMenuMove={(toStage) => commitMove(cleCarte(c), stageOf(c), toStage)}
                      onOuvrir={rowsById.has(cleCarte(c)) ? () => ouvrirDossier(c) : undefined}
                      row={rowsById.get(cleCarte(c))}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {rowOuverte ? (
        <PanneauTraitement
          /* La CLE porte la remise a zero : changer de dossier remonte le
             panneau, donc aucune saisie du precedent ne peut survivre. */
          key={ouvert}
          row={rowOuverte}
          position={position}
          total={totalFile}
          resteUnSuivant={suivantDansLaFile(ordreFile, ouvert) !== null}
          saleRef={saleRef}
          membres={membres}
          moiUserId={moiUserId}
          peutAffecterAutrui={peutAffecterAutrui}
          contexte={contexte}
          onFermer={() => {
            if (peutQuitter()) setOuvert(null);
          }}
          /* `router.refresh()` recharge les DONNEES sans rien demonter : le
             tableau reste a l'ecran, les filtres et le defilement sont gardes. */
          onEnregistre={() => router.refresh()}
          onSuivant={() => setOuvert(suivantDansLaFile(ordreFile, ouvert))}
        />
      ) : null}
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
  montrerProjet,
  contexte,
  onDragStart,
  onDragEnd,
  onKeyDown,
  onMenuMove,
  onOuvrir,
  row,
}: {
  card: BuyerKanbanCard;
  canMove: boolean;
  saving: boolean;
  grabbed: boolean;
  grabbedTarget: string | null;
  notice: { text: string; action?: "offre" | "resultat" | "reouverture" } | null;
  currentStage: string;
  montrerProjet: boolean;
  contexte: string;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onMenuMove: (toStage: string) => void;
  /** Ouvre le panneau de traitement, SANS quitter le pipeline. */
  onOuvrir?: () => void;
  /** Le dossier COMPLET, quand la page le fournit : la carte affiche alors
      les memes informations que la liste. */
  row?: BuyerInboxRow;
}) {
  const targets = movableBuyerStages(currentStage);
  // Forme COURTE, comme en liste : le libelle long est la question telle
  // qu'elle a ete posee, et il tient sur deux lignes dans une carte.
  const budget = row ? libelleBudget(row) : null;
  return (
    <div
      className={`crm-kanban-card flex flex-col gap-2 p-3 ${
        saving ? "crm-kanban-card--saving" : ""
      } ${grabbed ? "ring-1 ring-[var(--crm-azur)]" : ""}`}
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
          {/* LE MEME PANNEAU QUE LA LISTE. Le nom menait a la fiche complete :
              pour noter un message vocal depuis le pipeline, il fallait quitter
              le pipeline — « les actions directes en mode pipeline, ca ne
              marche pas, il faut aller dans la vraie fiche ». Le panneau
              s'ouvre ici, le pipeline reste a l'ecran, et la fiche s'atteint
              depuis le bouton du panneau. */}
          <button
            type="button"
            className="min-w-0 w-full text-left"
            onClick={() => onOuvrir?.()}
            disabled={!onOuvrir}
            title={onOuvrir ? `Traiter ${card.name}` : undefined}
          >
            <div className="flex items-center gap-2">
              <span
                className="crm-ellipsis text-[15px] font-bold text-[var(--crm-text)]"
                title={card.name}
              >
                {card.name}
              </span>
              {card.recommendedPriority === "prioritaire" ? <Chip variant="gold">★</Chip> : null}
            </div>
            {/* TOUS les biens de la personne. Il n'y a plus qu'une carte par
                personne : c'est elle qui doit dire sur quoi elle porte, sans
                quoi Éric ressemblerait à un acquéreur d'un seul projet. */}
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
              {montrerProjet
                ? (card.properties.length > 0
                    ? card.properties
                    : card.propertyId && card.propertyLabel
                      ? [{ id: card.propertyId, label: card.propertyLabel }]
                      : []
                  ).map((p) => <BadgeProjet key={p.id} propertyId={p.id} label={p.label} />)
                : null}
              {card.city ? (
                <span className="crm-ellipsis text-xs text-[var(--crm-text-faint)]">
                  {card.city}
                </span>
              ) : null}
              {!card.propertyLabel ? (
                <span className="text-xs text-[var(--crm-text-faint)]">
                  Aucun projet rattaché
                </span>
              ) : null}
              {row ? (
                <span className="text-xs text-[var(--crm-text-faint)]">
                  Arrivé le {formatJour(row.createdAt)}
                </span>
              ) : null}
            </div>

            {/* LES MEMES INFORMATIONS QUE LA LISTE, DANS LE MEME ORDRE.
                La carte alignait quatre pastilles rouges et dorees — « Non
                affecte », « Sans action », « Nouvel interet » — la ou la liste
                ecrit calmement « Non affecte » dans sa colonne Responsable et
                « A programmer » dans Prochaine action. Trois d'entre elles
                etaient allumees sur presque toutes les cartes : « Nouvel
                interet » l'etait sur les 82 manifestations, puisque rien ne
                remet jamais ce statut a zero. Une alerte toujours vraie
                n'alerte de rien, elle masque celles qui comptent. */}
            {row ? (
              <dl className="crm-kanban-faits mt-2">
                <dt>Budget</dt>
                <dd>
                  {budget ? (
                    <span className="font-semibold text-[var(--crm-text)]">{budget}</span>
                  ) : (
                    <span className="text-[var(--crm-text-faint)]">Non renseigné</span>
                  )}
                </dd>

                <dt>Responsable</dt>
                <dd>
                  {row.assigneeNames.length > 0 ? (
                    <span className="crm-ellipsis">{row.assigneeNames.join(", ")}</span>
                  ) : (
                    <span className="text-[var(--crm-text-faint)]">Non affecté</span>
                  )}
                </dd>

                <dt>Prochaine action</dt>
                <dd>
                  {row.nextActionTitle ? (
                    <>
                      <span className="crm-ellipsis">{row.nextActionTitle}</span>
                      {row.nextActionAt ? (
                        <span
                          className={
                            row.overdue
                              ? "font-semibold text-[var(--crm-danger)]"
                              : "text-[var(--crm-text-faint)]"
                          }
                        >
                          {formatDateTime(row.nextActionAt)}
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-[var(--crm-text-faint)]">À programmer</span>
                  )}
                </dd>
              </dl>
            ) : null}
          </button>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {/* La qualification est ECRITE, comme en liste : jamais une
                couleur seule. */}
            {row ? (
              <span className={`crm-qualif crm-qualif--${QUALIFICATION_BADGE[row.qualification]}`}>
                {QUALIFICATION_LABELS[row.qualification]}
              </span>
            ) : null}
            {/* La SEULE pastille d'alerte qui reste, celle que la liste garde
                aussi : un rappel en retard est un fait, pas un etat permanent. */}
            {card.overdue ? <Chip variant="danger">En retard</Chip> : null}
          </div>

          {row ? (
            <ContactRapide
              numero={row.phoneMasked}
              email={row.emailMasked}
              className="mt-2"
              compact
            />
          ) : card.phoneMasked ? (
            <p className="mt-1 text-[11px] text-[var(--crm-text-faint)]">{card.phoneMasked}</p>
          ) : null}
        </div>
        {saving ? <span className="shrink-0 text-[11px] text-[var(--crm-azur)]">…</span> : null}
      </div>

      {grabbed ? (
        <p className="rounded-[6px] bg-[var(--crm-panel-2)] px-2 py-1 text-[11px] text-[var(--crm-azur)]">
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
            {/* Les colonnes pilotees par une action dediee figurent quand meme,
                desactivees et annotees : une liste amputee sans explication
                laissait croire a un bug. On dit pourquoi, au lieu de taire. */}
            {BUYER_KANBAN_COLUMNS.filter((s) => isProtectedBuyerStage(s)).map((s) => (
              <option key={s} value={s} disabled>
                {buyerStageLabels[s]} — par l&rsquo;action dédiée
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {notice ? (
        <div className="rounded-[8px] border border-[var(--crm-line-soft)] bg-[var(--crm-panel-2)] p-2">
          <p className="crm-wrap text-[11px] text-[var(--crm-text-dim)]">{notice.text}</p>
          {notice.action ? (
            <Link prefetch={false}
              href={`/crm/acquereurs/${card.buyerProfileId}${contexte}`}
              className="mt-1 inline-block text-[11px] text-[var(--crm-azur)] underline"
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

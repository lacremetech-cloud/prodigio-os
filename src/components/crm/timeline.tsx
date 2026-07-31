import type { CSSProperties } from "react";
import { formatDateTime } from "@/modules/crm/format";
import { timelineKindVisual, cssVarRef } from "@/modules/crm/status-visuals";
import type { TimelineEntry } from "@/modules/crm/timeline";

/**
 * Timeline « Activité & historique ». Structure en GRILLE robuste (colonne
 * marqueur + colonne `minmax(0,1fr)` de contenu) : le marqueur n'est jamais
 * superposé au texte, quel que soit le zoom. Chaque type d'événement porte une
 * icône + une couleur + un libellé (jamais la couleur seule).
 */
export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="crm-tl">
      {entries.map((e) => {
        const visual = timelineKindVisual(e.kind);
        return (
          <li key={e.key} className="crm-tl-item">
            <div className="crm-tl-rail" aria-hidden>
              <span
                className="crm-tl-dot"
                style={{ ["--tl-accent" as keyof CSSProperties]: cssVarRef(visual.cssVar) } as CSSProperties}
              >
                {visual.icon}
              </span>
            </div>
            <div className="crm-tl-body">
              <div className="crm-tl-head">
                <span className="crm-tl-title">{e.title}</span>
                <time className="crm-tl-date" dateTime={e.at}>
                  {formatDateTime(e.at)}
                  {e.author ? ` · ${e.author}` : ""}
                  {e.source === "audit" ? " · audit" : ""}
                </time>
              </div>
              {e.body ? <p className="crm-tl-text">{e.body}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

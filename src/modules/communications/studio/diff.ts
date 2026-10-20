/**
 * **Comparaison de deux versions de modèle.**
 *
 * Comparaison ligne à ligne, purement textuelle et déterministe. Aucune version
 * n'est modifiée : comparer est une lecture.
 */

export type DiffKind = "identique" | "ajout" | "suppression";

export interface DiffLine {
  kind: DiffKind;
  /** Numéro de ligne côté version de gauche (`null` pour un ajout). */
  left: number | null;
  /** Numéro de ligne côté version de droite (`null` pour une suppression). */
  right: number | null;
  text: string;
}

export interface FieldDiff {
  field: string;
  label: string;
  changed: boolean;
  lines: DiffLine[];
}

/**
 * Plus longue sous-séquence commune, en table de programmation dynamique.
 * Les contenus de modèles sont courts : la table complète est amplement
 * suffisante et reste simple à relire.
 */
function lcsLengths(a: readonly string[], b: readonly string[]): number[][] {
  const table: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  const at = (i: number, j: number): number => table[i]?.[j] ?? 0;
  for (let i = a.length - 1; i >= 0; i--) {
    const row = table[i];
    if (!row) continue;
    for (let j = b.length - 1; j >= 0; j--) {
      row[j] = a[i] === b[j] ? at(i + 1, j + 1) + 1 : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  return table;
}

/** Différence ligne à ligne entre deux textes. */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const table = lcsLengths(a, b);
  const at = (i: number, j: number): number => table[i]?.[j] ?? 0;
  const lines: DiffLine[] = [];

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      lines.push({ kind: "identique", left: i + 1, right: j + 1, text: a[i] ?? "" });
      i++;
      j++;
    } else if (at(i + 1, j) >= at(i, j + 1)) {
      lines.push({ kind: "suppression", left: i + 1, right: null, text: a[i] ?? "" });
      i++;
    } else {
      lines.push({ kind: "ajout", left: null, right: j + 1, text: b[j] ?? "" });
      j++;
    }
  }
  while (i < a.length) {
    lines.push({ kind: "suppression", left: i + 1, right: null, text: a[i] ?? "" });
    i++;
  }
  while (j < b.length) {
    lines.push({ kind: "ajout", left: null, right: j + 1, text: b[j] ?? "" });
    j++;
  }
  return lines;
}

export interface ComparableTemplate {
  version: number;
  name: string;
  subject: string | null;
  body: string;
  allowedVariables: readonly string[];
}

/** Comparaison champ par champ de deux versions d'un même modèle. */
export function compareTemplates(
  left: ComparableTemplate,
  right: ComparableTemplate,
): FieldDiff[] {
  const fields: { field: string; label: string; left: string; right: string }[] = [
    { field: "name", label: "Nom", left: left.name, right: right.name },
    { field: "subject", label: "Sujet", left: left.subject ?? "", right: right.subject ?? "" },
    { field: "body", label: "Contenu", left: left.body, right: right.body },
    {
      field: "allowedVariables",
      label: "Variables déclarées",
      left: [...left.allowedVariables].sort().join("\n"),
      right: [...right.allowedVariables].sort().join("\n"),
    },
  ];

  return fields.map((f) => {
    const lines = diffLines(f.left, f.right);
    return {
      field: f.field,
      label: f.label,
      changed: lines.some((l) => l.kind !== "identique"),
      lines,
    };
  });
}

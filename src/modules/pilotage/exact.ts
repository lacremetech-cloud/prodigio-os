/**
 * Arithmétique EXACTE du pilotage : des fractions d'entiers, jamais de virgule
 * flottante.
 *
 * POURQUOI. Le net vendeur d'une villa à 1 400 000 € FAI et 3,75 % vaut
 * 1 400 000 × 80 / 83 = 1 349 397,5903614… € : il ne tombe pas juste, et ne
 * tombera jamais juste. Arrondir à chaque étape ferait dériver la commission de
 * quelques euros selon l'ordre des opérations ; additionner les lots d'un
 * programme après les avoir arrondis un par un donne 1 à 2 € d'écart sur le
 * total. La règle validée par Victor le 12/11/2026 est donc : calcul exact,
 * arrondi SEULEMENT à l'affichage.
 *
 * Les montants sont en CENTIMES (comme en base) ; une fraction de centimes est
 * un montant exact. `BigInt` garde des entiers sans limite de taille.
 */

/** Un nombre rationnel exact `n / d`, toujours réduit, `d > 0`. */
export interface Exact {
  readonly n: bigint;
  readonly d: bigint;
}

const ZERO = BigInt(0);
const UN = BigInt(1);
const DEUX = BigInt(2);
const DIX = BigInt(10);

function absolu(x: bigint): bigint {
  return x < ZERO ? -x : x;
}

function pgcd(a: bigint, b: bigint): bigint {
  let x = absolu(a);
  let y = absolu(b);
  while (y !== ZERO) {
    const r = x % y;
    x = y;
    y = r;
  }
  return x === ZERO ? UN : x;
}

/** Construit une fraction réduite ; refuse un dénominateur nul. */
export function fraction(n: bigint, d: bigint = UN): Exact {
  if (d === ZERO) throw new RangeError("division par zéro");
  const signe = d < ZERO ? -UN : UN;
  const g = pgcd(n, d);
  return { n: (signe * n) / g, d: (signe * d) / g };
}

/** Un entier (centimes, par exemple) en fraction exacte. */
export function entier(x: number | bigint): Exact {
  if (typeof x === "number" && !Number.isSafeInteger(x)) {
    throw new RangeError(`entier attendu : ${x}`);
  }
  return fraction(BigInt(x));
}

/**
 * Un décimal lu en base (`numeric`) en fraction exacte.
 *
 * PostgREST renvoie un `numeric` comme nombre JSON (3.75) ou comme texte
 * ("3.7500") selon la configuration : les deux sont acceptés. Un nombre JS est
 * relu à `maxDecimales` décimales — la base n'en stocke pas davantage (colonne
 * `numeric(6,4)` pour un taux, `numeric(5,2)` pour une part) — ce qui rend sa
 * valeur décimale exacte au lieu de son approximation binaire.
 *
 * Renvoie `null` pour une valeur absente ou illisible : une donnée manquante
 * reste manquante, elle ne devient jamais 0.
 */
export function decimal(
  valeur: number | string | null | undefined,
  maxDecimales: number,
): Exact | null {
  if (valeur == null) return null;
  let texte: string;
  if (typeof valeur === "number") {
    if (!Number.isFinite(valeur)) return null;
    texte = valeur.toFixed(maxDecimales);
  } else {
    texte = valeur.trim();
  }
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(texte);
  if (!m) return null;
  const partieDecimale = m[3] ?? "";
  if (partieDecimale.length > maxDecimales) return null;
  const chiffres = BigInt(`${m[2]}${partieDecimale}` || "0");
  const signe = m[1] === "-" ? -UN : UN;
  return fraction(signe * chiffres, DIX ** BigInt(partieDecimale.length));
}

export function plus(a: Exact, b: Exact): Exact {
  return fraction(a.n * b.d + b.n * a.d, a.d * b.d);
}

export function moins(a: Exact, b: Exact): Exact {
  return fraction(a.n * b.d - b.n * a.d, a.d * b.d);
}

export function fois(a: Exact, b: Exact): Exact {
  return fraction(a.n * b.n, a.d * b.d);
}

export function divise(a: Exact, b: Exact): Exact {
  if (b.n === ZERO) throw new RangeError("division par zéro");
  return fraction(a.n * b.d, a.d * b.n);
}

export function egal(a: Exact, b: Exact): boolean {
  return a.n === b.n && a.d === b.d;
}

export function somme(valeurs: readonly Exact[]): Exact {
  return valeurs.reduce(plus, fraction(ZERO));
}

/** Un pourcentage (3,75 %) en taux (3,75 / 100). */
export function pourcent(x: Exact): Exact {
  return fraction(x.n, x.d * BigInt(100));
}

/**
 * L'entier le plus proche, demi arrondi en s'éloignant de zéro (l'arrondi
 * « commercial » : 0,5 € → 1 €). C'est le SEUL arrondi du pilotage, et il ne
 * sert qu'à afficher.
 */
export function arrondi(x: Exact): bigint {
  const signe = x.n < ZERO ? -UN : UN;
  return (signe * ((DEUX * absolu(x.n) + x.d) / (DEUX * x.d)));
}

/** Des centimes exacts, arrondis au centime, en nombre affichable. */
export function centimesArrondis(centimes: Exact): number {
  return Number(arrondi(centimes));
}

/** Des centimes exacts, arrondis à l'euro, en nombre d'euros affichable. */
export function eurosArrondis(centimes: Exact): number {
  return Number(arrondi(fraction(centimes.n, centimes.d * BigInt(100))));
}

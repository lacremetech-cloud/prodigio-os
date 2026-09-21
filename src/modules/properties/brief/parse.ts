/**
 * Analyseur de brief — cœur déterministe de la Fabrique « Créer un bien à partir
 * d'un brief ».
 *
 * Contrat (docs/23-FABRIQUE-BRIEF.md) :
 *  - fonction **pure**, sans fournisseur d'IA, sans appel réseau, sans écriture ;
 *  - ne **jamais inventer** une valeur : tout ce qui n'est pas compris est
 *    restitué tel quel dans « Non reconnu » ;
 *  - ne **jamais trancher** entre deux informations contradictoires : le champ
 *    est retiré de la fiche et la contradiction est affichée ;
 *  - une **année de rénovation n'est jamais une année de construction**.
 *
 * L'analyse ne produit qu'une proposition : la fiche reste éditée puis validée
 * par un humain avant la moindre écriture en base.
 */

// -----------------------------------------------------------------------------
// Champs reconnus
// -----------------------------------------------------------------------------

export const BRIEF_FIELDS = [
  "projectName",
  "propertyType",
  "addressLine",
  "locationCity",
  "locationPostalCode",
  "locationCountry",
  "priceEur",
  "surfaceM2",
  "landM2",
  "rooms",
  "bedrooms",
  "yearBuilt",
  "renovationYear",
  "organizationName",
  "links",
  "features",
] as const;

export type BriefFieldKey = (typeof BRIEF_FIELDS)[number];

export const BRIEF_FIELD_LABELS: Record<BriefFieldKey, string> = {
  projectName: "Nom du bien",
  propertyType: "Type de bien",
  addressLine: "Adresse",
  locationCity: "Ville",
  locationPostalCode: "Code postal",
  locationCountry: "Pays",
  priceEur: "Prix",
  surfaceM2: "Surface habitable",
  landM2: "Terrain / parcelle",
  rooms: "Pièces",
  bedrooms: "Chambres",
  yearBuilt: "Année de construction",
  renovationYear: "Année de rénovation",
  organizationName: "Organisation porteuse",
  links: "Liens utiles",
  features: "Caractéristiques",
};

/**
 * Champs **indispensables** pour créer un brouillon : sans eux la Fabrique ne
 * peut pas écrire. Tout le reste est utile mais facultatif.
 */
export const BRIEF_REQUIRED_FIELDS: BriefFieldKey[] = ["projectName", "organizationName"];

/** Champs signalés comme « manquants » quand ils sont absents du brief. */
const BRIEF_EXPECTED_FIELDS: BriefFieldKey[] = [
  "projectName",
  "propertyType",
  "addressLine",
  "locationCity",
  "locationPostalCode",
  "priceEur",
  "surfaceM2",
  "landM2",
  "rooms",
  "bedrooms",
  "yearBuilt",
  "organizationName",
];

/** Champs pouvant porter plusieurs valeurs : on cumule au lieu de contredire. */
const MULTI_VALUE_FIELDS = new Set<BriefFieldKey>(["links", "features"]);

// -----------------------------------------------------------------------------
// Résultat
// -----------------------------------------------------------------------------

export interface RecognisedField {
  key: BriefFieldKey;
  label: string;
  /** Valeur exploitable : nombre, texte, ou liste pour les champs multivalués. */
  value: string | number | string[];
  /** Rendu lisible pour la revue humaine (prix formaté, surface avec unité…). */
  display: string;
  /** Extrait du brief d'où la valeur est tirée — la preuve, jamais reformulée. */
  source: string;
}

export interface MissingField {
  key: BriefFieldKey;
  label: string;
  required: boolean;
}

export interface BriefContradiction {
  key: BriefFieldKey;
  label: string;
  /** Les valeurs concurrentes, avec leur extrait d'origine. */
  values: { display: string; source: string }[];
}

/** Fiche structurée pré-remplie — uniquement des valeurs reconnues et non contredites. */
export interface BriefDraft {
  projectName: string | null;
  propertyType: string | null;
  addressLine: string | null;
  locationCity: string | null;
  locationPostalCode: string | null;
  locationCountry: string | null;
  priceEur: number | null;
  surfaceM2: number | null;
  landM2: number | null;
  rooms: number | null;
  bedrooms: number | null;
  yearBuilt: number | null;
  renovationYear: number | null;
  organizationName: string | null;
  links: string[];
  features: string[];
}

export interface BriefAnalysis {
  recognised: RecognisedField[];
  missing: MissingField[];
  contradictions: BriefContradiction[];
  /** Passages du brief qu'aucune règle n'a su interpréter, restitués tels quels. */
  unrecognised: string[];
  draft: BriefDraft;
}

export function emptyBriefDraft(): BriefDraft {
  return {
    projectName: null,
    propertyType: null,
    addressLine: null,
    locationCity: null,
    locationPostalCode: null,
    locationCountry: null,
    priceEur: null,
    surfaceM2: null,
    landM2: null,
    rooms: null,
    bedrooms: null,
    yearBuilt: null,
    renovationYear: null,
    organizationName: null,
    links: [],
    features: [],
  };
}

// -----------------------------------------------------------------------------
// Normalisation
// -----------------------------------------------------------------------------

/** Espaces insécables, fines et tabulations ramenés à l'espace simple. */
function normalizeSpaces(input: string): string {
  return input
    .normalize("NFC")
    .replace(/[   \t]/g, " ")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"');
}

/** Minuscule sans accent — pour comparer des libellés, jamais pour stocker. */
function fold(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// -----------------------------------------------------------------------------
// Nombres, montants, surfaces
// -----------------------------------------------------------------------------

/**
 * Lit un nombre écrit à la française ou à l'anglaise : « 1 490 000 »,
 * « 1.490.000 », « 1490000 », « 1,49 » ou « 160 ». Les séparateurs de milliers
 * (espace, point, apostrophe) ne sont retirés que s'ils découpent des groupes de
 * trois chiffres : « 1.49 » reste un décimal, « 1.490 » un millier.
 */
export function parseFrenchNumber(raw: string): number | null {
  const text = normalizeSpaces(raw).trim().replace(/'/g, " ");
  if (!text) return null;

  // 1 490 000,50 — groupes de milliers puis décimale française.
  const grouped = /^(\d{1,3}(?:[ .]\d{3})+)(?:,(\d+))?$/.exec(text);
  if (grouped?.[1]) {
    const whole = grouped[1].replace(/[ .]/g, "");
    const decimals = grouped[2];
    return Number(decimals ? `${whole}.${decimals}` : whole);
  }

  // 1490000 / 1,49 / 1.49 / 160
  const plain = /^(\d+)(?:[.,](\d+))?$/.exec(text);
  if (plain?.[1]) {
    const decimals = plain[2];
    return Number(decimals ? `${plain[1]}.${decimals}` : plain[1]);
  }

  return null;
}

/**
 * Lit un montant en euros : « 1 490 000 € », « 1.490.000€ », « 1490000 EUR »,
 * « 1,49 M€ », « 1.49 million d'euros », « 890 k€ ». Renvoie des euros entiers.
 */
export function parseEuroAmount(raw: string): number | null {
  let text = normalizeSpaces(raw).trim();
  // On retire les symboles et mentions monétaires, en mémorisant un multiplicateur.
  let multiplier = 1;
  const magnitude = /(\d[\d .,']*)\s*(m|k)\s*(?:€|eur(?:os?)?)?\b/i.exec(text);
  const worded = /(\d[\d .,']*)\s*(millions?|milliers?)\b/i.exec(text);
  if (worded?.[1] && worded[2]) {
    multiplier = /million/i.test(worded[2]) ? 1_000_000 : 1_000;
    text = worded[1];
  } else if (magnitude?.[1] && magnitude[2]) {
    multiplier = magnitude[2].toLowerCase() === "m" ? 1_000_000 : 1_000;
    text = magnitude[1];
  } else {
    text = text.replace(/€|\beuros?\b|\beur\b/gi, " ");
  }

  const value = parseFrenchNumber(text.trim());
  if (value === null) return null;
  const amount = Math.round(value * multiplier);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

/** Lit une surface : « 160 m² », « 160 m2 », « 160m² », « 160 mètres carrés ». */
export function parseSurface(raw: string): number | null {
  const text = normalizeSpaces(raw).trim();
  const withUnit = /(\d[\d .,']*)\s*(?:m\s*[²2]|m[²2]|metres?\s+carres?|mètres?\s+carrés?|sqm)/i.exec(
    text,
  );
  const value = parseFrenchNumber((withUnit?.[1] ?? text).trim());
  if (value === null || value <= 0) return null;
  return value;
}

/** Lit un entier simple (pièces, chambres). */
function parseCount(raw: string): number | null {
  const match = /(\d{1,4})/.exec(normalizeSpaces(raw));
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value >= 0 && value <= 1000 ? value : null;
}

/** Lit une année plausible (1000–2100). */
function parseYear(raw: string): number | null {
  const match = /\b(1\d{3}|20\d{2}|21\d{2})\b/.exec(normalizeSpaces(raw));
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return value >= 1000 && value <= 2100 ? value : null;
}

// -----------------------------------------------------------------------------
// Libellés clé/valeur reconnus
// -----------------------------------------------------------------------------

type ValueReader = (raw: string) => string | number | string[] | null;

interface FieldRule {
  key: BriefFieldKey;
  /** Libellés acceptés, repliés (sans accent, minuscules). */
  labels: string[];
  read: ValueReader;
}

const readText = (max: number): ValueReader => (raw) => {
  const value = normalizeSpaces(raw).trim().replace(/\s+/g, " ").replace(/[.;,]+$/, "");
  if (!value || value.length > max) return null;
  // « à définir », « n/a », « ? » ne sont pas des valeurs : on ne les invente pas.
  if (/^(a definir|a confirmer|n\/?a|inconnu|non communique|\?+|-+)$/i.test(fold(value))) {
    return null;
  }
  return value;
};

const readList: ValueReader = (raw) => {
  const items = normalizeSpaces(raw)
    .split(/[,;•·]|\s-\s/)
    .map((item) => item.trim().replace(/[.;,]+$/, ""))
    .filter((item) => item.length > 1 && item.length <= 160);
  return items.length ? items : null;
};

const readUrls: ValueReader = (raw) => {
  const found = extractUrls(normalizeSpaces(raw));
  return found.length ? found : null;
};

const FIELD_RULES: FieldRule[] = [
  {
    key: "projectName",
    labels: ["nom", "nom du bien", "nom du projet", "projet", "titre", "titre du bien", "bien"],
    read: readText(200),
  },
  {
    key: "propertyType",
    labels: ["type", "type de bien", "typologie", "nature du bien"],
    read: readText(120),
  },
  {
    key: "addressLine",
    labels: ["adresse", "adresse du bien", "localisation", "situation", "rue"],
    read: readText(300),
  },
  { key: "locationCity", labels: ["ville", "commune", "localite"], read: readText(160) },
  {
    key: "locationPostalCode",
    labels: ["code postal", "cp", "codepostal"],
    read: (raw) => {
      const match = /\b(\d{4,6})\b/.exec(normalizeSpaces(raw));
      return match?.[1] ?? null;
    },
  },
  { key: "locationCountry", labels: ["pays"], read: readText(120) },
  {
    key: "priceEur",
    labels: ["prix", "prix de vente", "prix affiche", "prix de presentation", "tarif", "montant"],
    read: (raw) => parseEuroAmount(raw),
  },
  {
    key: "surfaceM2",
    labels: [
      "surface",
      "surface habitable",
      "habitable",
      "surface interieure",
      "superficie",
      "surface du bien",
    ],
    read: (raw) => parseSurface(raw),
  },
  {
    key: "landM2",
    labels: [
      "terrain",
      "parcelle",
      "surface du terrain",
      "surface terrain",
      "surface de la parcelle",
      "jardin",
      "foncier",
    ],
    read: (raw) => parseSurface(raw),
  },
  { key: "rooms", labels: ["pieces", "nombre de pieces", "nb de pieces"], read: parseCount },
  {
    key: "bedrooms",
    labels: ["chambres", "nombre de chambres", "nb de chambres"],
    read: parseCount,
  },
  {
    key: "yearBuilt",
    labels: [
      "annee de construction",
      "annee construction",
      "construction",
      "construit en",
      "date de construction",
    ],
    read: parseYear,
  },
  {
    key: "renovationYear",
    labels: [
      "annee de renovation",
      "annee renovation",
      "renovation",
      "renove en",
      "date de renovation",
      "rehabilitation",
    ],
    read: parseYear,
  },
  {
    key: "organizationName",
    labels: [
      "organisation",
      "organisation porteuse",
      "agence",
      "agence porteuse",
      "partenaire",
      "societe",
      "enseigne",
    ],
    read: readText(200),
  },
  {
    key: "links",
    labels: ["lien", "liens", "liens utiles", "url", "site", "site web", "brochure", "video"],
    read: readUrls,
  },
  {
    key: "features",
    labels: [
      "caracteristiques",
      "atouts",
      "points forts",
      "prestations",
      "equipements",
      "specificites",
    ],
    read: readList,
  },
];

const RULE_BY_LABEL = new Map<string, FieldRule>();
for (const rule of FIELD_RULES) {
  for (const label of rule.labels) RULE_BY_LABEL.set(fold(label), rule);
}

// -----------------------------------------------------------------------------
// Extracteurs de prose
// -----------------------------------------------------------------------------

const PROPERTY_TYPE_WORDS = [
  "villa",
  "maison",
  "appartement",
  "mas",
  "bastide",
  "domaine",
  "chalet",
  "loft",
  "hotel particulier",
  "propriete",
  "penthouse",
  "duplex",
  "terrain",
];

const FEATURE_WORDS = [
  "piscine",
  "vue mer",
  "vue panoramique",
  "jardin",
  "garage",
  "terrasse",
  "ascenseur",
  "cave",
  "climatisation",
  "cheminee",
  "dependance",
  "parking",
  "pool house",
  "jacuzzi",
  "spa",
  "tennis",
  "cuisine equipee",
];

const STREET_WORDS =
  "avenue|av\\.|rue|boulevard|bd\\.?|chemin|impasse|allee|allée|route|place|quai|cours|traverse|montee|montée";

function extractUrls(text: string): string[] {
  const matches = text.match(/https?:\/\/[^\s,;)"']+/gi) ?? [];
  return matches.map((url) => url.replace(/[.,;)]+$/, ""));
}

interface Hit {
  key: BriefFieldKey;
  value: string | number | string[];
  source: string;
}

/** Applique les règles de prose à un segment ; renvoie les valeurs trouvées. */
function extractFromProse(segment: string): Hit[] {
  const hits: Hit[] = [];
  const folded = fold(segment);
  const push = (key: BriefFieldKey, value: string | number | string[] | null) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value) && value.length === 0) return;
    hits.push({ key, value, source: segment });
  };

  // Liens.
  const urls = extractUrls(segment);
  if (urls.length) push("links", urls);

  // Prix : « 1 490 000 € », « affiché à 1,49 M€ », « prix de 890 000 euros ».
  const price = /(\d[\d .,']*)\s*(?:(m|k)\s*)?(?:€|eur(?:os?)?\b|millions? d'euros?)/i.exec(segment);
  if (price) push("priceEur", parseEuroAmount(price[0]));

  // Surfaces : on distingue l'habitable du terrain par le mot qui précède.
  const surfaceRe =
    /([\wéèêàûô' ]{0,28}?)(\d[\d .,']*)\s*(?:m\s*[²2]|mètres?\s+carrés?|metres?\s+carres?)/gi;
  let surfaceMatch: RegExpExecArray | null;
  while ((surfaceMatch = surfaceRe.exec(segment)) !== null) {
    const context = fold(surfaceMatch[1] ?? "");
    const value = parseFrenchNumber(surfaceMatch[2] ?? "");
    if (value === null) continue;
    const isLand = /terrain|parcelle|jardin|foncier|exterieur/.test(context);
    push(isLand ? "landM2" : "surfaceM2", value);
  }
  // « terrain de 400 m² » est capté ci-dessus ; « parcelle : 400 » sans unité ne l'est pas.

  // Pièces / chambres.
  const rooms = /(\d{1,3})\s*(?:pièces?|pieces?|p\b)/i.exec(segment);
  if (rooms?.[1]) push("rooms", parseCount(rooms[1]));
  const bedrooms = /(\d{1,3})\s*(?:chambres?|ch\b)/i.exec(segment);
  if (bedrooms?.[1]) push("bedrooms", parseCount(bedrooms[1]));

  // Années : la rénovation d'abord, pour qu'elle ne soit JAMAIS lue comme une
  // année de construction (règle métier explicite).
  const renovation = /(?:rénov|renov|réhabilit|rehabilit)\p{L}*\s*(?:en|de|du|:|,)?\s*(\d{4})/iu.exec(
    segment,
  );
  if (renovation?.[1]) push("renovationYear", parseYear(renovation[1]));
  const built =
    /(?:construit|construction|bâti|bati|édifié|edifie|datant|date)\p{L}*\s*(?:en|de|du|:|,)?\s*(\d{4})/iu.exec(
      segment,
    );
  if (built?.[1]) push("yearBuilt", parseYear(built[1]));

  // Code postal + ville accolés : « 13260 Cassis » ou « Cassis (13260) ».
  const cpCity = /\b(\d{5})\s+([A-ZÀ-Ý][\p{L}'’-]+(?:[ -][A-ZÀ-Ý]?[\p{L}'’-]+){0,3})/u.exec(segment);
  const cityCp = /\b([A-ZÀ-Ý][\p{L}'’-]+(?:[ -][A-ZÀ-Ý]?[\p{L}'’-]+){0,3})\s*\(\s*(\d{5})\s*\)/u.exec(
    segment,
  );
  let city: string | null = null;
  if (cpCity?.[1] && cpCity[2]) {
    push("locationPostalCode", cpCity[1]);
    city = cpCity[2].trim();
  } else if (cityCp?.[1] && cityCp[2]) {
    push("locationPostalCode", cityCp[2]);
    city = cityCp[1].trim();
  }
  if (city) push("locationCity", city);

  // Adresse : numéro + type de voie.
  const address = new RegExp(
    `\\b(\\d{1,4}\\s*(?:bis|ter)?\\s*,?\\s*(?:${STREET_WORDS})\\b[^,.;\\n]*)`,
    "i",
  ).exec(segment);
  if (address?.[1]) {
    let line = address[1].trim().replace(/\s+/g, " ");
    // On retire un code postal et/ou une ville collés en fin de ligne.
    line = line.replace(/\s*\b\d{5}\b\s*.*$/, "").trim();
    if (city) {
      const cityRe = new RegExp(`\\s+${city.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
      line = line.replace(cityRe, "").trim();
    }
    if (line) push("addressLine", line);
  }

  // Type de bien.
  for (const word of PROPERTY_TYPE_WORDS) {
    if (new RegExp(`\\b${word}\\b`).test(folded)) {
      push("propertyType", word.charAt(0).toUpperCase() + word.slice(1));
      break;
    }
  }

  // Caractéristiques courantes.
  const features: string[] = [];
  for (const word of FEATURE_WORDS) {
    if (new RegExp(`\\b${word}\\b`).test(folded)) features.push(word);
  }
  if (features.length) push("features", features);

  return hits;
}

// -----------------------------------------------------------------------------
// Découpage du brief
// -----------------------------------------------------------------------------

/** Découpe le brief en segments analysables : lignes, puces, puis phrases. */
function splitSegments(text: string): string[] {
  const segments: string[] = [];
  for (const rawLine of normalizeSpaces(text).split(/\r?\n/)) {
    const line = rawLine.replace(/^\s*[-–—•*·]\s*/, "").trim();
    if (!line) continue;
    // Une ligne courte ou étiquetée reste entière ; une prose longue est
    // découpée en phrases pour que « Non reconnu » reste lisible.
    if (line.length <= 140 || /^[^:]{1,40}\s*[:=]/.test(line)) {
      segments.push(line);
      continue;
    }
    for (const sentence of line.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý])/)) {
      const trimmed = sentence.trim();
      if (trimmed) segments.push(trimmed);
    }
  }
  return segments;
}

/** Vrai si le segment ne porte aucune information (titre de section, ponctuation). */
function isNoise(segment: string): boolean {
  const folded = fold(segment);
  if (folded.length < 3) return true;
  if (/^[-=_*#.\s]+$/.test(folded)) return true;
  return /^(brief|bien|infos?|informations?|details?|divers|notes?|resume)\s*:?$/.test(folded);
}

// -----------------------------------------------------------------------------
// Rendu lisible
// -----------------------------------------------------------------------------

const euroFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("fr-FR");

export function displayValue(key: BriefFieldKey, value: string | number | string[]): string {
  if (Array.isArray(value)) return value.join(" · ");
  switch (key) {
    case "priceEur":
      return euroFormatter.format(Number(value));
    case "surfaceM2":
    case "landM2":
      return `${numberFormatter.format(Number(value))} m²`;
    default:
      return String(value);
  }
}

/** Clé de comparaison : deux écritures d'une même valeur ne sont pas une contradiction. */
function comparisonKey(key: BriefFieldKey, value: string | number | string[]): string {
  if (Array.isArray(value)) return value.map((item) => fold(item)).sort().join("|");
  if (typeof value === "number") return String(value);
  return fold(value);
}

// -----------------------------------------------------------------------------
// Analyse
// -----------------------------------------------------------------------------

/**
 * Analyse un brief libre et renvoie ce qui est reconnu, manquant, contradictoire
 * et incompris. **N'écrit rien** et n'invente aucune valeur.
 */
export function parseBrief(input: string): BriefAnalysis {
  const analysis: BriefAnalysis = {
    recognised: [],
    missing: [],
    contradictions: [],
    unrecognised: [],
    draft: emptyBriefDraft(),
  };
  if (typeof input !== "string" || !input.trim()) {
    analysis.missing = BRIEF_EXPECTED_FIELDS.map(toMissing);
    return analysis;
  }

  const hitsByKey = new Map<BriefFieldKey, Hit[]>();
  const record = (hit: Hit) => {
    const list = hitsByKey.get(hit.key);
    if (list) list.push(hit);
    else hitsByKey.set(hit.key, [hit]);
  };

  for (const segment of splitSegments(input)) {
    if (isNoise(segment)) continue;

    const pair = /^([^:=]{1,48}?)\s*[:=]\s*(.+)$/.exec(segment);
    if (pair?.[1] && pair[2]) {
      const label = pair[1];
      const rawValue = pair[2];
      const rule = RULE_BY_LABEL.get(fold(label));
      if (rule) {
        const value = rule.read(rawValue);
        if (value === null) {
          // Étiquette connue mais valeur illisible : on ne devine pas.
          analysis.unrecognised.push(segment);
        } else {
          record({ key: rule.key, value, source: segment });
          // Une adresse complète porte souvent aussi le code postal et la ville.
          if (rule.key === "addressLine") {
            for (const extra of extractFromProse(rawValue)) {
              if (extra.key === "locationPostalCode" || extra.key === "locationCity") {
                record({ ...extra, source: segment });
              }
            }
          }
        }
        continue;
      }
      // Étiquette inconnue : le segment entier part en « Non reconnu ».
      analysis.unrecognised.push(segment);
      continue;
    }

    const hits = extractFromProse(segment);
    if (hits.length === 0) {
      analysis.unrecognised.push(segment);
      continue;
    }
    for (const hit of hits) record(hit);
  }

  // Consolidation : contradiction, cumul, fiche.
  for (const key of BRIEF_FIELDS) {
    const hits = hitsByKey.get(key);
    if (!hits || hits.length === 0) continue;

    if (MULTI_VALUE_FIELDS.has(key)) {
      const merged: string[] = [];
      const seen = new Set<string>();
      for (const hit of hits) {
        const values = Array.isArray(hit.value) ? hit.value : [String(hit.value)];
        for (const item of values) {
          const normalized = fold(item);
          if (!normalized || seen.has(normalized)) continue;
          seen.add(normalized);
          merged.push(item);
        }
      }
      if (!merged.length) continue;
      assignDraft(analysis.draft, key, merged);
      analysis.recognised.push({
        key,
        label: BRIEF_FIELD_LABELS[key],
        value: merged,
        display: displayValue(key, merged),
        source: hits[0]?.source ?? "",
      });
      continue;
    }

    const distinct = new Map<string, Hit>();
    for (const hit of hits) {
      const comparison = comparisonKey(key, hit.value);
      if (!distinct.has(comparison)) distinct.set(comparison, hit);
    }

    if (distinct.size > 1) {
      analysis.contradictions.push({
        key,
        label: BRIEF_FIELD_LABELS[key],
        values: [...distinct.values()].map((hit) => ({
          display: displayValue(key, hit.value),
          source: hit.source,
        })),
      });
      continue; // Jamais de choix arbitraire : le champ reste vide.
    }

    const hit = [...distinct.values()][0];
    if (!hit) continue;
    assignDraft(analysis.draft, key, hit.value);
    analysis.recognised.push({
      key,
      label: BRIEF_FIELD_LABELS[key],
      value: hit.value,
      display: displayValue(key, hit.value),
      source: hit.source,
    });
  }

  const filled = new Set(analysis.recognised.map((field) => field.key));
  analysis.missing = BRIEF_EXPECTED_FIELDS.filter((key) => !filled.has(key)).map(toMissing);

  return analysis;
}

function toMissing(key: BriefFieldKey): MissingField {
  return {
    key,
    label: BRIEF_FIELD_LABELS[key],
    required: BRIEF_REQUIRED_FIELDS.includes(key),
  };
}

function assignDraft(
  draft: BriefDraft,
  key: BriefFieldKey,
  value: string | number | string[],
): void {
  switch (key) {
    case "links":
    case "features":
      draft[key] = Array.isArray(value) ? value : [String(value)];
      return;
    case "priceEur":
    case "surfaceM2":
    case "landM2":
    case "rooms":
    case "bedrooms":
    case "yearBuilt":
    case "renovationYear":
      draft[key] = typeof value === "number" ? value : null;
      return;
    default:
      draft[key] = typeof value === "string" ? value : String(value);
  }
}

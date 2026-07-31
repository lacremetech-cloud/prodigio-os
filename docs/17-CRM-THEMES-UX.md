# 17 — CRM : thèmes, couleurs sémantiques, lisibilité et timeline (V1.2)

Amélioration **systémique** du design system du CRM interne : vrai mode
clair / sombre / système, tokens sémantiques thème-adaptatifs, couleurs métier
centralisées, et correction **structurelle** de la timeline. UI/UX uniquement —
**aucune migration, aucune logique métier modifiée**, périmètre limité aux
interfaces privées `/crm` (les pages publiques et le funnel ne sont pas
redessinés).

---

## 1. Cause exacte du chevauchement de la timeline

Le marqueur de chaque entrée (`.crm-timeline-dot`) était en
`position: absolute; left: 0` **à l'intérieur du même conteneur** que le texte,
lequel n'avait **aucun décalage** pour dégager le point. Le point (11 px) se
superposait donc à la **première lettre** du titre (« Changement » → « hangement »,
« Appel » → « ppel »). Le `padding-left` du conteneur décalait le bloc entier
(point **et** texte ensemble), sans jamais séparer l'un de l'autre.

**Correction structurelle** (aucun décalage arbitraire) : chaque entrée est une
**grille** à deux colonnes —

```
grid-template-columns: 26px minmax(0, 1fr);
```

- colonne 1 : le marqueur + la ligne verticale de liaison (`.crm-tl-rail`) ;
- colonne 2 : le contenu (`.crm-tl-body`, `minmax(0, 1fr)` → passe à la ligne).

Le marqueur et le texte occupant des **cellules distinctes**, la superposition
est structurellement impossible, quel que soit le zoom (125 / 150 / 200 %) ou la
largeur. La ligne verticale est centrée dans la colonne du rail ; le dernier
élément la masque. La date/l'auteur sont dans un en-tête `flex-wrap` : à droite
du titre sur desktop, sous le contenu sur mobile. Un test de structure garantit
que `.crm-tl-dot` n'est **jamais** dans `.crm-tl-body`.

Chaque type d'événement (appel, e-mail, rendez-vous, note, stade, segment,
affectation, résultat, estimation, éligibilité, mandat, document, tâche, audit)
porte **icône + couleur + libellé** — jamais la couleur seule.

---

## 2. Architecture du système de thème

Trois préférences : **Sombre** (défaut), **Clair**, **Système**.

- **Persistance** : cookie `crm-theme` (1 an, `SameSite=Lax`), lisible côté
  serveur. Aucune migration ; survit au rechargement et à une nouvelle session.
- **Pas de flash, pas d'erreur d'hydratation** :
  1. le layout `/crm` lit le cookie et rend déjà `.crm-root[data-crm-theme=…]`
     avec `color-scheme` (bon thème dès le HTML serveur, cas clair/sombre) ;
  2. un **script en ligne** (premier enfant de `.crm-root`, exécuté avant le
     premier paint) résout le cas « système » via `matchMedia` et corrige
     l'attribut ; il est **statique** (aucune donnée dynamique) → pas de
     divergence d'hydratation, et `.crm-root` porte `suppressHydrationWarning` ;
  3. un `ThemeProvider` (client) applique ensuite l'attribut via un **effet**
     (jamais via le rendu React), suit `prefers-color-scheme` avec
     `useSyncExternalStore` en mode système, et écrit le cookie.
- **`color-scheme`** est posé sur `.crm-root` (formulaires, scrollbars natifs
  adaptés) — **scopé au CRM**, sans toucher aux pages publiques.
- **Sélecteur accessible** : `radiogroup` de boutons radio natifs (navigation
  clavier, état annoncé), libellé + icône. Dans `/crm/parametres` → **Apparence**.

Le thème est porté par `.crm-root[data-crm-theme="light|dark"]` (imbriqué) : les
tokens redéfinis y surchargent **le sous-arbre CRM** uniquement.

---

## 3. Palette sémantique

Les composants ne référencent **jamais** une couleur brute — uniquement des
variables CSS, déclinées en **sombre** et **clair** avec des contrastes conformes
(pas de noir absolu partout, pas de gris trop proches, texte secondaire relevé,
doré assombri sur fond clair, aucune couleur néon).

| Rôle | Token |
|---|---|
| Canvas / surfaces | `--crm-bg`, `--crm-panel`, `--crm-panel-2`, `--crm-elevated` |
| Bordures | `--crm-line` (forte), `--crm-line-soft` (douce) |
| Textes | `--crm-text`, `--crm-text-dim`, `--crm-text-faint` |
| Accent Prodigio | `--crm-gold`, `--crm-gold-strong` |
| Focus | `--crm-focus` |
| Sémantiques | `--crm-info`, `--crm-success`, `--crm-warning`, `--crm-danger`, `--crm-priority` |

**Couleurs métier centralisées** (`src/modules/crm/status-visuals.ts`) — un seul
endroit renvoie *nom de variable + icône + libellé* par statut, réutilisé partout
(badges, Kanban, Agenda, fiche, dashboard, tâches, activité, filtres, compteurs) :

| Statut / stade | Variable | Teinte |
|---|---|---|
| Nouveau | `--crm-st-nouveau` | bleu |
| À contacter / rappel | `--crm-st-a_contacter` | ambre |
| Contact établi | `--crm-st-contact` | cyan |
| Qualifié | `--crm-st-qualifie` | violet |
| Rendez-vous planifié | `--crm-st-rdv_planifie` | indigo |
| Estimation réalisée | `--crm-st-rdv_realise` / `--crm-st-estimation` | turquoise |
| En attente d'éligibilité | `--crm-st-eligibilite` | doré |
| Proposition de mandat | `--crm-st-proposition` | orange profond |
| En attente de signature | `--crm-st-attente_signature` | mauve |
| Mandat signé / gagné | `--crm-st-signe` | vert émeraude |
| Perdu / refusé / annulé | `--crm-st-perdu` | rouge atténué |
| Neutre / non affecté | `--crm-st-neutre` | gris |

Les fonds teintés (chips, KPI, en-têtes de colonne, marqueurs de timeline) sont
dérivés d'**une seule** couleur d'accent via `color-mix()` → cohérence
automatique clair/sombre, sans dupliquer de valeurs.

---

## 4. Défauts corrigés

- **Timeline** : chevauchement du marqueur sur la première lettre → grille robuste.
- **Monochromie** : dashboard, Kanban, Agenda et badges différenciés par accent +
  icône, sobrement (liseré + fond légèrement teinté, jamais de couleur pleine
  agressive sur toute une colonne, ni d'effet « dashboard multicolore »).
- **Hiérarchie des KPI** : icône, liseré coloré, fond légèrement teinté, nombre
  mis en avant, **état critique** (tâches en retard, non affectés) en rouge.
- **Contraste** : `--crm-text-dim` / `--crm-text-faint` relevés ; barre supérieure
  et fonds passés en tokens (adaptent au thème) ; alias
  `--color-danger-on-dark → --crm-danger` pour que les usages existants
  deviennent thème-adaptatifs.
- **Lisibilité** : e-mails/téléphones copiables et non tronqués (déjà en place),
  `min-width: 0`, `overflow-wrap`, hauteurs de champ par `min-height`, panneau
  latéral scrollable, aucun scroll horizontal global (contenu large dans ses
  propres conteneurs).

---

## 5. Routes auditées

`/crm`, `/crm/mandats`, `/crm/mandats/pipeline`, `/crm/mandats/[id]`,
`/crm/rendez-vous`, `/crm/taches`, `/crm/parametres`, `/crm/parametres/equipe`,
`/crm/parametres/calendrier`, `/crm/parametres/regles-economiques`, et les pages
`biens/[id]`. Les correctifs sont **systémiques** (tokens + design system) : ces
pages héritent de la base propre, en clair comme en sombre.

---

## 6. Accessibilité

- Contraste AA (textes relevés, couleurs de statut lisibles en clair et sombre).
- Focus visible cohérent (`--crm-focus`), navigation clavier, sélecteur de thème
  en radiogroup natif.
- **Couleur jamais seule** : icône + libellé partout (statuts, timeline, légende).
- `prefers-reduced-motion` respecté (transitions courtes, aucune animation
  essentielle), tailles tactiles suffisantes, aucun scroll horizontal global.

---

## 7. Tests

- `theme.ts` : `normalizePreference`, `resolveTheme` (light/dark/système, SSR),
  cookie, **script no-flash statique** (pas de divergence d'hydratation).
- `ThemeToggle` (composant) : radiogroup accessible, sombre par défaut,
  sélection « Clair » applique le thème **et** persiste le cookie, « Système »
  annonce l'état résolu.
- `status-visuals.ts` : chaque stade / statut / type d'événement a variable +
  icône + libellé ; aucune icône cassée ; retombées propres.
- `timeline` : `kind` par type d'événement ; **structure** (marqueur et contenu
  dans des cellules distinctes, titre complet, icône présente).
- `crm.css` (garde-fous) : timeline en grille avec `minmax(0,1fr)` et point **non**
  absolu ; tokens sémantiques clair + sombre ; couleurs de statut centralisées.

`npm run lint`, `npm run typecheck`, `npm run test:run` (**371** tests),
`npm run build` : verts.

---

## 8. Preuves visuelles

Captures réelles générées à partir du **vrai `crm.css`**
(`scripts/theme-shots.mjs`, hors bundle applicatif) dans `docs/assets/crm/v1-2/` :

- `dashboard-dark.png`, `dashboard-light.png` — KPI différenciés, Kanban teinté,
  Agenda coloré + légende, **timeline corrigée** (titres complets, marqueurs
  séparés) ;
- `mobile-dark.png`, `mobile-light.png` — empilement responsive, timeline pleine
  largeur sans rognage.

Inspectées visuellement : contraste correct dans les deux thèmes, aucune première
lettre recouverte, hiérarchie lisible.

---

## 9. Limites restantes

- La bascule de thème s'applique au CRM ; les pages publiques restent sur leur
  charte propre (hors périmètre, volontairement).
- Le mode « système » suit l'OS en direct ; aucune synchronisation multi-onglets
  au-delà du comportement natif du cookie/`matchMedia`.
- Les captures sont produites depuis un harnais représentatif (mêmes tokens et
  mêmes composants) ; une recette visuelle en session authentifiée reste possible
  manuellement.

# 22 — Landing propriétaire (`/proprietaire`)

`https://go.prodigio.fr/proprietaire` est la page que voient les **propriétaires
de biens d'exception** arrivant par la publicité. Elle a un seul objectif :
amener à `/proprietaire/analyse` (le parcours d'éligibilité). Tout ce qui ne sert
pas cet objectif l'affaiblit.

---

## 1. Principes éditoriaux

1. **Une idée par écran, jamais deux fois la même.** Chaque section apporte une
   information neuve. Une idée déjà exprimée ne revient pas sous d'autres mots.
2. **La revendication d'abord, la justification ensuite.** Le titre affirme, le
   visuel prouve, on passe à la suite.
3. **Un seul geste possible.** Un seul libellé d'action sur toute la page, une
   seule couleur d'action (le doré), aucun bouton secondaire concurrent.
4. **Jamais de promesse invérifiable.** Les chiffres du cas réel restent
   accompagnés de leur avertissement (`preuve.disclaimer`), et la mention
   « mandats portés par une agence immobilière habilitée » reste au pied de page.

## 2. Structure

| Ordre | Section | Fond | Ce qu'elle apporte |
|---|---|---|---|
| 1 | **Hero** | photo assombrie | La promesse **et le film**. Titre, VSL, action — rien d'autre. |
| 2 | **La différence** (`StatementSection`) | onyx | La phrase signature : « Prodigio ne met pas votre bien en vente. Prodigio le vend. » |
| 3 | **Marquee** | ivoire | Respiration ; les mots-clés du positionnement. |
| 4 | **L'écrin** (`ConstatSection`) | ivoire | La **preuve visuelle** : fiche d'agence classique ↔ site dédié, carte d'identité, brochure. |
| 5 | **Le Système Prodigio** (`SystemSection`) | onyx | Les 4 phases (Comprendre · Concevoir · Produire · Acquérir) **en un seul écran**. |
| 6 | **Le modèle** (`ModeleSection`) | ivoire | Visibilité financée, rémunération au résultat. |
| 7 | **La preuve** (`ProofSection`) | onyx | L'entonnoir chiffré d'un cas réel + avertissement. |
| 8 | **Sélection & appel à l'action** (`FinalCtaSection`) | photo en parallaxe | Sélectivité, confidentialité et CTA réunis. |
| 9 | **Pied de page** (`SiteFooter`) | bois noir | Positionnement honnête, mentions. |

Rythme de contraste **sombre → clair → sombre**. Un seul `H1` (la promesse du
hero) ; les titres de section sont des `H2`.

## 3. Appel à l'action

- **Libellé unique** : « Voir si mon bien est éligible » (variante courte en
  en-tête : « Vérifier mon éligibilité »). Le même libellé est utilisé sur la
  page d'accueil publique — voir [11-PUBLIC-HOME.md](11-PUBLIC-HOME.md).
- **Une seule couleur d'action** : le doré (`tone="gold"`). Aucun bouton
  fantôme : un contour transparent ne se lit pas comme un bouton.
- **Au-dessus de la ligne de flottaison** : la VSL **et** le CTA du hero sont
  visibles sans défiler, sur ordinateur (1440 × 800 compris) comme sur mobile.
  C'est la contrainte qui gouverne le hero : tout bloc supplémentaire (badge,
  paragraphe, annotation) repousse le bouton hors de l'écran, donc il n'y en a
  pas.
- **Rappel permanent** (`StickyCta`) : l'en-tête défile et disparaît ; le CTA
  collant prend le relais dès le hero dépassé, **sur mobile (barre basse) comme
  sur ordinateur (bouton flottant)**, et s'efface à l'approche du CTA final pour
  ne jamais le doubler.
- **Réassurance** systématiquement sous le bouton : « 1 minute · Confidentiel ·
  Sans engagement ».

## 4. Ce qui a été retiré, et pourquoi

| Retiré | Raison |
|---|---|
| Section « Avant / Avec Prodigio » | Répétait, en liste, le constat déjà démontré en images par la section L'écrin. |
| Section « Sélection & confidentialité » | Disait ce que porte déjà le CTA final, avec le même bouton — les deux sont fusionnées. |
| Défilement horizontal épinglé du Système | Occupait 4 hauteurs d'écran (un tiers de la page) pour 4 phrases, sans aucun CTA visible pendant tout ce défilement. |
| Badge « Système avancé pour bien d'exception » | Jargon, au-dessus du titre qui dit déjà mieux la même chose. |
| Sous-titre et annotation manuscrite du hero | Chaque ligne en plus repoussait la VSL et le CTA hors du premier écran. |
| Fond flouté de la hero (miniature de la VSL) | Un flou n'est pas une image : brume brune sans profondeur. Remplacé par une photographie nette voilée. |
| Capture d'écran de dossier de fichiers publicitaires | Visuel de back-office, incompatible avec le positionnement montré à un propriétaire. |

Résultat : **671 → ~340 mots**, **10 750 → 5 890 px** de hauteur sur ordinateur,
à information égale — et la VSL reste la première chose que l'on voit.

## 5. Contenu et code

- **Tout le texte** vit dans `src/components/mandate/landing/copy.ts`. Aucun
  libellé en dur dans les composants — condition de l'internationalisation à
  venir.
- **Composants réutilisés** : `LandingCta`, `Reveal`, `Parallax`,
  `ProdigioLogo`, `AttributionCapture`, `SiteFooter`, `Marquee`.
- **Visuels** : manifeste `src/lib/media.ts`, crédits dans
  [08-MEDIA-CREDITS.md](08-MEDIA-CREDITS.md). Les images de démonstration
  (Unsplash) sont **provisoires** : elles seront remplacées par les captations
  Prodigio. Une image d'ambiance ne doit jamais contredire le positionnement du
  bien qu'elle accompagne.
- **Attribution** : `AttributionCapture` reste monté en tête de page ; la
  refonte éditoriale ne touche ni la soumission, ni le quiz d'analyse.

## 6. Accessibilité

- Le voile du hero est calculé pour garder un contraste confortable sur la
  photographie (texte principal et réassurance compris).
- Les images de fond décoratives sont `aria-hidden` ; l'écrin vidéo conserve ses
  contrôles accessibles (lecture, activation du son).
- Les révélations au défilement (`Reveal`) sont neutralisées sous
  `prefers-reduced-motion` et le contenu reste visible sans JavaScript.

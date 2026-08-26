# 22 — Landing propriétaire (`/proprietaire`)

`https://go.prodigio.fr/proprietaire` est la page que voient les **propriétaires
de biens d'exception** arrivant par la publicité. Elle a un seul objectif :
amener à `/proprietaire/analyse` (le parcours d'éligibilité).

---

## 1. La Big Idea : le Système Prodigio™ va chercher l'acheteur

C'est le socle de toute la page, et la seule idée qu'un visiteur pressé doit
emporter. Elle est posée dès la première ligne :

> Et si, au lieu d'attendre votre acheteur pendant des mois, nous allions le
> chercher ?

La commercialisation traditionnelle — portails, moteurs de recherche, réseau,
fichier acquéreurs — capte une **demande existante** : des personnes déjà en
recherche. Prodigio n'y substitue rien ; il **ajoute une couche** : aller
chercher l'attention d'acheteurs qui ne cherchent pas encore.

La phrase conceptuelle centrale :

> Ce n'est plus seulement l'acheteur qui cherche le bien.
> C'est le bien qui vient trouver son acheteur.

### Trois promesses, et rien d'autre

Toute la page se ramène à trois bénéfices. Une section qui n'en sert aucun n'a
pas sa place :

1. **Vendre plus vite.**
2. **Trouver les bons acheteurs.**
3. **Défendre la valeur du bien.**

« Au prix qu'il mérite » est une promesse de **valorisation**, jamais un
engagement de prix ou de délai.

### Le territoire de marque

La méthode porte un nom : **Système Prodigio™** (`SYSTEM_NAME`, dans
[`src/config/credentials.ts`](../src/config/credentials.ts)). Il est mis en
valeur typographiquement dès le sous-titre du hero, puis repris en surtitre du
système, de la sélectivité et de la FAQ. C'est ce nom qui doit rester en tête,
pas le vocabulaire des outils.

### Zéro jargon face au propriétaire

Le propriétaire doit penser *« ils ont une manière différente de trouver mon
acheteur »*, pas *« ils ont une belle machine publicitaire »*. Les mots
« avatar », « lead », « funnel », « tunnel de vente », « Meta Ads », « ciblage »,
« retargeting », « acquisition digitale » sont **proscrits** de la page : chaque
notion technique est traduite en bénéfice immobilier. Le test
[`copy.test.ts`](../src/components/mandate/landing/copy.test.ts) échoue si l'un
d'eux réapparaît.

### L'ancienneté est un paramètre, pas une constante

Le sous-titre du hero avance « plus de 25 ans dans l'immobilier ». Cette
affirmation **n'est pas validée** : elle vit dans `EXPERIENCE_LABEL`
([`src/config/credentials.ts`](../src/config/credentials.ts)), surchargeable par
`NEXT_PUBLIC_EXPERIENCE_LABEL`. Elle doit pouvoir devenir « plus de 20 ans » sans
toucher au moindre composant — voir
[05-OPEN-QUESTIONS.md](05-OPEN-QUESTIONS.md).

**Règle absolue : jamais de caricature de la profession immobilière.** On
n'écrit pas « les agences ne font rien », « les portails ne fonctionnent plus »,
« les méthodes traditionnelles sont dépassées ». L'adversaire est la
commercialisation **passive**, pas l'agent immobilier. La formule qui clôt la
comparaison le dit : *« Nous ne remplaçons pas ce qui fonctionne. Nous ajoutons
ce qui manque. »* Un test (`landing-dynamic.test.tsx`) échoue si un terme
accusatoire réapparaît dans cette section.

La création n'est **pas** l'innovation principale : elle est le moteur créatif
que l'acquisition active exige. Pour arrêter l'attention de quelqu'un qui ne
cherchait rien, encore faut-il lui donner une raison de regarder. C'est pour
cela que la section création arrive **après** la Big Idea, et non avant.

## 2. Principes éditoriaux

1. **La lecture en trente secondes.** Un visiteur qui ne lit que les grands
   titres doit comprendre l'offre. L'enchaînement des `<h1>`/`<h2>` de la page
   est l'argumentaire complet — voir §4.
2. **Montrer plutôt qu'expliquer.** Si une idée demande trois paragraphes, elle
   est mal posée.
3. **Une idée par écran, jamais deux fois la même.**
4. **La page dit ce que dit la VSL**, jusqu'au libellé du bouton que la voix off
   prononce.
5. **Rien d'inventé** : aucune statistique sans source, aucun pays inventé,
   aucun délai promis, aucune condition économique chiffrée (ce sont des
   paramètres contractuels versionnés — voir la constitution du projet).
6. **Ne jamais rallonger la page.** Une idée nouvelle remplace une idée
   existante ou entre dans une section déjà là. La hauteur de la page est un
   indicateur suivi : elle doit décroître, pas grossir.

## 3. Structure

| # | Section | Fond | Ce qu'elle apporte |
|---|---|---|---|
| 1 | **Hero** | photo assombrie | La question qui installe la Big Idea, le nom de la méthode, l'annotation manuscrite, le film, l'action. |
| 2 | **Preuve immédiate** (`ProofStripSection`) | onyx | 4 nombres. La crédibilité avant l'argumentaire. |
| 3 | **L'angle mort** (`AudienceSection`) | onyx | « Et tous les autres ? », puis où se trouve l'attention + maquette d'une publicité. |
| 4 | **La création** (`CreationSection`) | ivoire | « Votre propriété mérite mieux qu'une annonce » : annonce classique ↔ écrin Prodigio, en images. |
| 5 | **L'écrin, en vrai** (`VitrineSection`) | ivoire sourd | Le site du bien et sa brochure **ouverts en direct** (iframes). |
| 6 | **Le Système** (`SystemSection`) | onyx | Six temps, six lignes. |
| 7 | **Notre engagement** (`EngagementSection`) | bois noir | *Skin in the game* : Prodigio finance la commercialisation. |
| 8 | **Transparence** (`TransparenceSection`) | onyx | Illustration d'interface de suivi. |
| 9 | **Case study** (`CaseStudySection`) | onyx + photo | L'entonnoir complet de Font-Romeu, jusqu'à « Vendu ». |
| 10 | **Comparaison** (`ComparaisonSection`) | ivoire | Additive : « tout cela, plus… ». |
| 11 | **Sélectivité** (`SelectionSection`) | onyx | La montée en gamme, puis le CTA. |
| 12 | **FAQ** (`FaqSection`) | ivoire | Cinq objections, pas une de plus. |
| 13 | **Dernier écran** (`FinalCtaSection`) | photo plein cadre | Une question, un geste, la signature de marque. |
| 14 | **Pied de page** (`SiteFooter`) | bois noir | Positionnement honnête, mentions. |

## 4. La lecture en trente secondes

L'enchaînement des titres, tel qu'il doit rester :

```
Et si, au lieu d'attendre votre acheteur pendant des mois, nous allions le chercher ?
→ 14 jours de campagne. (312 · 23 · 6 · 1)
→ Votre bien est visible par ceux qui le cherchent. Et tous les autres ?
→ Votre propriété mérite mieux qu'une annonce.
→ Ouvrez-le. C'est un bien réel.
→ Une stratégie construite autour d'un seul bien : le vôtre.
→ Nous ne nous contentons pas de prendre votre mandat. Nous investissons dans sa réussite.
→ Ne vous demandez plus ce qui est fait pour vendre votre bien.
→ Nous n'avons pas attendu son acheteur.
→ Nous ne remplaçons pas ce qui fonctionne. Nous ajoutons ce qui manque.
→ Toutes les propriétés n'intègrent pas le Système Prodigio™.
→ Votre futur acheteur est peut-être déjà là.
→ Vérifier l'éligibilité de mon bien.
```

Toute section ajoutée doit trouver sa place dans cette phrase. Si elle n'y entre
pas, elle n'a rien à faire sur la page.

## 5. Appel à l'action

- **Libellé unique** : « Vérifier l'éligibilité de mon bien » — la phrase
  prononcée à la fin de la VSL. Variante courte en en-tête : « Vérifier mon
  éligibilité ».
- **Posture sélective** jusqu'au bout : jamais « confiez-nous votre mandat »,
  toujours « vérifions si votre bien est éligible ».
- **Une seule couleur d'action** : le doré, avec halo pulsé sur les CTA majeurs.
- **Au-dessus de la ligne de flottaison** : le titre, la VSL, le bouton **et**
  sa réassurance sont visibles sans défiler. Sous 900 px de hauteur de fenêtre,
  `.hero-fit` / `.hero-media` (dans `globals.css`) resserrent la typographie et
  donnent au film exactement la place qui reste
  (`max-width: calc((100dvh - 29rem) * 16 / 9)`). Ces règles vivent en CSS et
  non en utilitaires `[@media(...)]:` : deux variantes Tailwind de même
  spécificité ne garantissent pas laquelle l'emporte. Mesuré à 1440×900,
  1440×800, 1440×768, 820×1180, 390×844 et 360×740.
- **L'annotation manuscrite** « En moins de 5 min, on vous explique tout. » et
  sa flèche courbe désignent le film. Formulation validée : ne pas la réécrire,
  ne pas la supprimer (`hero.test.tsx` la verrouille).
- **Rappel permanent** (`StickyCta`) : barre basse sur mobile, bouton flottant
  sur ordinateur, effacé à l'approche du CTA final.
- **Réassurance** sous chaque bouton : « Questionnaire d'une minute · Étude
  confidentielle · Sans engagement ».

## 6. Points de vigilance

- **Statistiques d'audience** (`audience.stats`) : les volumes affichés doivent
  être rattachés à une **source vérifiable et datée** avant mise en production.
  `audience.sourceNote` est aujourd'hui générique — c'est un point ouvert.
- **Interface de suivi** (`TransparenceSection`) : n'affiche **aucune valeur**,
  uniquement les indicateurs, et porte la mention « illustration d'interface ».
  Ne jamais y mettre de chiffres fictifs : ils passeraient pour des résultats.
- **Exclusivité du mandat** : traitée en FAQ uniquement. Une section dédiée
  créerait l'objection chez ceux qui ne se la posaient pas.
- **Case study** : cas réel, avertissement attaché en permanence.
- **Ancienneté annoncée** : `EXPERIENCE_LABEL` — « plus de 25 ans » est une
  hypothèse à confirmer, surchargeable par `NEXT_PUBLIC_EXPERIENCE_LABEL`.
- **Vitrine** : les URL vivent dans [`src/config/showcase.ts`](../src/config/showcase.ts).
  Pages intégrées, jamais recopiées ; chargement paresseux ; aperçu rendu en
  1280 px puis réduit de moitié pour montrer la version bureau.

## 7. Contenu et code

- **Tout le texte** vit dans `src/components/mandate/landing/copy.ts`. Aucun
  libellé en dur dans les composants — condition de l'internationalisation.
- **Affirmations à confirmer** : `src/config/credentials.ts` (ancienneté, nom de
  la méthode). Elles ne doivent jamais être écrites dans un composant.
- **Garde-fous automatiques** : `copy.test.ts` (jargon, caricature, garantie,
  pourcentage, mentions d'illustration), `hero.test.tsx` (hiérarchie du hero,
  annotation manuscrite, ancienneté paramétrée), `faq-section.test.tsx`,
  `landing-dynamic.test.tsx`.
- **Composants réutilisés** : `LandingCta`, `Reveal`, `Parallax`, `CountUp`,
  `ProdigioLogo`, `AttributionCapture`, `SiteFooter`.
- **Visuels** : manifeste `src/lib/media.ts`, crédits dans
  [08-MEDIA-CREDITS.md](08-MEDIA-CREDITS.md). Les images Unsplash sont
  **provisoires** : elles seront remplacées par les captations Prodigio.
- **Attribution** : `AttributionCapture` reste monté en tête de page. La refonte
  éditoriale ne touche ni la soumission, ni le quiz d'analyse.

## 8. Accessibilité

- Le voile du hero garde un contraste confortable sur la photographie.
- Les images décoratives sont `aria-hidden` ; l'écrin vidéo conserve ses
  contrôles (lecture, activation du son).
- La FAQ utilise des `<details>/<summary>` natifs : clavier, sans JavaScript,
  indexable.
- Chaque section porte un `<h2>` : le plan du document **est** la lecture en
  trente secondes.
- Les révélations au défilement (`Reveal`) et le reflet de l'écrin vidéo sont
  neutralisés sous `prefers-reduced-motion` ; le contenu reste visible sans
  JavaScript.

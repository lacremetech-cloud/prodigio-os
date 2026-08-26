# 22 — Landing propriétaire (`/proprietaire`)

`https://go.prodigio.fr/proprietaire` est la page que voient les **propriétaires
de biens d'exception** arrivant par la publicité. Elle a un seul objectif :
amener à `/proprietaire/analyse` (le parcours d'éligibilité).

---

## 1. La Big Idea : l'acquisition active

C'est le socle de toute la page, et la seule idée qu'un visiteur pressé doit
emporter.

La commercialisation traditionnelle — portails, moteurs de recherche, réseau,
fichier acquéreurs — capte une **demande existante** : des personnes déjà en
recherche. Prodigio n'y substitue rien ; il **ajoute une couche** : aller
chercher l'attention d'acheteurs qui ne cherchent pas encore.

> Le futur acheteur de votre propriété ne la cherche peut-être pas encore.

La phrase conceptuelle centrale :

> Ce n'est plus seulement l'acheteur qui cherche le bien.
> C'est le bien qui vient trouver son acheteur.

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

## 3. Structure

| # | Section | Fond | Ce qu'elle apporte |
|---|---|---|---|
| 1 | **Hero** | photo assombrie | La question qui installe la Big Idea, le film, l'action, la barre de réassurance. |
| 2 | **Preuve immédiate** (`ProofStripSection`) | onyx | 4 nombres. La crédibilité avant l'argumentaire. |
| 3 | **Big Idea** (`BigIdeaSection`) | onyx | Demande existante ↔ nouvelles intentions, en deux colonnes. |
| 4 | **Audience** (`AudienceSection`) | onyx | Où se trouve l'attention + maquette d'une publicité. |
| 5 | **La création** (`CreationSection`) | ivoire | « Votre propriété mérite mieux qu'une annonce » : annonce classique ↔ écrin Prodigio, en images. |
| 6 | **L'écrin, en vrai** (`VitrineSection`) | ivoire sourd | Le site du bien et sa brochure **ouverts en direct** (iframes). |
| 7 | **Le Système** (`SystemSection`) | onyx | Six temps, six lignes. |
| 8 | **Notre engagement** (`EngagementSection`) | bois noir | *Skin in the game* : Prodigio finance la commercialisation. |
| 9 | **Transparence** (`TransparenceSection`) | onyx | Illustration d'interface de suivi. |
| 10 | **Case study** (`CaseStudySection`) | onyx + photo | L'entonnoir complet de Font-Romeu, jusqu'à « Vendu ». |
| 11 | **Comparaison** (`ComparaisonSection`) | ivoire | Additive : « tout cela, plus… ». |
| 12 | **Sélectivité** (`SelectionSection`) | onyx | La montée en gamme, puis le CTA. |
| 13 | **FAQ** (`FaqSection`) | ivoire | Cinq objections, pas une de plus. |
| 14 | **Dernier écran** (`FinalCtaSection`) | photo plein cadre | Une question, un geste, la signature de marque. |
| 15 | **Pied de page** (`SiteFooter`) | bois noir | Positionnement honnête, mentions. |

## 4. La lecture en trente secondes

L'enchaînement des titres, tel qu'il doit rester :

```
Et si votre futur acheteur ne cherchait pas encore votre propriété ?
→ 14 jours. Une propriété à 1,6 M€. (312 · 23 · 6 · 1)
→ Votre propriété est visible par ceux qui la cherchent. Et tous les autres ?
→ Votre acheteur est peut-être déjà devant nous.
→ Votre propriété mérite mieux qu'une annonce.
→ Nous investissons nous-mêmes dans sa commercialisation.
→ Nous ne remplaçons pas ce qui fonctionne. Nous ajoutons ce qui manque.
→ Toutes les propriétés n'intègrent pas Prodigio.
→ Vérifier l'éligibilité de ma propriété.
```

Toute section ajoutée doit trouver sa place dans cette phrase. Si elle n'y entre
pas, elle n'a rien à faire sur la page.

## 5. Appel à l'action

- **Libellé unique** : « Vérifier l'éligibilité de ma propriété » — la phrase
  prononcée à la fin de la VSL. Variante courte en en-tête : « Vérifier mon
  éligibilité ».
- **Posture sélective** jusqu'au bout : jamais « confiez-nous votre mandat »,
  toujours « vérifions si votre propriété est éligible ».
- **Une seule couleur d'action** : le doré, avec halo pulsé sur les CTA majeurs.
- **Au-dessus de la ligne de flottaison** : la VSL **et** le CTA du hero sont
  visibles sans défiler ; l'écrin vidéo se resserre sous 900 px puis 800 px de
  hauteur d'écran pour préserver cette règle.
- **Rappel permanent** (`StickyCta`) : barre basse sur mobile, bouton flottant
  sur ordinateur, effacé à l'approche du CTA final.
- **Réassurance** sous chaque bouton : « 1 minute · Confidentiel · Sans
  engagement » dans le hero, formulation complète en fin de page.

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
- **Vitrine** : les URL vivent dans [`src/config/showcase.ts`](../src/config/showcase.ts).
  Pages intégrées, jamais recopiées ; chargement paresseux ; aperçu rendu en
  1280 px puis réduit de moitié pour montrer la version bureau.

## 7. Contenu et code

- **Tout le texte** vit dans `src/components/mandate/landing/copy.ts`. Aucun
  libellé en dur dans les composants — condition de l'internationalisation.
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

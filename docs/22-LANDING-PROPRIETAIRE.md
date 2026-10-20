# 22 — Landing propriétaire (`/proprietaire`)

`https://go.prodigio.fr/proprietaire` est la page que voient les **propriétaires
de biens d'exception** arrivant par la publicité. Elle a un seul objectif :
amener à `/proprietaire/analyse` (le parcours d'éligibilité).

---

## 1. La doctrine : expertise immobilière **+** Système Prodigio™

Prodigio ne se positionne **jamais contre** l'immobilier de prestige. Il ajoute.

> EXPERTISE IMMOBILIÈRE TRADITIONNELLE **+** SYSTÈME PRODIGIO™

La cible connaît le métier : dirigeants, entrepreneurs, investisseurs,
propriétaires patrimoniaux. Écrire que « les agences prennent trois photos et
attendent » est **faux** et décrédibilise Prodigio. Les meilleures agences ont
des fichiers acquéreurs qualifiés, des partenaires, du réseau, des portails, de
l'off-market, parfois une diffusion internationale, des photographes, des
vidéastes et une vraie présence sociale. **Tout cela fonctionne, et Prodigio s'en
sert aussi.**

### Deux marchés

| | Le marché **actif** | Le marché **latent** |
|---|---|---|
| Qui | Ceux qui cherchent déjà | Ceux qui ne cherchent pas encore |
| Signes | Portails, alertes, fichiers acquéreurs, appels aux agences | Le patrimoine, le budget, le profil, le timing |
| Qui l'atteint | Les meilleures agences, très bien | Personne |

L'insight qui tient toute la page :

> Dans l'immobilier d'exception, **le coup de cœur peut précéder la recherche.**

Un acheteur peut découvrir une propriété qu'il ne cherchait pas, se projeter,
puis développer une intention. C'est ce marché-là que le Système va chercher —
**en plus** du marché actif, jamais à sa place.

### Visibilité ≠ acquisition

Deuxième thèse, aussi importante que la première, et aussi délicate : **ne jamais
écrire que les réseaux sociaux ou l'organique ne fonctionnent pas.** Ils
fonctionnent. La question est ailleurs :

- Parmi 50 000 vues, combien pouvaient réellement acheter cette propriété ?
- Et qu'a-t-on **appris** de ces 50 000 vues pour mieux la commercialiser demain ?

> Une publication est diffusée.
> **Une campagne Prodigio apprend.**

Une campagne teste plusieurs angles, produit de la donnée sur les profils qui
réagissent, puis reconcentre les moyens. Les 50 000 vues du titre sont une
**hypothèse de raisonnement**, jamais un résultat Prodigio.

### Prodigio investit

Production (film, photographie, montage), expérience (site dédié, brochure,
créations) et surtout **diffusion**. Le propriétaire doit comprendre : *« ils ne
prennent pas simplement mon mandat, ils mettent eux aussi de l'argent sur la
table »*. C'est ce qui justifie la sélectivité — et donc le CTA.

⚠️ Vocabulaire de commercialisation immobilière, **jamais d'achat média** : ni
CPC, ni CPM, ni ROAS, ni nom de régie. « Budget de diffusion », pas « budget
média ».

### Le territoire de marque

La méthode porte un nom : **Système Prodigio™** (`SYSTEM_NAME`, dans
[`src/config/credentials.ts`](../src/config/credentials.ts)). Il ouvre la page en
capitales, dans un **cartouche** qu'un reflet lumineux balaie par intermittence
(`.badge-shine`) — pas en surtitre plat.

### Zéro jargon face au propriétaire

Les mots « avatar », « lead », « funnel », « tunnel de vente », « Meta Ads »,
« ciblage », « retargeting », « acquisition digitale » sont **proscrits** : chaque
notion technique est traduite en bénéfice immobilier. Le test
[`copy.test.ts`](../src/components/mandate/landing/copy.test.ts) échoue si l'un
d'eux réapparaît — et aussi si une formule accusatoire envers la profession, ou
une négation de la valeur de l'organique, se glisse dans le copy.

### L'ancienneté est un paramètre, pas une constante

Le sous-titre du hero avance « plus de 25 ans dans l'immobilier ». Cette
affirmation **n'est pas validée** : elle vit dans `EXPERIENCE_LABEL`
([`src/config/credentials.ts`](../src/config/credentials.ts)), surchargeable par
`NEXT_PUBLIC_EXPERIENCE_LABEL`. Elle doit pouvoir devenir « plus de 20 ans » sans
toucher au moindre composant — voir
[05-OPEN-QUESTIONS.md](05-OPEN-QUESTIONS.md).

## 2. Principes éditoriaux

1. **La lecture en trente secondes.** Un visiteur qui ne lit que les grands
   titres doit comprendre l'offre. L'enchaînement des `<h1>`/`<h2>` de la page
   est l'argumentaire complet — voir §4.
2. **Montrer plutôt qu'expliquer.** Si une idée demande trois paragraphes, elle
   est mal posée.
3. **Une idée par écran, jamais deux fois la même.**
4. **La VSL explique ; la page démontre et rassure.** Le libellé du bouton reste
   celui que la voix off prononce, mais la page n'est jamais une transcription :
   le visiteur qui a regardé le film ne doit pas relire la même chose.
5. **Rien d'inventé** : aucune statistique sans source, aucun pays inventé,
   aucun délai promis, aucune condition économique chiffrée (ce sont des
   paramètres contractuels versionnés — voir la constitution du projet).
6. **Ne jamais rallonger la page.** Une idée nouvelle remplace une idée
   existante ou entre dans une section déjà là. La hauteur de la page est un
   indicateur suivi : elle doit décroître, pas grossir.

## 3. Structure

Le mouvement d'ensemble : **question → preuve → problème → positionnement →
mécanisme → démonstration → engagement → preuve → sélection → action.**

| # | Section | Fond | Ce qu'elle apporte |
|---|---|---|---|
| 1 | **Hero** (`Hero`) | photo assombrie | Le cartouche « SYSTÈME PRODIGIO™ », la question d'ouverture, l'annotation manuscrite, le film, l'action. |
| 2 | **Preuve immédiate** (`ProofStripSection`) | onyx | 4 nombres. Son seul rôle : provoquer « d'accord… comment ? ». |
| 3 | **Le marché invisible** (`MarcheInvisibleSection`) | onyx | Ne démontre rien : installe une question que le propriétaire ne s'était pas posée. |
| 4 | **Deux marchés** (`MarchesSection`) | ivoire | Donne raison au marché actif, puis nomme le marché latent. Traitement égal des deux colonnes. |
| 5 | **Visibilité ≠ acquisition** (`AcquisitionSection`) | onyx | Une publication ↔ une campagne. La maquette publicitaire y trouve sa place. |
| 6 | **Le Système** (`SystemSection`) | onyx | Sept temps le long d'un rail, puis « visites qualifiées → vente ». |
| 7 | **Avant la diffusion** (`CreationSection`) | ivoire | Le positionnement, pas la jolie image : l'angle qui fera désirer *ce* bien. |
| 8 | **L'écrin, en vrai** (`VitrineSection`) | ivoire sourd | Le site du bien et sa brochure **ouverts en direct** (iframes). |
| 9 | **Notre engagement** (`EngagementSection`) | bois noir | Production · Expérience · Diffusion, puis la diffusion en climax. |
| 10 | **La data** (`TransparenceSection`) | onyx | « Voyez votre marché réagir » — illustration d'interface. |
| 11 | **Case study** (`CaseStudySection`) | onyx + photo | L'entonnoir complet de Font-Romeu, jusqu'à « 1 vente ». |
| 12 | **Sélectif par nature** (`SelectionSection`) | onyx | Le « donc » de la page : nous investissons, donc nous ne pouvons pas tout accepter. |
| 13 | **FAQ** (`FaqSection`) | ivoire | Six objections, pas une de plus. |
| 14 | **Dernier écran** (`FinalCtaSection`) | photo plein cadre | La boucle se referme sur la question d'ouverture. |
| 15 | **Pied de page** (`SiteFooter`) | bois noir | Positionnement honnête, mentions. |

## 4. La lecture en trente secondes

L'enchaînement des titres, tel qu'il doit rester :

```
Et si, au lieu d'attendre votre acheteur, nous allions le chercher ?
→ 14 jours de campagne. (312 · 23 · 6 · 1)
→ Et ceux qui pourraient acheter votre bien… sans encore le chercher ?
→ Les meilleures agences savent déjà très bien travailler le marché actif.
→ 50 000 vues. Mais combien d'acheteurs ?
→ Une stratégie construite autour d'un seul bien : le vôtre.
→ Nous cherchons l'angle qui le fera désirer.
→ Ne nous croyez pas sur parole. Ouvrez-le.
→ Nous ne nous contentons pas de prendre votre mandat. Nous investissons dans sa réussite.
→ Voyez votre marché réagir.
→ Nous n'avons pas attendu son acheteur.
→ Nous investissons dans chaque propriété. Nous ne pouvons donc pas toutes les accepter.
→ Votre futur acheteur est peut-être déjà là.
→ Vérifier l'éligibilité de mon bien.
```

Toute section ajoutée doit trouver sa place dans cette phrase. Si elle n'y entre
pas, elle n'a rien à faire sur la page.

### Le double test de lecture

1. Un visiteur qui **ne regarde pas** la VSL doit comprendre la proposition de
   valeur en ne lisant que ces titres.
2. Un visiteur qui **regarde** la VSL ne doit pas avoir l'impression que la page
   lui répète le film.

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
- **Graisse du titre** : `h1, h2, h3` fixe `font-weight: 500` par une règle
  d'élément **hors couche** — un utilitaire `font-bold` ne la bat pas. Le titre
  du hero reprend sa graisse (700) dans `.hero-title`, en CSS.
- **Rappel permanent** (`StickyCta`) : barre basse sur mobile, bouton flottant
  sur ordinateur, effacé à l'approche du CTA final.
- **Réassurance** sous chaque bouton : « Questionnaire d'une minute · Étude
  confidentielle · Sans engagement ».

## 6. Mouvement et interactions

**Le mouvement a une fonction ou il n'existe pas.** Guider le regard, matérialiser
une différence, renforcer une preuve. Rien de décoratif.

- **Durées** : 380–560 ms pour les révélations, 200–300 ms pour les retours au
  geste. Easing unique : `cubic-bezier(0.22, 1, 0.36, 1)`.
- **Propriétés animées** : `transform` et `opacity` uniquement. Jamais
  `width`, `height`, `top` ni `left` — ce sont les reflows qui font tomber le
  taux de rafraîchissement.
- **Rien ne bouge tout seul.** Pas de halo pulsé, pas de rebond : le halo doré
  (`.cta-halo`) est fixe et ne s'intensifie qu'au survol du bouton qu'il
  accompagne. Un bouton qui s'agite en permanence se lit comme une
  sollicitation, pas comme une invitation.
- **Un seul nom par animation.** Deux `@keyframes` homonymes se remplacent
  silencieusement : le reflet de l'écrin vidéo (`pg-vsl-sheen`) et celui des
  boutons (`pg-sheen`) portent des noms distincts pour cette raison.
- **Six moments seulement** portent un vrai geste : le hero et son film, le
  passage annonce → écrin, le Système, l'engagement, l'entonnoir du cas réel,
  le tableau de bord. Tout le reste respire.
- **`prefers-reduced-motion`** neutralise l'ensemble ; le contenu reste
  intégralement lisible, et la page fonctionne sans JavaScript.

### Le film

L'affiche du hero est **entièrement cliquable** — pas un bouton à viser, puis un
plein écran à chercher. Un seul geste ouvre `VslModal` : lecture immédiate
**avec le son** (le geste du visiteur l'autorise), fenêtre quasi plein écran,
plein écran natif demandé en plus sur mobile lorsque le navigateur l'accepte.

- **Aucune iframe YouTube, aucun script d'API sur le premier écran** : le lecteur
  est chargé à l'ouverture (`next/dynamic`). Le hero n'attend qu'une image.
  `hero-vsl.test.tsx` échoue si une iframe réapparaît au chargement.
- **Retour sans saut** : le défilement est gelé par `position: fixed` (et non
  `overflow: hidden`, qui perd la position sur mobile) puis restitué à
  l'identique. La progression du film est mémorisée et reprise (`start`).
- **Clavier** : `Escape` ferme, le focus part sur le bouton de fermeture et
  **revient à l'affiche** à la fermeture. Réserve connue : une fois le focus
  entré dans l'iframe du lecteur, aucun piège à focus ne peut le retenir — c'est
  la limite de tout lecteur tiers ; le bouton de fermeture est donc placé en
  tête d'ordre de tabulation.

### Le Système, et l'investissement

Deux sections portent la crédibilité du modèle. Elles se ressemblent dans
l'intention : **matérialiser** ce qui, autrement, resterait une affirmation.

- **Le Système** est une *séquence*, pas un ensemble : six temps le long d'un
  rail, chacun s'allumant à son arrivée à l'écran (le point passe à l'or, le
  titre reprend sa densité). L'allumage se greffe sur l'état `is-visible` que
  `Reveal` pose déjà — aucun observateur supplémentaire n'est monté. Trois mots
  par étape, jamais plus, et surtout pas de diagramme.
- **L'investissement** énumère les postes réellement engagés, puis donne à la
  **diffusion** un poids visuel très supérieur : c'est le poste que le
  propriétaire ne voit jamais, et le seul qui décide si son bien est vu.
  ⚠️ Vocabulaire de commercialisation immobilière, **jamais d'achat média** :
  ni CPC, ni CPM, ni ROAS, ni nom de régie. `copy.test.ts` le vérifie.

### Annonce parmi d'autres → sujet unique

Le propos de la section création n'est pas « voici deux formats » mais « votre
bien cesse d'être une annonce parmi d'autres ». Il se **ressent** : les annonces
sont présentées petites et côte à côte, puis **reculent** dès que l'écrin est
complet à l'écran. Aucun défilement n'est capturé, aucun élément épinglé.

La commercialisation traditionnelle **recule, elle n'est pas barrée** : c'est un
format, pas une faute.

### Le tableau de bord

Présenté comme une démonstration produit : le panneau arrive incliné de six
degrés, se redresse face caméra, puis les niveaux montent colonne après colonne.
Deux `transform`, rien d'autre — les hauteurs restent dans le flux, donc aucun
décalage de mise en page. Pas de 3D artificielle.

### Le piège à connaître

`Reveal` anime en `animation-fill-mode: both` : sa dernière image fixe
`opacity` et `transform` sur l'élément révélé, et **l'emporte sur toute
déclaration CSS**. Toute classe qui pilote ces propriétés (`.creation-classique`,
`.dash-panel`, `.dash-bar`, `.step-dot`) doit donc vivre sur un **enfant** de
l'élément révélé, jamais sur l'élément lui-même. Une règle posée au mauvais
endroit ne produit aucune erreur : elle ne fait simplement rien.

### Le questionnaire

**Sa logique est un contrat de données**, verrouillé par
`use-analyse-machine.test.tsx` : questions, ordre, clés, valeurs, types, clé
d'idempotence. Seule son enveloppe est retouchée — retour à l'appui, durées de
transition, propriétés animées. Une amélioration visuelle qui exigerait de
déformer la charge utile est abandonnée, pas négociée.

### Appels à l'action

- **Un seul chemin** vers le questionnaire (`ANALYSE_ROUTE`) pour tous les
  boutons, rappel collant compris. Aucune seconde logique d'ouverture.
- **Libellé testable** : les formulations candidates vivent dans
  [`src/config/cta.ts`](../src/config/cta.ts) et se sélectionnent par
  `NEXT_PUBLIC_CTA_VARIANT`. Aucune n'est déclarée gagnante ; la variante active
  accompagne chaque `cta_click`.
- **Trois retours au geste** : survol (soulèvement de 2 px + reflet traversant),
  appui (`active:scale-[0.985]`), focus clavier (anneau visible).
- **Rappel collant** : il s'efface dès qu'un bouton principal est réellement à
  l'écran — observé sur les boutons eux-mêmes (`data-cta-primary`,
  `IntersectionObserver`) plutôt que déduit d'une distance en pixels. Masqué, il
  est `inert` : il ne capte pas le focus clavier. Zone sûre du système respectée.

## 7. Mesure du parcours

[`src/lib/analytics.ts`](../src/lib/analytics.ts) — couche **sans dépendance**,
poussée dans `window.dataLayer`. Elle mesure : visite → lecture du film
(`hero_vsl_play`, `_25`, `_50`, `_75`, `_complete`) → `cta_click` (avec
l'emplacement et la variante de libellé) → `eligibility_started` →
`eligibility_step_completed` (numéro d'étape) → `eligibility_submitted`.

> ⚠️ **Aucune donnée personnelle, aucune réponse au questionnaire** ne transite
> par la mesure. Les charges utiles sont typées et ne contiennent que des
> identifiants d'emplacement, des numéros d'étape et des paliers de lecture. Un
> test (`use-analyse-machine.test.tsx`) échoue si une réponse ou une coordonnée
> apparaît dans `dataLayer`.

Le **contrat de données du CRM n'est pas concerné** : la mesure est en lecture
seule vis-à-vis du funnel, et un test de non-régression verrouille les clés, les
valeurs et la clé d'idempotence transmises à l'action serveur.

## 8. Points de vigilance

- **Aucune statistique d'audience n'est plus publiée.** Les volumes « 51,5 M » et
  « 5,79 Md », faute de source vérifiable et datée, ont disparu avec la section
  qui les portait. Ne pas les réintroduire sans référence.
- **« 50 000 vues »** est une **hypothèse de raisonnement**, jamais un résultat
  Prodigio : la formulation doit le laisser évident.
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

## 9. Contenu et code

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

## 10. Accessibilité

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

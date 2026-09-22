# 25 — Formulaire acquéreur universel

> Un formulaire court, valable pour n'importe quel bien, embarquable sur une
> annonce hébergée ailleurs. Deux écrans, quatre champs obligatoires, et la
> brochure remise immédiatement.
>
> **Hors périmètre, volontairement** : le téléversement direct des médias par URL
> signée, et la rédaction commerciale assistée. Missions séparées.

---

## 1. Le verrou qu'il a fallu lever

`submit_buyer_interest` refusait tout dépôt tant que la vitrine Prodigio n'était
pas `publie` — et le refusait **en silence**, avec un accusé `accepted: true`.
Un formulaire embarqué sur une annonce externe n'aurait donc jamais rien
enregistré, sans le moindre message.

Or publier la vitrine exige huit critères éditoriaux (titre, introduction, slug,
contenu validé, image approuvée, médias, confidentialité, CTA). Exiger tout cela
pour **récolter une demande** confondait deux décisions distinctes.

**Collecter ≠ publier.** `property_public_config.buyer_form_status`
(`inactif` par défaut) ouvre la collecte indépendamment. Un bien publié accepte
les dépôts de toute façon ; un bien en brouillon les accepte dès que son
formulaire est actif.

L'accusé public reste **neutre dans tous les cas** : bien inconnu, formulaire
inactif ou vitrine non publiée renvoient tous `accepted: true, created: false`.
Deviner un identifiant n'apprend rien.

---

## 2. Le vocabulaire de budget, et pourquoi il ne se convertit pas

Les cinq réponses du formulaire universel ne se superposent pas aux
`budget_band` du funnel V1 :

| Réponse universelle | Ancienne tranche | Verdict |
|---|---|---|
| `aucun_projet` | `a_definir` | **irréductible** — « pas de projet » ≠ « montant à préciser » |
| `500k_1m` | `moins_800k` / `800k_1_2m` | **irréductible** — à cheval |
| `1m_2m` | `800k_1_2m` / `1_2m_2m` | **irréductible** — à cheval |
| `2m_3m` | `2m_3m` | identique |
| `plus_3m` | `plus_3m` | identique |

Trois sur cinq. Rapprocher `500k_1m` de `moins_800k` inventerait un plafond que
personne n'a déclaré ; confondre `aucun_projet` et `a_definir` transformerait un
signal de disqualification en signal d'indécision — l'inverse commercial.

D'où `buyer_interests.budget_choice`, **stocké tel quel**, à côté de
`budget_band`. Aucune conversion, dans aucun sens. Un code étranger au
vocabulaire est **ignoré**, jamais rapproché du voisin le plus proche. Les
soumissions historiques ne sont pas réécrites.

`buyer_choice_bounds()` donne les bornes du nouveau vocabulaire.
`aucun_projet` n'en a **aucune** : c'est une absence de projet, pas un budget
inconnu.

---

## 3. Les deux écrans

### Écran 1 — le projet

Une seule question, au mot près :

> **Avez-vous un projet ? Si oui, quel est votre budget ?**

- Non, je n'ai pas de projet → `aucun_projet`
- Oui, entre 500 000 € et 1 million d'euros → `500k_1m`
- Oui, entre 1 et 2 millions d'euros → `1m_2m`
- Oui, entre 2 et 3 millions d'euros → `2m_3m`
- Plus de 3 millions d'euros → `plus_3m`

**Aucune autre question de qualification** : ni horizon d'achat, ni nature de
projet, ni financement. Le formulaire est court par décision, pas par oubli.

### Écran 2 — la prise de contact

Quatre champs obligatoires, et rien d'autre : **Prénom, Nom, E-mail,
Téléphone**. Plus le texte d'information sur l'usage des données.

**Aucune case marketing obligatoire, aucun consentement implicite.** L'accord
marketing est une case **facultative, décochée**, qui ne conditionne rien : la
demande de brochure aboutit exactement pareil qu'on l'accepte ou qu'on la
refuse. Le refus est consigné comme une réponse, pas comme une erreur.

Le traitement de la demande repose sur la demande elle-même ; l'usage marketing
ultérieur repose sur la case. Les deux sont consignés séparément dans
`consent_proof`.

Il n'y a **jamais** de troisième écran — `UNIVERSAL_STEPS` en déclare deux, et
un test le vérifie.

---

## 4. Après une soumission valide

1. le contact est créé ou **rattaché** à l'existant (dédoublonnage par e-mail) ;
2. l'intérêt est créé et lié au bien ;
3. la réponse est conservée **telle quelle** ;
4. l'attribution complète est conservée : UTM, `fbclid`, `gclid`, URL d'origine,
   referrer, premier et dernier point de contact ;
5. la confirmation s'affiche ;
6. **la brochure est donnée immédiatement**, à l'écran.

**Aucun e-mail ni SMS n'est déclenché.** Rien n'est envoyé à la personne.

La brochure passe par `buyer_form_brochure(slug, interest_id)` : l'adresse
n'est délivrée que **contre un intérêt réellement enregistré**. Deviner un
identifiant public ne suffit pas à l'obtenir, et elle n'apparaît jamais dans le
contexte public de la page.

---

## 5. La route embarquable

`/bien/<slug>/interet` répond dès que le slug existe **et** que le formulaire
est actif — la vitrine peut rester non publiée. Sinon : 404 propre.

Tant que la vitrine n'est pas publiée, la page ne révèle **rien du bien** : ni
nom, ni prix, ni adresse, ni contenu non validé. `buyer_form_context()` ne
renvoie le nom public **que** si `publication_status = 'publie'`. Le visiteur
arrive d'une annonce qui, elle, présente déjà le bien.

La page n'est **jamais indexée** (`robots: noindex`).

---

## 6. Protections d'intégration

### `frame-ancestors` décide seul

La liste des domaines autorisés est propre à chaque bien : l'en-tête se calcule
donc **par requête**, dans le middleware (une page ne peut pas poser ses propres
en-têtes de réponse). `X-Frame-Options` est retiré : il ne sait pas exprimer une
liste, et un `SAMEORIGIN` résiduel bloquerait une intégration pourtant
autorisée.

- Liste vide ⇒ `frame-ancestors 'self'` — **aucun site tiers**, la page reste
  consultable en direct.
- Lecture en échec ⇒ on retombe sur la politique la plus fermée. Un doute ne
  doit jamais ouvrir le cadre.
- Une origine mal formée est **écartée**, jamais réparée au jugé : accepter
  `https://exemple.test/brochure` autoriserait tout le domaine. `javascript:`,
  `data:`, les identifiants intégrés et les espaces sont refusés. `*` n'est
  jamais produit.

### `postMessage` ne transporte qu'une hauteur

Embarqué chez un tiers, le formulaire ne peut pas se redimensionner seul : sans
message il est tronqué à chaque changement d'écran. Il publie donc sa hauteur,
**et rien d'autre**. Aucune réponse, aucune coordonnée, aucun identifiant ne
transite par ce canal — il est lisible par la page hôte, qui n'a pas à savoir ce
que la personne saisit.

La cible reste `"*"` : une hauteur n'est pas une donnée sensible, et le parent
légitime est déjà filtré en amont par `frame-ancestors`.

---

## 7. Réglages dans le cockpit

Bloc « Formulaire acquéreur », sur la fiche du bien :

1. définir ou vérifier l'**identifiant public** ;
2. **ouvrir ou fermer la collecte** (réservé aux décisionnaires) ;
3. renseigner la **destination de la brochure** ;
4. déclarer les **domaines autorisés** ;
5. **copier l'adresse** ou le **code d'intégration**.

**Aucun de ces gestes ne publie la vitrine.** `crm_property_set_buyer_form` ne
touche jamais `publication_status` — elle crée la configuration en `brouillon`
si elle n'existe pas, et consigne dans le journal d'audit que la publication n'a
pas bougé, pour que le lecteur puisse le constater sans recouper.

Une origine écartée est **dite** à l'écran, pas corrigée en douce.

---

## 8. Permissions

| Geste | Qui |
|---|---|
| Lire les réglages | accès au bien (`crm_property_access`) |
| Identifiant, brochure, domaines | accès au bien |
| **Ouvrir / fermer la collecte** | administrateur ou manager (`crm_can_decide`) |
| Déposer une demande | public (`anon`), via `submit_buyer_interest` |

`crm_property_set_buyer_form` est `SECURITY DEFINER`, `search_path` épinglé,
`EXECUTE` révoqué de `public` et `anon`. `buyer_form_context` et
`buyer_form_brochure` sont ouvertes à `anon` — c'est leur rôle — mais ne
renvoient que le strict nécessaire.

---

## 9. Tests

- `universal.test.ts` — vocabulaire disjoint des anciennes bandes, bornes,
  deux écrans et jamais trois, quatre champs suffisants, aucun consentement
  implicite, pot de miel accepté par le schéma (le piège se referme ailleurs).
- `universal-payload.test.ts` — `budget_choice` jamais dans `budget_band`,
  brut séparé du normalisé, attribution complète, refus marketing consigné
  sans bloquer.
- `universal-submit.test.ts` — aucun dépôt sans Turnstile, brochure jamais
  délivrée sans intérêt réel, accusé neutre, pot de miel silencieux, code de
  budget étranger refusé sans rapprochement.
- `embed-policy.test.ts` — origines normalisées ou écartées, `'self'` toujours
  présent, `*` jamais produit.
- `universal-form.test.tsx` — le parcours réel : question exacte, cinq
  réponses, aucune autre question, quatre champs, brochure remise, nom du bien
  non divulgué, saisie conservée en cas d'échec.

Migrations rejouées sur base PostgreSQL vierge, invariants prouvés en
transaction annulée (voir le message de commit).

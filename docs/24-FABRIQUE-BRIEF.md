# 24 — Fabrique : créer un bien à partir d'un brief

> **Périmètre.** Ce document décrit la **seconde porte d'entrée** d'un bien dans
> la Fabrique : un bien **détenu par une organisation partenaire** qui le
> commercialise elle-même, **sans mandat Prodigio**. Il décrit aussi l'analyseur
> de brief déterministe qui pré-remplit la fiche.
>
> **Hors périmètre de cette livraison** : le formulaire acquéreur universel,
> l'intégration d'une landing de bien, la limitation de débit publique, le
> Centre de communications. Ils feront l'objet de livraisons distinctes.

---

## 1. Pourquoi une seconde porte d'entrée

Jusqu'ici, un bien ne pouvait naître que d'un **mandat signé** :
`crm_handoff_create_property(p_mandate_id)` exigeait une opportunité premium, un
mandat signé, une organisation porteuse et un document signé. Les colonnes
`properties.mandate_id` et `properties.opportunity_id` étaient toutes deux
`NOT NULL` : **un bien sans mandat était structurellement impossible.**

Ce modèle ne couvre pas un cas réel : un **marchand de biens qui est lui-même
agent immobilier**, propriétaire des villas qu'il vend. Il n'y a **pas de
mandat** — il ne se mandate pas lui-même. Prodigio l'**assiste dans la
commercialisation** de ses biens.

Deux portes d'entrée coexistent donc, et une seule s'applique à un bien donné.

| | `mandat_prodigio` | `partenaire_commercialisation` |
|---|---|---|
| Origine | Mandat signé transformé en bien | Bien détenu par une organisation partenaire |
| `opportunity_id` | **obligatoire** | **doit être nul** |
| `mandate_id` | **obligatoire** | **doit être nul** |
| `holder_organization_id` | facultatif | **obligatoire** |
| Créé par | `crm_handoff_create_property(uuid)` | `crm_property_create_partner(uuid, text)` |
| Déclenché depuis | Le dossier de mandat | `/crm/biens/nouveau` |

L'invariant est porté par **la base**, pas par l'application :

```sql
check (
  (commercialization_origin = 'mandat_prodigio'
     and opportunity_id is not null and mandate_id is not null)
  or
  (commercialization_origin = 'partenaire_commercialisation'
     and opportunity_id is null and mandate_id is null
     and holder_organization_id is not null)
)
```

Aucun bien ne peut donc exister **sans l'un ou l'autre rattachement**, quelle que
soit la voie d'écriture. La clé étrangère vers `organizations` est en
`ON DELETE RESTRICT` : une organisation qui porte encore des biens ne se
supprime pas, et un bien n'est jamais silencieusement orphelin.

Migrations concernées :

- `20260921180000_properties_sans_mandat_v1.sql` — ouvre la seconde porte
  (colonnes rendues nullables, `commercialization_origin`,
  `crm_property_create_partner`, élargissement de `crm_property_access` et de la
  politique RLS `properties_read` à l'agent membre de l'organisation porteuse) ;
- `20260921190000_properties_partenaire_invariants_v1.sql` — correctif
  **additif** : jeton `partenaire_commercialisation`, organisation porteuse
  rendue obligatoire, `ON DELETE RESTRICT`.

La seconde migration corrige la première **sans la modifier ni la rejouer** :
une migration déjà appliquée reste historique.

---

## 2. L'analyseur de brief

`src/modules/properties/brief/parse.ts` — fonction **pure**, aucune dépendance
serveur, **aucun fournisseur d'IA**, aucun appel réseau. Elle est donc testable
unitairement et son comportement est intégralement déterministe.

### Ce qu'elle reconnaît

Nom, type de bien, adresse, ville, code postal, pays, prix, surface habitable,
terrain / parcelle, pièces, chambres, année de construction, **année de
rénovation**, organisation porteuse, liens utiles, caractéristiques courantes.

Elle fonctionne sur :

- des **paires clé/valeur** (`Surface : 160 m²`), y compris avec `=` ;
- un **brief rédigé en paragraphes** ;
- des montants écrits avec **espaces, points, apostrophes ou symbole euro** —
  `1 490 000 €`, `1.490.000€`, `1490000 EUR`, `1,49 M€`, `890 k€` ;
- les unités **`m²`, `m2`, `mètres carrés`**.

Un séparateur n'est retiré que s'il découpe des groupes de trois chiffres :
`1.490` vaut mille quatre cent quatre-vingt-dix, `1.49` vaut un virgule
quarante-neuf. Le contexte immédiat distingue la surface habitable du terrain
(`terrain de 850 m²` → parcelle).

### Les quatre règles qu'elle ne transgresse jamais

1. **Ne jamais inventer une valeur.** Un passage incompris — étiquette inconnue,
   valeur illisible (`Prix : à définir`), phrase non interprétable — est restitué
   **tel quel** dans « Non reconnu ». Il n'est ni deviné, ni supprimé.
2. **Ne jamais trancher entre deux informations contradictoires.** Deux prix
   différents produisent une **contradiction** : le champ reste vide, les deux
   valeurs sont affichées avec leur extrait d'origine, et un humain choisit. Deux
   écritures d'une **même** valeur (`1 490 000 €` et `1.490.000 EUR`) ne sont pas
   une contradiction.
3. **Une année de rénovation n'est jamais une année de construction.** Les deux
   sont extraites séparément ; la rénovation n'alimente jamais `year_built`, ni
   dans l'analyse, ni dans la prévisualisation, ni à l'écriture. Un brief qui ne
   parle que de rénovation laisse l'année de construction **manquante**.
4. **Elle n'écrit rien.** Elle ne fait que proposer.

---

## 3. Le parcours, en quatre temps

`/crm/biens/nouveau` — accessible depuis le portefeuille des biens.

1. **Brief** — on colle le texte. Rien n'est enregistré.
2. **Analyse** — quatre blocs : *Reconnu*, *Manquant*, *Contradictions*,
   *Non reconnu*. **Toujours aucune écriture** : ni organisation, ni bien. Le
   clic sur « Analyser » ne crée jamais rien.
3. **Prévisualisation** — la fiche structurée, **éditable**. On y choisit
   l'organisation porteuse, on corrige, on complète, on peut revenir au brief.
4. **Confirmation** — un seul bouton, **« Créer le bien en brouillon »**. Le bien
   naît en `preparation_a_lancer` : **jamais publié**, sans slug, sans formulaire
   actif.

Le prix lu dans le brief est **affiché** à l'étape 3 mais n'est pas écrit : il se
renseigne dans le cockpit du bien, avec son contexte.

---

## 4. L'organisation porteuse

Un bien partenaire **ne peut pas exister sans organisation porteuse** — c'est un
invariant de base, pas une règle d'interface.

La résolution (`organization.ts`, pure et testée) confronte le nom lu au brief à
l'annuaire réel :

| Situation | Résultat |
|---|---|
| Nom absent du brief | `absente` — la création est impossible tant qu'on n'en choisit pas une |
| Correspondance unique (nom **ou** identifiant, accents et casse ignorés) | `existante` — **réutilisée**, jamais dupliquée |
| Plusieurs correspondances | `ambigue` — un humain tranche, la Fabrique jamais |
| Aucune correspondance | `a_enregistrer` — proposition, **à confirmer** |

L'enregistrement effectif passe par `crm_register_partner_organization(text, text)`
et n'a lieu **qu'à la confirmation**, jamais au clic sur « Analyser ». Il est
réservé aux **administrateurs** ; un manager doit sélectionner une organisation
existante.

**Si l'organisation est enregistrée mais que la création du bien échoue**,
l'action le dit explicitement et invite à **sélectionner cette organisation** au
nouvel essai, plutôt qu'à en créer une seconde. Symétriquement, si le bien est
créé mais que la mise à jour de sa fiche échoue, le bien **n'est pas supprimé** :
le message renvoie vers le cockpit pour la compléter.

`crm_property_create_partner` est en outre **idempotente** par
(organisation porteuse, nom de projet) : rejouer l'appel renvoie le bien existant
avec `already: true` au lieu d'en créer un second.

---

## 5. Permissions

Vérifiées à **trois niveaux**, la base faisant autorité.

| Rôle | Ouvrir l'écran | Analyser | Créer le bien | Enregistrer une organisation |
|---|---|---|---|---|
| `administrateur` | oui | oui | oui | oui |
| `manager` | oui | oui | oui | **non** |
| `setter` | non (redirigé) | non | non | non |
| `agent_immobilier` | non (redirigé) | non | non | non |
| `partenaire_lecture` | non | non | non | non |
| non authentifié | redirigé vers `/connexion` | non | non | non |

- **Interface** : la page redirige, le bouton du portefeuille n'apparaît pas, le
  champ d'enregistrement d'organisation est masqué.
- **Action serveur** : `requireCrmSession()` puis `canDecideMandate()` /
  `canAdminEconomicRules()` — défense en profondeur, jamais la seule garde.
- **Base** : `crm_property_create_partner` refuse sans `auth.uid()` (`28000`) et
  sans `crm_can_decide()` (`42501`) ; `crm_register_partner_organization` exige
  `administrateur`. Les deux sont `SECURITY DEFINER` avec
  `set search_path = public, pg_temp`, `EXECUTE` révoqué de `public` et `anon`,
  accordé aux seuls `authenticated`.

---

## 6. Prévisualisations Vercel

Les déploiements de **prévisualisation** partagent la base réelle. Y créer une
organisation ou un bien polluerait de vraies données.

L'action serveur les **refuse explicitement** quand `VERCEL_ENV=preview`
(`isPreviewDeployment()`), avec un message visible et motivé. L'analyse, elle,
reste possible : c'est une lecture.

Ce n'est **pas un mode test masqué** : le refus est affiché, il ne modifie aucun
comportement, et il n'a **aucun effet en production ni en développement local**.

---

## 7. Ce que cette livraison ne fait pas

- Elle ne publie aucun bien, ne génère aucun slug, n'active aucun formulaire.
- Elle n'écrit pas le prix : le cockpit s'en charge, avec son contexte.
- Elle ne crée **aucun bien de recette** : la villa Verdun n'est pas créée
  automatiquement, et aucune création n'a lieu depuis une prévisualisation.
- Elle n'utilise **aucun fournisseur d'IA**, aucune nouvelle clé, aucun service
  externe.

---

## 8. Tests

- `src/modules/properties/brief/parse.test.ts` — nombres, montants, surfaces,
  brief clé/valeur, brief en paragraphes, contradictions, passages incompris,
  liens, champs manquants, et la règle « rénovation ≠ construction ».
- `src/modules/properties/brief/organization.test.ts` — identifiants, réutilisation,
  homonymes, proposition d'enregistrement, absence.
- `src/modules/properties/brief/actions.test.ts` — « Analyser » n'écrit rien,
  refus par rôle, organisation obligatoire, refus en prévisualisation,
  idempotence, échecs partiels (organisation créée / fiche non mise à jour).
- `src/components/crm/property/brief-factory.test.tsx` — le parcours réel en
  quatre étapes, le libellé exact du bouton de confirmation, l'année de
  rénovation qui ne devient jamais une année de construction, et la saisie
  conservée en cas d'échec.

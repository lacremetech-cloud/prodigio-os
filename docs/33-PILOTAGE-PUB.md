# 33 — Pilotage pub

Relier la dépense publicitaire aux commissions de Prodigio, bien par bien :
combien chaque bien peut rapporter, combien on a investi pour le vendre, et si
cela vaut le coup. Une vue générale et une vue par bien. **Réservé aux
administrateurs**, en base comme à l'écran.

> « Cockpit » est déjà pris (« Cockpit du bien », `/crm/biens/[id]`) : la page
> s'appelle **Pilotage pub** (`/crm/pilotage`).

## 1. Décision et découpage

Décision de Victor du **12 novembre 2026** : le cockpit construit sur son poste
(projet local, Python) entre dans Prodigio OS, où sont déjà les mandats et le
CRM acquéreurs. Cette décision **étend le périmètre du MVP** (voir
[02-MVP-SCOPE.md](02-MVP-SCOPE.md)) : la lecture des dépenses publicitaires et
le calcul des commissions, jusque-là exclus, y entrent.

Quatre étapes, une PR chacune, dans cet ordre, chacune validée par Victor avant
la suivante :

| Étape | Contenu | État |
|---|---|---|
| **1. Les données** | Conditions de commercialisation versionnées, lots, coûts fixes, formulaires d'administration | **cette PR** |
| 2. Lecture Meta | Statistiques Meta Ads chaque matin, **en lecture seule** ; rattachement des campagnes aux biens | à venir |
| 3. Page Pilotage | Vue générale et onglets par bien, avec les données du CRM par bien (nombres agrégés seulement) | à venir |
| 4. Remontée vers Meta | Conversions (API de conversions) — **à la toute fin, avec Victor, rien avant son feu vert** | à venir |

Deux consignes de Victor tiennent pour toutes les étapes : lire les chiffres
Meta, oui ; **rien n'est écrit chez Meta avant l'étape 4**. Et aucune donnée
personnelle d'acquéreur dans le pilotage : uniquement des nombres agrégés.

---

## 2. Étape 1 — les données

### 2.1 Ce qui se saisit

Écran **`/crm/pilotage/donnees`** — menu **Biens → Pilotage pub**, ou
**Paramètres → Données du pilotage pub**. Une page par bien.

| Objet | Contenu | Table |
|---|---|---|
| **Conditions de commercialisation** (versionnées) | vente en un bloc ou par lots ; nature du prix ; prix affiché ; taux de commission ; base HT/TTC des honoraires ; part de Prodigio ; TVA des honoraires ; statut commercial ; prix de vente final et date (si vendu) ; **date d'effet, auteur, motif** | `pilotage_conditions` |
| **Lots d'un programme** | numéro (immuable) ; puis, par état successif : description, prix, statut, prix de vente final, date de vente, retrait | `pilotage_lots`, `pilotage_lot_versions` |
| **Coûts fixes** | type (Production — tournage, Montage, Photos, Autre), montant **HT**, note ; **date et heure de saisie notées d'office** ; annulation datée | `pilotage_couts_fixes` |

Statuts commerciaux d'un bien ou d'un lot : **À vendre → Sous offre → Compromis
signé → Vendu**. Ils sont distincts du statut de la Fabrique de biens
(`properties.status` : préparation, production, en diffusion…) et des étapes du
pipeline acquéreur.

### 2.2 Rien ne s'efface, rien ne se réécrit

- **Conditions** : chaque changement est une **nouvelle ligne**. La version qui
  s'applique un jour donné est celle dont la **date d'effet** est la plus
  récente sans dépasser ce jour ; à date égale, la dernière saisie. Corriger une
  saisie du jour = enregistrer une nouvelle version datée du même jour. Une
  version datée de demain est enregistrée, mais ne s'applique que demain.
- **Lots** : le numéro est l'identité du lot ; il ne change pas (une erreur de
  numéro se corrige en retirant le lot et en créant le bon). Chaque modification
  ajoute un état ; le dernier fait foi. **Retirer** un lot le sort du pilotage
  sans rien effacer ; il peut y revenir.
- **Coûts fixes** : une erreur se corrige par **« Annuler »** : la saisie reste
  visible, barrée, avec la date d'annulation, et sort des calculs.

Ces règles sont tenues **par la base**, pas seulement par l'écran : des
déclencheurs refusent toute modification ou suppression — y compris par le rôle
de service —, sauf l'annulation d'un coût, une fois. Un bien qui porte un
historique de pilotage ne peut pas être supprimé (`on delete restrict`).

### 2.3 Les valeurs de départ

Les valeurs du portefeuille (prix, taux, parts, lots des Airelles) se saisissent
**par ces formulaires**, par Victor ou par une session Claude avec son accord
écrit. **Jamais par une migration, ni dans le code** : le dépôt est public, et
les aperçus Vercel écrivent dans la base de production. Un test refuse toute
migration qui insérerait une ligne du pilotage.

Pour la même raison, ce document ne recopie pas le tableau du portefeuille.

> ⚠️ Un aperçu Vercel lit et écrit **la base de production**. Ce qu'on saisit
> sur un aperçu est réel : **aucune donnée d'essai**.

---

## 3. Le calcul (règles validées le 12/11/2026)

1. `prix_net_vendeur = prix_affiché_FAI ÷ (1 + taux_com)`
2. `com_totale_TTC = prix_affiché_FAI − prix_net_vendeur`
3. `com_prodigio_TTC = com_totale_TTC × part_prodigio`
4. `com_prodigio_HT = com_prodigio_TTC ÷ (1 + TVA)` — TVA à 20 % aujourd'hui,
   **saisie** avec les conditions, jamais écrite dans le code
5. la dépense Meta est prise comme HT *(étape 2)*
6. `ROAS = com_prodigio_HT ÷ pub_meta_HT`, sans les coûts fixes ; intitulé
   « ROAS potentiel » tant que rien n'est vendu *(étape 3)*
7. `marge_nette_HT = com_prodigio_HT − pub_meta_HT − coûts_fixes_HT` *(étape 3)*
8. **potentiel** sur le prix affiché ; **encaissé** seulement pour un bien ou un
   lot **vendu**, sur le **prix de vente final**

**Calcul exact, arrondi seulement à l'affichage.** Les montants sont en
centimes ; les divisions sont tenues en **fractions exactes**
(`src/modules/pilotage/exact.ts`), jamais en virgule flottante. Les totaux
additionnent les valeurs exactes et n'arrondissent qu'une fois : additionner
des lots déjà arrondis fausserait le total d'un à deux euros.

**Chiffres de contrôle**, couverts par des tests
(`src/modules/pilotage/commission.test.ts`) :

| Exemple | Net vendeur | Com totale TTC | Com Prodigio TTC | Com Prodigio HT |
|---|---|---|---|---|
| 1 400 000 € FAI, 3,75 %, 70 % | 1 349 398 € | 50 602 € | 35 422 € | 29 518 € |
| 1 200 000 € FAI, 3,75 %, 50 % | 1 156 627 € | 43 373 € | 21 687 € | 18 072 € |

**Ce qui manque reste manquant, jamais 0**, avec sa raison : prix, taux, part
ou TVA absents ; base des honoraires « à confirmer » ou « HT » — la règle
validée suppose un **taux TTC**, et aucune autre formule n'a été validée ; prix
de vente final non saisi pour un bien vendu. Un total auquel manque une ligne
s'affiche « au moins … (1 ligne manque) ».

### Notions à ne pas confondre

- **Nature du prix ≠ base HT/TTC des honoraires.** Les Airelles sont vendues sur
  une grille de prix **HT** de promoteur (TVA immobilière sur le neuf) ; ce prix
  HT est **pris comme prix affiché**, comme Victor l'a décidé. La base HT/TTC des
  honoraires, elle, dit si le **taux de commission** est TTC. Deux champs
  distincts ; jamais l'un n'est déduit de l'autre (constitution, §1). La
  question de la base des Airelles reste ouverte ([05](05-OPEN-QUESTIONS.md), E).
- **Part saisie ≠ photographie du mandat.** Pour un bien sous mandat, la part de
  Prodigio peut venir de la photographie économique du mandat (part laissée
  vide). Si les deux existent et diffèrent, le calcul retient la part saisie et
  **l'écart est signalé**. Le mandat n'est jamais réinterprété.
- **Conditions par bien ≠ règles économiques.** Les règles économiques
  (`economic_rule_sets`, par partenaire et segment) servent à proposer un mandat
  et à en figer la photographie. Les conditions du pilotage décrivent la
  commercialisation **d'un bien** — y compris les biens partenaires, qui n'ont
  pas de mandat. Elles ne modifient aucune règle ni aucun mandat.

---

## 4. Accès et sécurité

| | Administrateur | Manager | Setter | Commercial | Agent | `anon` |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| Lire le pilotage | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Saisir conditions, lots, coûts | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |
| Annuler un coût | ✅ | ⛔ | ⛔ | ⛔ | ⛔ | ⛔ |

- **RLS** sur les quatre tables : lecture `crm_has_role('administrateur')`.
  Droits par défaut de Supabase retirés à `anon` et `authenticated` ; seule la
  lecture filtrée est rendue. **Aucune** écriture directe, même pour un
  administrateur.
- **Écritures** : `crm_pilotage_enregistrer_conditions`,
  `crm_pilotage_enregistrer_lot`, `crm_pilotage_saisir_cout_fixe`,
  `crm_pilotage_annuler_cout_fixe` — `SECURITY DEFINER`, `search_path` figé,
  rôle revérifié, `EXECUTE` refusé à `public` et `anon`. Les deux fonctions de
  déclencheur ne sont exécutables par aucun client.
- **Journal d'audit sans montant.** `audit_events` est lisible par les
  managers. Les événements du pilotage (`pilotage_conditions_saisies`,
  `pilotage_lot_cree`, `pilotage_lot_modifie`, `pilotage_cout_saisi`,
  `pilotage_cout_annule`) n'y portent que des identifiants (bien, version, lot,
  numéro de lot, date d'effet) : ni prix, ni taux, ni part, ni montant, ni motif.
  Leurs types d'entité (`pilotage_*`) les tiennent hors de l'historique du bien
  affiché sur la fiche. *Un manager peut donc voir qu'une saisie a eu lieu, pas
  ce qu'elle contient* — le restreindre davantage est une décision ouverte
  ([05](05-OPEN-QUESTIONS.md), E).
- **Double envoi** : un coût porte une clé tirée à l'affichage du formulaire ; la
  base la tient pour unique. Un double clic ne compte qu'une fois.
- **Lecture complète** : les pages lisent page après page ; un total n'est
  jamais calculé sur une liste tronquée par PostgREST.

Garde-fous automatiques (Vitest, sur le SQL versionné) :

- `src/modules/pilotage/migration.test.ts` — RLS, politiques, droits, aucune
  clé autre qu'un identifiant au journal, **aucune ligne du pilotage insérée par
  une migration**, chaque jeton de la base a son libellé ;
- `src/modules/crm/audit-contraintes.test.ts` — **pour tout le dépôt** : chaque
  réécriture des listes fermées d'`audit_events` garde toutes les valeurs de la
  précédente, et tout type écrit par une fonction y figure.

---

## 5. Mise en service

1. **Appliquer la migration** `supabase/migrations/20261112150000_pilotage_conditions_lots_et_couts_fixes.sql`
   sur le projet Supabase, **une seule fois** (éditeur SQL ou outil officiel ;
   voir [07-SUPABASE-SETUP.md](07-SUPABASE-SETUP.md) §14). Elle est
   transactionnelle et additive. Tant qu'elle ne l'est pas, les pages du pilotage
   affichent « Pas encore installé » au lieu d'échouer.
2. **Vérifier** avec les requêtes de contrôle de [07](07-SUPABASE-SETUP.md) §14.
3. **Saisir les valeurs de départ** dans `/crm/pilotage/donnees`, bien par bien,
   et contrôler les montants affichés (« Contrôle du calcul »).

Aucune variable d'environnement n'est nécessaire à l'étape 1.

### Recette locale (sans toucher à aucune base distante)

```bash
bash scripts/replay-migrations.sh
psql -h /var/run/postgresql -p 55432 -U postgres -d prodigio -f scripts/pilotage-donnees.sql
```

`scripts/pilotage-donnees.sql` rejoue les droits de chaque rôle, les refus de la
base, l'immuabilité, l'annulation et le double envoi. Il refuse de tourner sur
une base qui contient déjà un bien, et annule tout à la fin (`ROLLBACK`).

## 6. Limites de l'étape 1

- Ni dépense Meta, ni ROAS, ni marge, ni données du CRM : étapes 2 et 3. Les
  pages de l'étape 1 servent à **saisir et vérifier** ; elles montrent le calcul
  de la commission à titre de contrôle.
- Un coût fixe d'un programme est commun à ses lots : sa répartition au prorata
  du prix se fera sur la page Pilotage (étape 3).
- La commission encaissée d'un bien vendu sans prix final saisi est
  « manquante » (pas de repli sur le prix affiché) : à confirmer
  ([05](05-OPEN-QUESTIONS.md), E).

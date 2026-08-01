# 18 — Fabrique de biens V1

Cockpit opérationnel qui prend le relais **après la signature du mandat** pour
transformer un bien en projet de commercialisation prêt à être mis sur le
marché. Il prolonge le parcours existant :

```
Lead → qualification → estimation → éligibilité → mandat proposé → mandat signé
     → création automatique idempotente du bien → Fabrique de biens → prêt à lancer
```

La Fabrique **réutilise** l'existant (bien issu du handoff, tâches, audit
immuable, Storage privé, utilisateurs/rôles, design system thème-adaptatif) et
n'ajoute que ce qui manque, en **extensions strictement additives**. Elle ne
duplique ni le système de tâches, ni l'audit, ni les documents.

---

## 1. Périmètre

**Inclus (V1)** — un cockpit par bien avec sept sections :

1. **Identité** — nom de projet, titre commercial, type, adresse (selon droits),
   surface / terrain / pièces / chambres, année, style, description, histoire,
   détail « signature / coup de cœur ». Tous les champs sont **facultatifs** ; la
   préparation au lancement indique lesquels sont requis.
2. **Positionnement & stratégie** — promesse centrale, piliers de valeur,
   différenciateurs, détails émotionnels, acheteur idéal, localisations et
   motivation de l'acheteur, zones cibles, angles publicitaires, « à ne pas
   communiquer », nom de marque, **validation humaine tracée**.
3. **Documents** — réutilisent le Storage privé : catégories mandat, diagnostics,
   plans, titre, légal, copropriété, autorisations, libres ; statut, visibilité,
   date, auteur, **URL signée éphémère**.
4. **Médiathèque privée** — photos, vidéos, drone, plans, rendus, couverture ;
   upload, aperçu/téléchargement par URL signée, renommage, catégorisation,
   choix de l'**image principale**, statut de droits, suppression confirmée.
5. **Plan de production** — onze éléments pilotables (photographie, vidéo, drone,
   rédaction, positionnement, identité visuelle, site dédié, brochure,
   publicités, funnel acquéreurs, validation finale) ; statut, responsable,
   échéance, notes, lien de livrable, date de validation, blocage.
6. **Préparation au lancement** — checklist **calculée en base** ; pourcentage,
   critères faits / manquants, blocages, action suivante. Impossible de déclarer
   « prêt à lancer » tant que les conditions ne sont pas réunies.
7. **Activité & historique** — réutilise l'**AuditEvent immuable** et le composant
   Timeline (correctif de grille). Aucune donnée sensible n'y figure.

**Explicitement hors périmètre (V1)** — préparés comme points d'extension
propres, non développés : CRM acquéreurs, portail propriétaire, **campagnes Meta
réelles**, **publication automatique du site**, **génération complète de
brochure**, e-signature, Twilio/SMS/WhatsApp, séquences e-mail, synchronisation
Google entrante, Fabrique multi-agences avancée.

---

## 2. Machine d'état du bien

Statut porté par `properties.status`, sur-ensemble **strict** de la valeur
initiale `preparation_a_lancer` posée par le handoff (aucune donnée existante
invalidée) :

| Statut | Libellé | Décision sensible |
|---|---|---|
| `preparation_a_lancer` | À configurer (initial) | — |
| `collecte_en_cours` | Collecte en cours | — |
| `strategie_en_cours` | Stratégie en cours | — |
| `production_en_cours` | Production en cours | — |
| `validation_avant_lancement` | Validation avant lancement | — |
| `pret_a_lancer` | Prêt à lancer | **admin / manager + readiness satisfaite** |
| `en_diffusion` | En diffusion | **admin / manager** |
| `suspendu` | Suspendu | **admin / manager** |
| `archive` | Archivé | **admin / manager** |

Les transitions passent **exclusivement** par `crm_property_transition_status`
(SECURITY DEFINER, rôle re-vérifié, audit). Le passage vers `pret_a_lancer` est
**refusé côté serveur** si la readiness n'est pas satisfaite.

---

## 3. Modèle de données (additif)

Aucune table existante n'est modifiée de façon destructive ; aucune migration
historique n'est réécrite.

- **`properties`** — colonnes ajoutées : identité (nom de projet, titre,
  type, adresse, localisation, surface, terrain, pièces, chambres, année,
  style, description, histoire, signature), `responsible_user_id`,
  `main_media_id`, `ready_at` / `ready_by`, `status_reason`. Contrainte de
  statut étendue au sur-ensemble ci-dessus.
- **`property_positioning`** (1-1) — stratégie & marque, avec validation tracée.
- **`property_media`** — médiathèque privée (type, chemin Storage unique, MIME,
  taille, titre, statut de droits, statut actif/supprimé, auteurs).
- **`property_documents`** — documents classés par catégorie (Storage privé).
- **`property_production_items`** — un élément par type et par bien
  (`unique(property_id, kind)`), pilotage des livrables.

Toutes les tables enfants : **RLS activée**, index utiles, `updated_at`
automatique, contraintes CHECK sur les énumérations, FK avec cascade maîtrisée.

`audit_events` : extension **additive** de la contrainte de type d'événement
(`bien_identite`, `bien_positionnement`, `bien_statut`, `bien_responsable`,
`bien_media_ajoute/supprime/principal`, `bien_document_ajoute/supprime`,
`bien_production_maj`, `bien_pret`) et de `entity_type` (`property`).

---

## 4. Sécurité & permissions

- **Accès dérivé, jamais global** : `crm_property_access(property_id)` renvoie
  vrai pour un **opérateur** (admin/manager/setter) ou pour un **agent affecté**
  à l'opportunité d'origine (`crm_assigned_opportunity_ids`). Un agent ne voit
  que les biens de ses dossiers ; `partenaire_lecture` n'a **aucun accès
  automatique**. Les policies RLS des tables enfants s'appuient sur ce helper.
- **Décisions sensibles réservées à admin / manager** (`crm_can_decide`) :
  valider le positionnement, valider un livrable (`statut = valide`), changer le
  responsable, transitions `pret_a_lancer` / `en_diffusion` / `suspendu` /
  `archive`, supprimer un document.
- **Écritures via fonctions `SECURITY DEFINER` uniquement** : `search_path`
  figé (`public, pg_temp`), rôle **re-vérifié dans la fonction**, `EXECUTE`
  accordé aux seuls `authenticated` (jamais `anon` / `public`), écriture d'un
  AuditEvent. Aucune écriture directe de table depuis le navigateur.
- **Cloisonnement** : coordonnées, documents légaux et notes confidentielles
  restent cloisonnés ; le partage d'un dossier ne donne jamais accès aux autres
  biens.

---

## 5. Storage privé

- Bucket **privé** `property-assets` (`public = false`), garde à la création.
- Téléversement / consultation / suppression **exclusivement côté serveur** via
  le rôle de service (client admin), **après** contrôle de rôle et **re-contrôle
  en base**. Le navigateur ne reçoit qu'une **URL signée courte** (≤ 60 s pour
  les téléchargements ; ≤ 300 s pour l'aperçu d'en-tête), **jamais stockée**.
- **Aucune PII dans le chemin** : `{propertyId}/{media|documents}/{uuid}.{ext}`.
- Validation serveur du **type MIME**, de la **taille** (médias ≤ 100 Mo,
  documents ≤ 25 Mo) et **assainissement du nom** (affichage seulement).
- **Compensation** : si l'enregistrement de la métadonnée échoue après un
  upload, le fichier est retiré du bucket (aucun objet orphelin). À la
  suppression, la métadonnée `supprime` fait foi ; le retrait physique est
  best-effort.

---

## 6. Readiness — calculée en base (source de vérité)

`crm_property_readiness(property_id)` (STABLE) calcule **sept critères** et les
blocages, et renvoie un JSON `{ ready, total, done, percent, blocked, checks }` :

1. **Identité** complète (nom de projet, type, ville ou adresse, description).
2. **Positionnement validé**.
3. **Image principale** définie (média actif).
4. Au moins **une photo** dans la médiathèque.
5. **Document de mandat** présent.
6. **Livrables clés validés** : photographie, rédaction, positionnement,
   validation finale — tous au statut `valide`.
7. **Responsable** désigné.

`ready = (done = 7) ET non bloqué`. Un élément de production `bloque` force
`ready = false`. La checklist affichée et le portfolio consomment **toujours**
ce résultat ; aucune logique de readiness n'est réimplémentée côté client.

---

## 7. Événements métier & extension future

Événements audités : création du bien (`bien_cree`, déjà posé par le handoff),
mises à jour d'identité / positionnement, changements de statut, désignation de
responsable, ajout/suppression de média et de document, image principale, mises
à jour du plan de production, et **déclaration « prêt à lancer »** (`bien_pret`).

Points d'extension **préparés, non activés** en V1 : génération de brochure /
site / publicités, synchronisation acquéreurs, portail propriétaire. Le cockpit
prépare le bien **jusqu'à** sa mise sur le marché ; la mise sur le marché
elle-même relève des tranches suivantes.

---

## 8. Tests & recette

- **Tests unitaires** (`src/modules/properties/factory/*.test.ts`) : validation
  MIME / taille / nom et chemins sans PII (Storage), couverture complète des
  libellés + couleurs/icônes (couleur jamais seule), mapping de la timeline du
  bien (transitions, tonalités, absence de donnée sensible).
- **Validation SQL** locale sur la chaîne complète des 12 migrations (cluster
  jetable) : readiness 0/7 → 7/7, blocage `pret_a_lancer` avant readiness,
  succès après, isolation RLS agent non affecté, setter sans décision.
- **Recette réelle** sur le projet distant, avec des **données de test dédiées**
  (`dead0000-…`, jamais de donnée réelle) : handoff idempotent depuis un mandat
  signé, readiness initiale nulle, refus de `pret_a_lancer` trop tôt, parcours
  complet jusqu'à `pret_a_lancer`, idempotence du plan de production (rejeu → 0),
  accès refusé à un non-membre, présence des événements d'audit. **Nettoyage**
  des seules données de test ; les vrais leads / rendez-vous / mandats / biens
  sont **préservés** (vérifié : baseline restaurée à l'identique). Les lignes
  d'audit immuables de la recette subsistent (aucune donnée sensible) — l'audit
  ne peut ni être modifié ni supprimé, y compris par le rôle de service.

---

## 9. Design & accessibilité

Reprise **intégrale** du design system thème-adaptatif (clair / sombre /
système) : tokens sémantiques, couleurs métier **centralisées** (statut =
couleur **+** icône **+** libellé, jamais la couleur seule), cartes
hiérarchisées, champs opaques et lisibles, `min-width: 0` / retour à la ligne,
responsive desktop / tablette / mobile, états vides premium, erreurs visibles,
confirmations pour les suppressions, focus clavier. Le cockpit s'insère dans le
shell `/crm` sous l'entrée **« Fabrique de biens »**.

Captures (données fictives, générées depuis le vrai `crm.css`) dans
`docs/assets/crm/property-factory/` : `portfolio-{dark,light}`,
`cockpit-{dark,light}`, `mobile-{dark,light}`.

---

## 10. Limites restantes

- L'aperçu de l'image d'en-tête utilise une URL signée courte : au-delà de son
  expiration, un rafraîchissement régénère le lien (aucune URL stockée).
- La readiness impose un socle commun ; l'affinage **par segment** (premium vs
  classique) n'est pas encore différencié.
- La génération automatique des supports (brochure, site, publicités) et la
  synchronisation acquéreurs restent hors périmètre (points d'extension prêts).

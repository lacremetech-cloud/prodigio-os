# 15 — Résultat d'estimation → éligibilité → mandat → Fabrique de biens (V1)

Tranche verticale reliant le **résultat d'un rendez-vous d'estimation** au
**passage contrôlé vers la Fabrique de biens**, en passant par la **décision
d'éligibilité**, la **gestion du mandat** (proposition, signature, résultat) et
les **documents** stockés de façon privée.

> Cette V1 s'arrête à la **création d'un socle minimal de bien**. Le tunnel
> acquéreurs, la page de vente, la brochure, les publicités, le portail
> propriétaire et le CRM acquéreurs restent **hors périmètre**.

---

## 1. Distinctions fondamentales respectées

| À ne jamais confondre | Rappel |
|---|---|
| **Opportunité ≠ Mandat ≠ Résultat commercial** | L'opportunité est le dossier ; le mandat est la proposition puis le contrat ; le résultat commercial (`OpportunityOutcome`) est l'issue (gagné / refusé après proposition / perdu avant signature). |
| **Stade ≠ Segment ≠ Éligibilité** | Le stade est la progression commerciale ; le segment est la catégorie du bien ; l'**éligibilité** est une **décision humaine** distincte (gate du parcours premium et du mandat). |
| **Recommandation ≠ décision** | Le scoring recommande ; l'humain décide (segment ET éligibilité), avec dérogation tracée. |
| **Estimation planifiée ≠ estimation réalisée ≠ mandat signé** | Un rendez-vous planifié n'est pas un compte rendu ; un compte rendu n'est pas un mandat ; un mandat proposé n'est pas signé. |
| **Base HT/TTC des honoraires ≠ valeur immobilière du bien** | Deux notions séparées : ne jamais associer automatiquement l'une à l'autre. |

**Portage juridique.** Prodigio est l'opérateur système / marketing et **ne
porte jamais** les mandats. L'organisation **porteuse** d'un mandat est
**toujours** une `agence_partenaire` habilitée, **explicitement sélectionnée**
parmi les organisations configurées. Aucune agence n'est codée en dur ; tant
qu'aucune organisation porteuse n'existe, l'interface affiche un **état bloquant
et compréhensible** plutôt que de créer une entité fictive.

---

## 2. Modèle de données (migration additive)

Migration : `supabase/migrations/20260731120000_estimation_to_mandate_v1.sql`.
**Strictement additive** : aucune migration historique modifiée, aucune donnée
existante altérée.

| Objet | Rôle |
|---|---|
| `opportunities` (colonnes) | Décision d'**éligibilité** (`eligibility_decision`, motif, auteur, date, dérogation) — distincte du segment ; `outcome_reason_code` structuré. |
| `estimation_reports` | Compte rendu d'estimation : résultat du rendez-vous, montants en **centimes** (fourchette + valeur recommandée + prix espéré), état/forces/risques, **notes confidentielles internes**. Un par opportunité. |
| `economic_rule_sets` | Règles économiques **versionnées** (par partenaire / segment, date d'effet, base HT/TTC, parts). Aucune valeur codée en dur. |
| `mandates` | Entité Mandat distincte, avec statut (brouillon → proposé → en attente → signé / refusé / expiré / annulé), **snapshot économique immuable** dès « proposé », organisation porteuse dès « proposé », numéro + date + document dès « signé ». |
| `mandate_documents` | Métadonnées des documents ; le fichier vit dans un **bucket Storage privé**. Aucune PII dans `storage_path`. |
| `properties` | Socle canonique minimal du Bien (handoff). Un seul bien par mandat (idempotent). |

Toutes les écritures passent par des fonctions **`SECURITY DEFINER`**
(`search_path` figé, rôle re-vérifié, **AuditEvent** écrit). `EXECUTE` est retiré
à `anon`/`public` et accordé aux seuls `authenticated`. RLS active partout.

---

## 3. Matrice des droits (appliquée EN BASE)

| Action | administrateur | manager | setter | agent_immobilier | partenaire_lecture / anon |
|---|:--:|:--:|:--:|:--:|:--:|
| Compte rendu d'estimation | ✅ | ✅ | ❌ | ✅ *(dossier affecté)* | ❌ |
| Décision d'éligibilité | ✅ | ✅ | ❌ | ❌ | ❌ |
| Règles économiques / org porteuse | ✅ | ❌ | ❌ | ❌ | ❌ |
| Mandat (brouillon → signé, transitions) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Documents (ajout / suppression) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Résultat « signé / gagné » | ✅ | ✅ | ❌ | ❌ | ❌ |
| Résultat perte / disqualification | ✅ | ✅ | ✅ *(motif obligatoire)* | ❌ | ❌ |
| Handoff Fabrique de biens | ✅ | ✅ | ❌ | ❌ | ❌ |
| Lecture des mandats / documents / biens | ✅ | ✅ | ✅ | ✅ *(dossier affecté)* | ❌ |

L'agent immobilier est restreint **en base** à ses seuls dossiers affectés
(`crm_assigned_opportunity_ids`). Les notes confidentielles de l'estimation ne
sont **jamais** exposées au propriétaire.

---

## 4. Documents — Storage privé (URL signées courtes)

- Bucket **`mandate-documents`** : **privé** (`public = false`), aucune politique
  d'accès direct `authenticated`.
- Téléversement / consultation / suppression du fichier : **exclusivement** via
  le rôle de service côté serveur (`SUPABASE_SECRET_KEY`), **après** contrôle de
  rôle et d'organisation (action serveur) et re-vérification en base
  (`crm_register_document` / `crm_delete_document`).
- Consultation : **URL signée courte** (≈ 60 s), générée à la demande, **jamais
  stockée** en base. La lecture des métadonnées passe par la RLS (l'appelant ne
  peut demander une URL que pour un document qu'il a le droit de voir).
- Validation : type (`application/pdf`, `image/jpeg`, `image/png`), poids
  (≤ 15 Mo), nom assaini. Chemin sans PII : `{opportunityId}/{uuid}.{ext}`.
- Compensation : si l'enregistrement de la métadonnée échoue après le
  téléversement, le fichier est retiré du bucket (aucun objet orphelin).
- Journalisation : actions sensibles auditées **sans** enregistrer le contenu du
  document ni l'URL signée.

Sans `SUPABASE_SECRET_KEY` (preview/dev), l'ajout et la consultation de documents
sont **désactivés proprement** (message de configuration), sans jamais bloquer le
reste du cycle.

---

## 5. Cycle de vie du mandat

```
brouillon ──propose──▶ proposé ──▶ en_attente_signature ──▶ signé
    │                     │                 │
    └── annulé            ├── refusé        ├── refusé / annulé / expiré
                          └── expiré        └── (signé) ── expiré
```

- **Proposer** fige le **snapshot économique** (photographie de la règle active :
  parts, base HT/TTC, version, date d'effet). Un changement ultérieur de règle
  **ne réinterprète pas** ce mandat.
- **Signer** est **manuel** : numéro + date + **document signé** obligatoires
  (aucune signature électronique dans cette V1).
- Un seul mandat **actif** (non terminal) par opportunité.

---

## 6. Passage vers la Fabrique de biens (handoff)

Bouton **« Créer ce bien dans Prodigio »**, disponible uniquement lorsque le
**gate** est rempli :

1. éligibilité = `parcours_premium_prodigio` (décidée par un humain) ;
2. mandat **signé** ;
3. organisation **porteuse** présente ;
4. **document signé** présent.

La création est **idempotente** : un double-clic ou un rejeu ne crée **jamais**
deux biens (contrainte d'unicité `mandate_id` + `on conflict do nothing`). Le bien
conserve le lien vers l'opportunité et le mandat ; une page `/crm/biens/[id]`
affiche le socle minimal et renvoie au dossier.

---

## 7. Règles économiques (administration)

Écran `/crm/parametres/regles-economiques` (**administrateur** uniquement) :

- consulter les règles actives **et l'historique** ;
- créer une **nouvelle version** (date d'entrée en vigueur, base HT/TTC, parts,
  segment, partenaire) ;
- désactiver une règle **sans réinterpréter** les mandats existants ;
- enregistrer une **organisation porteuse** (agence habilitée).

**Aucune valeur n'est préremplie comme vérité de production.** Le seuil premium,
les partages (ex. 70/30, 40/60) et la base HT/TTC ne sont que des **hypothèses de
travail** tant qu'ils n'ont pas été validés et saisis. S'il n'existe aucune règle
active applicable, la **proposition de mandat est empêchée** et l'interface
indique clairement la configuration manquante.

---

## 8. Indicateurs & pipeline

La vue d'ensemble affiche, à partir de données réelles (aucun compteur décoratif),
un indicateur **« En attente d'éligibilité »** (estimation réalisée / étude en
cours, décision non validée), aux côtés des rendez-vous planifiés, mandats
proposés et signés. La distinction stade / segment / éligibilité est préservée.

---

## 9. Sécurité & confidentialité

- RLS active sur toutes les nouvelles tables ; `anon` n'a **aucun** accès.
- Cloisonnement : un agent ne voit que ses dossiers affectés.
- Notes confidentielles d'estimation : jamais exposées au propriétaire.
- Audit **immuable** pour chaque changement sensible, **sans** montants ni notes.
- Aucune clé `service_role` côté navigateur ; le secret sert uniquement au
  Storage privé côté serveur.

---

## 10. Recette réelle (post-fusion)

> Effectuée sur des données **explicitement marquées de test**, jamais sur le
> lead réel ni sur les rendez-vous existants. Les données de test sont supprimées
> à la fin ; les données réelles restent intactes.

1. Appliquer la migration (une seule fois) sur le projet de production.
2. Créer une organisation porteuse de test + une règle économique active de test.
3. Sur un dossier de test : renseigner l'estimation, valider l'éligibilité
   premium, créer un brouillon, proposer (vérifier le snapshot), ajouter un
   document, signer, créer le bien (vérifier l'idempotence au double-clic).
4. Vérifier les rôles (setter, agent affecté vs non affecté), la RLS, l'ACL des
   documents (URL signée courte), l'audit et l'absence de données sensibles dans
   les journaux.
5. Supprimer uniquement les données de recette ; confirmer l'intégrité du lead
   réel.

# Studio Communications & Workflows — V1 (mode brouillon)

> **Statut : V1 livrée en mode brouillon.** Aucun envoi réel, aucune
> automatisation personnalisée exécutable, aucune campagne marketing possible.
> La migration `20260819120000_communications_studio_v1` est **appliquée**
> (version distante `20260819130113`) — voir
> [07-SUPABASE-SETUP.md §14](07-SUPABASE-SETUP.md).

Ce document décrit le studio ajouté à `/crm/communications`. Il complète
[21-COMMUNICATIONS.md](21-COMMUNICATIONS.md), qui décrit la **couche de
communication** elle-même (politique, file, modèles, fournisseurs), et
[adr/002-COMMUNICATIONS-LAYER.md](adr/002-COMMUNICATIONS-LAYER.md), qui en porte
la décision d'architecture.

---

## 1. Intention

Centraliser progressivement, **dans Prodigio OS**, les fonctions qu'assureraient
ActiveCampaign ou Systeme.io : les modèles, les scénarios, les conditions, les
oppositions, l'historique et la préparation à l'activation.

La règle qui gouverne tout le reste :

> **Prodigio OS est la source de vérité.** Les contacts, les choix enregistrés,
> les bases légales déclarées, les modèles, les décisions et l'historique vivent
> ici. **Lumail et Twilio ne seront que des infrastructures de transport**,
> remplaçables sans toucher à un dossier, à un consentement ni à un modèle.

Un changement de fournisseur doit rester un changement d'adaptateur. C'est
pourquoi aucun identifiant, aucun objet et aucune sémantique propriétaire ne
remonte dans le domaine.

---

## 2. Vocabulaire — six notions à ne jamais confondre

| Notion | Ce que c'est | Ce que ce n'est pas |
|---|---|---|
| **Modèle** (`communication_templates`) | Un contenu **versionné** : clé stable + numéro de version, sujet, corps, variables déclarées. | Ce n'est pas un message. Un modèle ne s'envoie pas ; il se rend. |
| **Workflow / automatisation** (`communication_automations`) | Une **définition** : quel événement, sous quelles conditions, après quel délai, avec quel modèle et quel canal. | Ce n'est pas une exécution. Une définition ne produit rien par elle-même. |
| **Événement** (catalogue métier) | Un **fait** survenu dans le CRM (demande déposée, rendez-vous confirmé…). | Ce n'est pas un envoi. Un événement peut n'aboutir à aucun message. |
| **Outbox** (`communication_outbox`) | La **file** des événements à traiter, écrite dans la même transaction que le fait métier. | Ce n'est pas une file d'envoi. Une ligne peut être ignorée, avec motif. |
| **Message** (`communication_messages`) | Un message **préparé** pour un contact : contenu rendu, statut, motif. | « Préparé » ne veut pas dire « parti ». |
| **Livraison** | Un statut de livraison **rapporté par le fournisseur**. | Une réponse `200` à l'envoi ne prouve **que** la mise en file. |

### La chaîne, dans l'ordre

```
Fait métier ──► Événement (outbox, même transaction)
                    │
                    ▼
              Politique d'éligibilité  ──► bloqué (motif lisible)
                    │
                    ▼
              Message PRÉPARÉ (contenu rendu, tracé)
                    │
                    ▼  [dispatcher, si l'interrupteur est armé]
              EN FILE CHEZ LE FOURNISSEUR   ← ni « envoyé », ni « livré »
                    │
                    ▼  [preuve fournisseur requise]
              LIVRÉ
```

Chaque flèche est un fait distinct, horodaté séparément. L'historique d'un
dossier affiche les trois dates — **préparé**, **mis en file**, **livraison
prouvée** — précisément pour qu'on ne puisse pas les confondre.

---

## 3. Architecture du studio

```
src/modules/communications/studio/
├── system-automations.ts   Projection LECTURE SEULE des six événements existants
├── automation.ts           Modèle de brouillon : statuts, catalogue de conditions, validation
├── fixtures.ts             Destinataires FICTIFS du simulateur
├── simulator.ts            Simulation pure, étape par étape
├── activation.ts           Préparation à l'activation (transactionnel / marketing)
├── preview.ts              Prévisualisation et contrôle des variables
├── diff.ts                 Comparaison de deux versions de modèle
├── queries.ts              Lectures serveur (server-only) — le SEUL fichier qui parle à la base
└── index.ts                Barillet des modules PURS (utilisables côté navigateur)

src/components/crm/communications/studio/
├── studio-nav.tsx          Onglets du studio
├── overview-stats.tsx      Vue d'ensemble chiffrée
├── activation-center.tsx   Encart « Activation des communications »
├── template-studio.tsx     Modèles : aperçu, nouvelle version, comparaison
├── automation-studio.tsx   Automatisations système + brouillons personnalisés
├── workflow-simulator.tsx  Simulateur
└── suppressions-view.tsx   Registre des oppositions

src/app/crm/communications/
├── layout.tsx              Garde d'accès + onglets
├── page.tsx                Vue d'ensemble
├── modeles/page.tsx
├── automatisations/page.tsx
├── simulateur/page.tsx
└── oppositions/page.tsx
```

Tout ce qui vit hors de `queries.ts` est **pur** : aucune entrée/sortie, aucun
accès réseau, aucun accès base. Un test relit le code source et échoue si un
`fetch`, un import de fournisseur ou un client Supabase y apparaît.

---

## 4. Automatisations système ≠ automatisations personnalisées

### Automatisations système — six, en lecture seule

Les six communications transactionnelles déjà en production **ne sont pas des
lignes de base**. Elles sont portées par les déclencheurs SQL de
`20260818120000_communications_v1.sql` et décrites par le catalogue TypeScript
`src/modules/communications/events.ts`.

Le studio les **projette** depuis cette source unique :

| Événement | Modèle | Canal | Particularité |
|---|---|---|---|
| Demande de mandat enregistrée | `mandat_demande_accusee` | E-mail | Accusé de réception d'une demande de la personne |
| Intérêt acquéreur enregistré | `acquereur_interet_accuse` | E-mail | Accusé de réception, aucune prospection |
| Estimation planifiée | `estimation_planifiee` | E-mail | **Google Calendar couvre déjà l'envoi** au propriétaire invité |
| Estimation reportée | `estimation_reportee` | E-mail | Idem |
| Estimation annulée | `estimation_annulee` | E-mail | Idem |
| Rappel de rendez-vous | `estimation_rappel` | E-mail | **Responsabilité Prodigio** — Google ne garantit aucun rappel |

C'est la garantie anti-doublon : le studio ne peut pas créer un second
déclencheur ni un second message pour un événement déjà couvert, puisqu'il
n'invente rien — il lit. L'éditeur avertit d'ailleurs explicitement lorsqu'un
brouillon vise un couple (événement, canal) déjà assuré par le système.

### Automatisations personnalisées — brouillons, et rien d'autre

Une automatisation personnalisée définit :

- un **nom** et une clé technique ;
- un **événement déclencheur** issu du catalogue métier existant ;
- des **conditions déclaratives et déterministes** (catalogue fermé) ;
- un **délai** ;
- un **canal** ;
- un **modèle versionné**, avec une version épinglée ou « version active » ;
- un **statut** : brouillon, prêt pour revue, suspendu, archivé.

Chaque enregistrement crée une **nouvelle version** : aucune version antérieure
n'est jamais écrasée.

#### Pourquoi aucune ne peut s'exécuter

Trois barrières **indépendantes**, dont la dernière ne dépend pas de
l'application :

1. **Le type** — `DRAFT_AUTOMATION_STATUSES` ne contient pas `actif`. Aucun
   écran ne peut donc proposer l'activation.
2. **L'action serveur** — le schéma Zod rejette `actif` avant même d'ouvrir une
   session ou de joindre la base.
3. **La base** — la contrainte `communication_automations_status_check` retire
   `actif` du domaine, et `crm_comm_set_automation_status` refuse la valeur avec
   une erreur `42501`. Un `insert` ou un `update` direct, même par un
   administrateur, échoue.

Il n'existe par ailleurs **aucun moteur d'exécution** : rien ne lit
`communication_automations` pour agir. La table `communication_automation_runs`
reste vide.

#### Catalogue fermé des conditions

`segment`, `stade`, `canal_autorise`, `categorie`, `source`, `sans_opposition`,
`sans_message_recent`. Chaque valeur est un **scalaire** (texte, nombre ou
booléen) — jamais une expression, jamais du code, jamais une donnée personnelle.
Le catalogue TypeScript et la fonction SQL `comm_automation_conditions_valid`
sont tenus identiques par un test.

---

## 5. Modèles

Depuis `/crm/communications/modeles`, un administrateur ou un manager peut :

- consulter toutes les versions d'un modèle ;
- créer une **nouvelle version** (toujours en brouillon, jamais un écrasement) ;
- éditer le nom, le sujet et le contenu ;
- choisir le **format** du contenu : texte enrichi, texte brut ou HTML ;
- prévisualiser le rendu **ordinateur** et **mobile** ;
- vérifier les variables ;
- archiver une version ;
- comparer deux versions, ligne à ligne.

### Variables — trois écarts distincts

| Écart | Signification | Conséquence |
|---|---|---|
| **Non déclarée** | Le contenu emploie `{{x}}` que le modèle ne déclare pas. | Rendu **refusé**. |
| **Manquante** | La variable est déclarée et employée, mais sans valeur. | Rendu **refusé**. |
| **Inutilisée** | Déclarée, jamais employée. | Simple signalement. |

Le principe est constant : **mieux vaut ne rien envoyer qu'envoyer « Bonjour
{{prenom}} »**.

### Limite assumée de la V1

Une version porte **un seul contenu, dans un seul format**. Il n'existe pas de
couple « corps HTML + corps texte » dans la même version : pour disposer des
deux, il faut deux versions. Ouvrir cette possibilité demanderait une colonne
supplémentaire ; la V1 ne l'a pas jugée nécessaire pour du transactionnel.

### Prévisualisation — jamais un vrai contact

La prévisualisation utilise **exclusivement** le jeu de destinataires fictifs
(§6). Aucun contact réel n'est chargé dans cet écran : un test relit le code de
la page et échoue si `contacts` ou `privacy_records` y apparaît.

---

## 6. Simulateur — mode simulation

`/crm/communications/simulateur` rejoue une décision **étape par étape**, sur
données fictives, et affiche :

1. l'événement reçu ;
2. les conditions évaluées, chacune avec l'attendu et l'observé ;
3. l'éligibilité du destinataire ;
4. la **base légale enregistrée** — constatée, jamais présentée comme validée ;
5. les oppositions éventuelles, dont la priorité d'une opposition globale ;
6. le canal sélectionné ;
7. le délai calculé ;
8. le modèle et sa version ;
9. les variables résolues ;
10. la décision finale — **préparé** ou **bloqué** — avec le motif précis.

### Ce que le simulateur ne fait jamais

- il **n'écrit rien** : ni dans l'outbox, ni dans `communication_messages`, ni
  dans l'audit ;
- il **ne contacte aucun fournisseur** : la simulation est une fonction pure,
  exécutée dans le navigateur, sans aucun appel réseau ;
- il **n'utilise aucune donnée réelle** : il refuse tout identifiant qui n'est
  pas celui d'un destinataire fictif, et le dit ;
- il **ne crée aucun événement d'audit**, donc aucune PII dans l'audit.

Il n'existe volontairement **aucun bouton d'exécution réelle**.

### Destinataires fictifs

Six personnages, tous marqués `FICTIF`, avec des adresses en `.invalid`
(TLD réservé, non routable) et des numéros de la plage française réservée à la
fiction. Chacun démontre un cas : nominal, sans coordonnée, opposition e-mail,
opposition globale, « ne plus contacter », variable manquante.

Aucun ne porte de base légale tranchée : tous déclarent
`a_valider_juridiquement`, la valeur par défaut du projet, qui signifie
**« non tranchée »** et jamais « consentement ».

---

## 7. Oppositions

`/crm/communications/oppositions` réutilise strictement l'existant : aucune
seconde source de vérité n'est créée.

- `privacy_records` porte le **choix** et la base légale déclarée ;
- `communication_suppressions` porte un **fait bloquant** : rebond définitif,
  plainte, désinscription, demande de la personne, erreur permanente, décision
  interne.

Les deux sont consultés ensemble et ne peuvent que **restreindre** — jamais
autoriser.

La vue distingue e-mail, SMS et **opposition globale** (tous canaux, toute
finalité), et affiche pour chacune la source, la date et le motif.

### Levée

Réservée à l'**administrateur**, avec un **motif obligatoire**. La décision est
re-vérifiée en base (`crm_require_role('administrateur')`) : ce que le navigateur
envoie n'a aucune importance. L'audit conserve l'identifiant de l'opposition, le
contact visé et le motif — **aucune coordonnée**.

L'écran n'affiche jamais l'adresse ou le numéro visé par une opposition : la
montrer la révélerait sans nécessité.

---

## 8. Vue d'ensemble et historique

### Vue d'ensemble

Dix tuiles, **toutes issues d'un décompte réel en base** (`count: exact`), jamais
d'une estimation ni d'un échantillon : messages préparés, en attente, en file
chez le fournisseur, livraisons prouvées, échecs, bloqués, ignorés, oppositions
actives, automatisations système, brouillons personnalisés. Chaque tuile dit
exactement ce qu'elle compte.

Deux règles de vocabulaire, appliquées partout :

- **« En file chez le fournisseur » n'est ni « envoyé », ni « livré ».** Le
  fournisseur a accepté la demande ; la livraison n'est pas établie.
- **« Livré » exige une preuve fournisseur.** Le décompte ne retient que les
  messages dont `provider_status` est renseigné. Un écart entre les deux
  populations serait une anomalie, et l'écran l'affiche comme telle.

Les motifs de blocage et d'événement ignoré sont agrégés et traduits : rien
n'est écarté sans raison lisible.

### Historique dans les dossiers

Les fiches Mandat, Acquéreur et Bien affichent, pour chaque communication : le
canal, le modèle et sa version, l'événement d'origine, le statut exact, le motif
d'échec ou de non-envoi, et les **trois dates distinctes** — préparation, mise
en file, livraison prouvée (ou « non établie »).

Aucun payload brut, aucun jeton, aucune URL de webhook, aucun secret n'est
exposé. Les coordonnées sont masquées **côté serveur** selon le rôle : le
navigateur ne reçoit jamais une valeur qu'il n'a pas le droit d'afficher.

---

## 9. Permissions

| Rôle | Vue d'ensemble | Modèles | Automatisations | Simulateur | Oppositions | Levée d'opposition |
|---|---|---|---|---|---|---|
| **administrateur** | ✅ | ✅ | ✅ (brouillons) | ✅ | ✅ | ✅ (motif obligatoire) |
| **manager** | ✅ | ✅ | ✅ (brouillons) | ✅ | ✅ | ❌ |
| **setter** | ✅ (dossiers autorisés) | ❌ | ❌ | ❌ | ✅ (lecture) | ❌ |
| **agent immobilier** | ✅ (ses dossiers affectés) | ❌ | ❌ | ❌ | ✅ (lecture) | ❌ |
| **partenaire lecture** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

Trois niveaux, indépendants :

1. **L'enveloppe** n'affiche pas les onglets de configuration aux rôles qui n'y
   ont pas droit — un onglet visible mais refusé serait une fausse promesse.
2. **Chaque page** re-vérifie le rôle pour elle-même : un accès direct par URL
   ne passe pas.
3. **La base** re-vérifie à chaque écriture (`comm_can_manage()`,
   `crm_require_role('administrateur')`) et la RLS filtre chaque lecture. Le
   navigateur n'écrit **jamais** directement dans une table : toute écriture
   passe par une action serveur validée par Zod, puis par une fonction
   `SECURITY DEFINER`.

---

## 10. Blocages RGPD

Le studio sépare strictement deux activations qui n'ont ni la même nature ni la
même réponse.

### Transactionnel — question technique

Six constats factuels, affichés tels quels : fournisseur e-mail configuré,
fournisseur SMS configuré, dispatcher activé, modèles prêts, traitement de la
file disponible, preuve de livraison disponible. Chaque constat dit ce qu'il
signifie et, s'il est négatif, ce qu'il reste à faire.

**État actuel : aucun n'est vert.** Aucun fournisseur n'est configuré,
l'interrupteur n'est pas armé, aucun modèle n'est actif, et aucune remontée de
statut fournisseur n'existe.

### Marketing — question juridique et organisationnelle

**Activation bloquée**, tant que sept décisions ne sont pas réellement tranchées
hors du système : base légale, texte d'information, durée de conservation,
opposition / désinscription, exercice des droits, suppression ou anonymisation,
liste d'opposition.

Aucune n'est tranchée en V1. Le blocage est donc **permanent** à ce stade, et
c'est volontaire : l'absence de décision vaut blocage, jamais autorisation.

### La formule employée

> Prodigio enregistre les choix, les bases légales déclarées et les oppositions.
> Il n'en déduit aucune conformité : la validation juridique reste à obtenir hors
> du système.

**L'expression « Conforme RGPD » n'apparaît nulle part** dans le studio, et un
test échoue si elle y entre. Conserver une preuve ne suffit pas à garantir la
conformité — voir [05-OPEN-QUESTIONS.md](05-OPEN-QUESTIONS.md).

---

## 11. Variables futures Lumail / Twilio

Aucune n'est requise pour que l'application fonctionne, et **aucune n'est
renseignée**. Elles sont documentées dans `.env.example` et
[21-COMMUNICATIONS.md](21-COMMUNICATIONS.md) §12.

| Variable | Rôle | État |
|---|---|---|
| `LUMAIL_API_KEY` | Authentification e-mail | Non renseignée |
| `LUMAIL_FROM_EMAIL` | Adresse expéditrice vérifiée | Non renseignée |
| `LUMAIL_REPLY_TO` | Adresse de réponse (facultative) | Non renseignée |
| `TWILIO_ACCOUNT_SID` | Compte SMS | Non renseignée |
| `TWILIO_AUTH_TOKEN` | Authentification SMS | Non renseignée |
| `TWILIO_FROM` | Numéro expéditeur | Non renseignée |
| `COMMUNICATIONS_DISPATCH_ENABLED` | Interrupteur d'envoi réel — doit valoir **exactement** `true` | Non renseignée |

Le studio n'affiche **jamais** une valeur : seulement un booléen de présence et
le **nom** des variables manquantes. Un test relit le code des pages et échoue si
une variable d'environnement y apparaît autrement qu'enveloppée dans un
`Boolean(...)`.

---

## 12. Étapes ultérieures d'activation

Dans cet ordre, et pas un autre.

### Pour le transactionnel

1. Relire et valider éditorialement les six modèles amorcés en brouillon.
2. Activer la version retenue de chaque modèle (une seule version active par clé
   et par canal — garanti par un index unique partiel).
3. Configurer le fournisseur e-mail dans un environnement **de test**, jamais en
   production d'abord.
4. Brancher la remontée de statut de livraison (webhook ou sondage) : sans elle,
   aucun message ne peut légitimement être déclaré livré.
5. Armer `COMMUNICATIONS_DISPATCH_ENABLED` sur cet environnement, traiter la
   file manuellement, et vérifier les statuts obtenus.
6. Seulement ensuite, envisager la production et une planification automatique.

### Pour les workflows personnalisés (V1.1)

1. Trancher ce qu'un workflow a le droit de déclencher, et sous quel contrôle
   humain.
2. Construire un **moteur d'exécution** idempotent, borné, et traçable —
   `communication_automation_runs` est prêt à le recevoir.
3. Rouvrir le statut `actif` par une migration **explicite**, avec les garde-fous
   décidés à l'étape 1.

### Pour le marketing

Rien avant que les sept décisions du §10 soient tranchées et qu'une validation
juridique soit obtenue. C'est un préalable, pas une étape parallèle.

---

## 13. Limites de la V1

Assumées, et documentées ici plutôt que découvertes plus tard.

1. **Aucun workflow personnalisé ne s'exécute.** Il n'existe aucun moteur, et le
   statut `actif` est interdit par contrainte.
2. **Une version de modèle porte un seul contenu, dans un seul format.** Pas de
   couple HTML + texte dans la même version.
3. **Les conditions ne sont évaluées que dans le simulateur**, sur des données
   fictives. Aucune évaluation ne porte sur un dossier réel.
4. **Pas de canvas graphique** : l'éditeur de workflow est un formulaire
   structuré. C'était un choix explicite pour la V1.
5. **Aucune preuve de livraison n'est disponible** : aucun webhook ni sondage
   fournisseur n'est branché. Le compteur « livraisons prouvées » restera donc à
   zéro jusque-là.
6. **Le canal SMS est modélisé mais non exercé** : aucun modèle SMS n'existe, et
   aucun événement transactionnel ne l'emprunte.
7. **Aucune statistique d'ouverture ni de clic.** Ces mesures supposent un
   traceur et une base légale ; ni l'un ni l'autre n'est décidé.
8. **La recette n'a pas exercé l'interface avec un utilisateur réel connecté** :
   les garanties reposent sur les tests automatisés, la relecture du code et les
   contrôles en base.

---

## 14. Ce que la V1 garantit, et comment c'est vérifié

| Garantie | Vérification |
|---|---|
| Aucune communication n'est produite au chargement d'une page | Test relisant le code des pages : aucun appel au dispatcher, à la file ou à la préparation de message |
| Aucune API fournisseur n'est appelée | Test relisant le code du studio : aucun import d'adaptateur, aucun point d'entrée, aucun `fetch` ; espion sur `fetch` pendant les simulations et les actions |
| Aucun destinataire n'est créé chez un fournisseur | Test : le terme n'apparaît nulle part dans le studio |
| Aucun brouillon ne s'exécute | Aucun moteur n'existe ; `canRunCustomAutomation()` renvoie toujours `false` |
| Aucune automatisation personnalisée n'est activable | Trois barrières testées : type, action serveur, contrainte SQL |
| Les modèles sont versionnés sans écrasement | La fonction SQL calcule `max(version) + 1` ; testé |
| Les variables manquantes sont détectées | Tests de `checkVariables` et `previewTemplate` |
| Le simulateur est exclusivement synthétique | Il refuse tout identifiant non fictif ; testé |
| Une opposition globale prévaut | Testé sur les deux canaux et les deux catégories |
| La levée est réservée à l'administrateur, avec motif | Testé côté action ; re-vérifié en base |
| Le marketing reste bloqué | `marketingActivation()` bloqué, `canOfferMarketingActivation()` toujours `false` |
| « En file » n'est jamais présenté comme « livré » | Test sur le libellé de la tuile |
| Une livraison sans preuve n'est pas comptée | Test sur la requête et sur l'historique |
| Les permissions sont respectées | Tests sur chaque page ; RLS et fonctions `SECURITY DEFINER` en base |
| Aucune PII dans les journaux ni l'audit | Test sur les `insert into audit_events` de la migration ; aucun `console.*` dans le studio |

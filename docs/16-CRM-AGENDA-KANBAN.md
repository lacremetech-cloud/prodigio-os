# 16 — Agenda CRM & Kanban glisser-déposer (V1.1)

Amélioration opérationnelle et UX du CRM Mandats : un **agenda visuel** des
rendez-vous d'estimation et un **pipeline Kanban manipulable au glisser-déposer**,
sans nouvelle fonctionnalité métier ni migration.

> Périmètre strictement UX/pilotage. **Aucune migration**, aucune nouvelle
> fonction SQL : on réutilise `estimation_appointments`, `crm_change_stage` et les
> actions calendrier existantes. Pas de Fabrique de biens, pas de CRM acquéreurs.

---

## 1. Agenda CRM

### Route et navigation
Route **unique** conservée : `/crm/rendez-vous` (libellé de navigation : **Agenda**).
Une bascule interne **Agenda / Liste** évite toute route concurrente. La vue
« Liste » réutilise l'ancien tableau chronologique par sections.

### Source de vérité
L'agenda lit **`estimation_appointments`** (source métier interne : dossier,
propriétaire, agent, statut, lien CRM, suivi). Il **ne lit jamais** l'agenda
Google pour reconstruire l'interface. Google Calendar reste le système externe
**synchronisé** par les actions existantes (planifier / reporter / annuler).

### Vues
- **Semaine** (défaut desktop) : 7 colonnes lundi→dimanche, chaque jour listant
  ses rendez-vous par ordre chronologique. Sur mobile, les jours s'**empilent
  verticalement** (CSS responsive) — jamais de calendrier écrasé.
- **Mois** : grille 6×7 (42 jours, alignée lundi), pastille de comptage, aperçu
  des 3 premiers rendez-vous + « +N » ; un clic sur un jour ouvre la vue Jour.
- **Jour** : liste détaillée d'une journée.
- **Liste** : tous les rendez-vous, groupés par jour.

Navigation ‹ Aujourd'hui › adaptée à la vue (±1 jour / ±7 jours / ±1 mois).

### Stratégie de fuseau horaire
Tout est calculé dans le fuseau du rendez-vous (**Europe/Paris** par défaut) via
`Intl.DateTimeFormat` (`hourCycle: h23`), jamais via les getters locaux du serveur
(qui tourne en UTC). L'arithmétique de calendrier (jour suivant, début de semaine,
grille du mois) se fait sur des **clés civiles `YYYY-MM-DD`** indépendantes du
fuseau, donc **insensibles aux changements d'heure été/hiver**. Un rendez-vous qui
**traverse une limite de journée** est rattaché à **son jour de début** (jamais
dupliqué) ; sa fin est bornée à minuit pour l'affichage. Ces règles sont
couvertes par des tests unitaires (CEST/CET, saut du 29 mars, retour du
25 octobre, franchissement de minuit).

### Contenu et couleurs des statuts
Chaque rendez-vous affiche, selon l'espace : horaire, durée, propriétaire, ville,
agent, statut et type « Estimation ». Le statut est rendu **à la fois** par une
couleur sobre (liseré gauche) **et** par un libellé + une icône — jamais par la
couleur seule (accessibilité). Statuts : planifié, confirmé, réalisé, à
replanifier, annulé, absent.

### Interaction
Un clic ouvre un **panneau latéral** premium : propriétaire, coordonnées **selon
les droits** (masquées sinon, avec bouton *copier* quand autorisé), bien/ville,
adresse, créneau, durée, agent, statut, lien Google si disponible, bouton
**Ouvrir le dossier**, et actions **Reporter** / **Annuler** qui **réutilisent les
actions serveur existantes** (`rescheduleAppointmentAction`,
`cancelAppointmentAction`) — aucune logique Calendar dupliquée. Fermeture par
Échap / clic sur le fond.

### Déplacement dans l'agenda
Pour cette V1.1, les événements **ne sont pas déplaçables directement** dans la
grille (un déplacement accidentel modifierait un vrai rendez-vous Google). Le
report se fait via le panneau (action existante : vérification, patch Google,
notifications, compensation). Le modèle d'affichage est prêt à accueillir plus
tard d'autres types d'événements liés aux biens (visites acquéreurs, tournages,
shootings, signatures) — non construits ici.

---

## 2. Kanban glisser-déposer

### Expérience
- **Desktop** : cartes `draggable` (API HTML5 native), colonne cible mise en
  évidence, compteur par colonne, lien vers la fiche préservé.
- **Tactile / lecteurs d'écran** : un **menu « Déplacer vers… »** est **toujours**
  disponible sur chaque carte (fiable au tactile, sans conflit avec le scroll).
- **Clavier** : saisir une carte (Entrée/Espace sur la poignée), choisir la
  colonne (flèches ◀▶), déposer (Entrée), annuler (Échap), avec **annonces
  `aria-live`**.

### Décision — bibliothèque de glisser-déposer : AUCUNE
Choix : **implémentation maison, sans dépendance**. Justification :
- La constitution du projet impose des **dépendances maîtrisées et minimales**
  (pas de surdimensionnement, versions verrouillées).
- La stack est **React 19 / Next 16** ; les bibliothèques DnD répandues
  présentent un risque de compatibilité et un poids non négligeable.
- Le besoin est couvert de façon robuste par : **DnD HTML5** (pointeur desktop) +
  **menu** (tactile / lecteurs d'écran) + **clavier** (accessibilité). Cette
  combinaison évite les angles morts d'accessibilité d'un DnD purement natif.

De même, **aucune bibliothèque de calendrier** n'a été ajoutée pour l'agenda : les
vues sont construites à partir d'utilitaires de date purs et testés.

### Transitions et règles métier (impératives)
Le glisser-déposer **ne contourne jamais** les règles métier. Un déplacement
autorisé appelle la mutation serveur existante `crm_change_stage` (rôle
re-vérifié **en base**, **AuditEvent** écrit). Les colonnes **protégées** —
`proposition_de_mandat`, `en_attente_de_signature`, `mandat_signe`, `perdu` —
**refusent** le simple déplacement et **renvoient vers l'action métier dédiée**
(proposition / signature de mandat, ou enregistrement du résultat commercial),
car un déplacement ne doit **jamais** fabriquer une information manquante ni forcer
un statut « signé / gagné / perdu » hors des fonctions dédiées
(`crm_propose_mandate`, `crm_sign_mandate`, `crm_record_outcome`).

Cette garde est appliquée **en deux endroits** (défense en profondeur) : dans le
composant client **et** dans l'action serveur `moveLeadStage` (logique pure
`evaluateMove`, testée unitairement) — avant tout appel à la base.

### Optimisme et rollback
La carte se déplace **immédiatement** (retour visuel), avec :
- **verrou anti-double-envoi** (un seul déplacement à la fois, carte verrouillée
  pendant l'enregistrement) ;
- **réconciliation** avec la base en cas de succès (source de vérité) ;
- **rollback** : la carte **revient à sa position initiale** si le serveur refuse
  (droits, RLS, erreur), avec un message d'erreur visible. L'écran ne reste jamais
  dans un état mensonger.

### Filtres et stabilité
Recherche (nom / ville) et filtres rapides (non affectés / en retard / fort
potentiel) **persistent** au déplacement : ils ne dépendent pas de la position.
Un déplacement ne duplique jamais une carte et ne réordonne pas les autres de
façon imprévisible.

---

## 3. États de l'interface
Agenda et Kanban prévoient : **vide**, **chargement** (skeleton via le
`loading.tsx` du CRM), **erreur visible** (rollback + message), **mutation en
cours** (« … » + verrou), **succès** (annonce `aria-live`), **absence de droits**
(lecture seule), **absence de résultats après filtrage**. Aucune erreur silencieuse.

---

## 4. Permissions & sécurité
Matrice existante **inchangée** : administrateur / manager (vision globale de
l'organisation), setter (dossiers et rendez-vous de son activité),
agent_immobilier (ses dossiers affectés uniquement), partenaire_lecture (aucune
mutation), non-membre / anon (aucun accès). Le Kanban n'affiche ni poignée ni menu
en lecture seule ; l'autorité reste **en base** (`crm_change_stage` réservé aux
opérateurs, RLS sur `estimation_appointments`). Les coordonnées sensibles sont
**masquées côté serveur** avant d'être envoyées au navigateur (le DTO Kanban ne
contient jamais un téléphone non autorisé). Aucun jeton, secret, webhook ni note
confidentielle n'est exposé.

---

## 5. Tests
- **Agenda (pur)** : fuseau CEST/CET, sauts d'heure (29 mars / 25 octobre),
  franchissement de minuit (rattachement au jour de début, non dupliqué),
  `addDaysToKey` / `weekKeys` / `monthGridKeys`, filtres (agent / statut / période
  / recherche), regroupement par jour, durée.
- **Agenda (composant)** : rendu d'un événement à l'heure de Paris, ouverture du
  panneau → bon dossier, masquage des coordonnées selon le rôle, bascule Liste,
  filtre par recherche.
- **Kanban (pur)** : `evaluateMove` (progression autorisée, no-op même colonne,
  **refus** des cibles protégées avec `requiresAction`).
- **Kanban (composant)** : rendu des colonnes, **refus** d'un déplacement vers une
  colonne protégée (aucune mutation), **une seule** mutation pour un déplacement
  autorisé, absence de contrôles en lecture seule, filtre stable.

Commandes : `npm run lint`, `npm run typecheck`, `npm run test:run`, `npm run build`.

---

## 6. Recette réelle (contrôlée)
Effectuée sur des données **de test dédiées** (jamais les dossiers réels) :
changement de stade autorisé → **un seul** AuditEvent ; rejeu du même stade →
**aucun** nouvel audit (no-op) ; sans authentification → refus `28000` ; non-membre
→ refus `42501`. Données de test supprimées ; **les 2 leads réels et les 7
rendez-vous existants restent intacts**. Seules subsistent des traces d'audit
**immuables** (jetons de stade uniquement, aucune donnée sensible).

---

## 7. Limites V1.1
- Les événements ne sont **pas déplaçables directement dans l'agenda** (report via
  le panneau) — choix délibéré pour ne pas modifier un rendez-vous Google par
  accident.
- Le DnD pointeur repose sur l'API HTML5 (desktop) ; le **tactile** passe par le
  menu (fiable), pas par un glisser tactile natif.
- L'agenda n'affiche que les **estimations** ; l'ossature est prête pour d'autres
  types d'événements liés aux biens (non construits).
- Aucune synchronisation **entrante** depuis Google (inchangé depuis la V1
  calendrier).

# Rotation des secrets — procédure et registre

## Pourquoi ce document

Des secrets de production ont circulé dans un canal non prévu pour eux
(conversation d'assistance, copier-coller). Un secret qui a quitté son coffre
doit être considéré comme **public**, même si rien ne prouve qu'il a été
utilisé : on ne rattrape pas une valeur, on la remplace.

Ce document liste ce qui est à renouveler, dans quel ordre, et ce qui casse
pendant l'opération. Il sert aussi de modèle pour les prochaines fois.

## Règle qui vaut pour toutes les lignes

**Une variable modifiée dans Vercel ne prend effet qu'au build suivant.**
Changer la valeur sans redéployer laisse l'ancienne en service : on croit avoir
tourné la clé, et c'est encore l'ancienne qui ouvre. Après chaque rotation,
redéployer, puis vérifier `GET /api/health` — il annonce quelles intégrations
sont configurées, sans jamais révéler une valeur.

## À renouveler

| # | Secret | Où | Ce qui casse en attendant | Priorité |
|---|--------|----|---------------------------|----------|
| 1 | Mot de passe CRM de JC | Prodigio OS → profil, ou réinitialisation par e-mail | Rien : la session en cours reste valide | **Immédiate** |
| 2 | Mot de passe CRM d'Antoine | idem | Rien | **Immédiate** |
| 3 | Webhook Slack entrant (acquéreurs) | Slack → l'app → *Incoming Webhooks* : supprimer l'URL, en créer une neuve → `SLACK_BUYER_LEADS_WEBHOOK_URL` dans Vercel | Les alertes « nouvelle demande » ne partent plus jusqu'au redéploiement. Le dépôt lui-même continue de fonctionner | Haute |
| 4 | Jeton Meta — API de conversions | Business Manager → Gestionnaire d'événements → *Conversions API* : révoquer, régénérer → `META_CAPI_ACCESS_TOKEN` | Les conversions ne remontent plus à Meta : l'optimisation des campagnes se dégrade si la coupure dure | Haute |
| 5 | Clé secrète Supabase (`sb_secret_…`) | Supabase → Settings → API Keys → *Rotate* → `SUPABASE_SECRET_KEY` | Invitations d'utilisateurs et documents de mandat (Storage privé) désactivés jusqu'au redéploiement. Le CRM, lui, n'en dépend pas | Haute |
| 6 | Identifiants SMSFactor (compte) | SMSFactor → mot de passe du compte | Rien tant que le jeton d'API reste valide | Moyenne |
| 7 | Les deux webhooks Make | Make → chaque scénario → régénérer l'URL du déclencheur, mettre à jour l'appelant | Le scénario concerné ne se déclenche plus | Moyenne |
| 8 | Identifiants Académie Florale | Le service concerné | Hors Prodigio OS | Moyenne |
| 9 | Mots de passe du compte de recette `recette.claude@prodigio.fr` (deux valeurs, gardées dans mon bac à sable) | Prodigio OS → profil du compte, ou réinitialisation par e-mail | Rien : le compte est déjà neutralisé et ne se connecte plus | Basse |
| 10 | Mot de passe choisi pour `orofino.nicolas@gmail.com` | Le compte n'existe pas encore : passer par l'invitation, qui laisse la personne choisir le sien | Rien | **Ne pas l'utiliser** |

**Non concerné :** le jeton d'API SMSFactor n'a jamais transité par la
conversation — il a été posé directement dans Vercel. Rien à faire, sauf
rotation de principe.

Les deux valeurs de la ligne 9 ont été affichées en clair dans une
conversation de travail le 19 octobre 2026, par moi, en inspectant mes propres
fichiers de recette : la règle du dernier paragraphe vaut aussi pour les
secrets qu'on croit sans importance. Le compte étant déjà neutralisé, rien
n'est exposé qui puisse servir — la ligne est là pour que le renouvellement ne
soit pas oublié le jour où ce compte serait réactivé.

Le mot de passe de la ligne 10 a ete dicte dans une conversation de travail le
22 octobre 2026, pour un compte a creer. Il n'a jamais ete pose nulle part, et
il ne doit pas l'etre : l'invitation laisse la personne choisir le sien, ce
qui supprime le probleme au lieu de le gerer. Voir
`29-AJOUTER-UN-COMMERCIAL.md`.

## Ordre conseillé

1. **Les deux mots de passe CRM** (1 et 2). Ce sont les seuls qui donnent accès
   aux données des acquéreurs : nom, téléphone, e-mail de personnes réelles.
   Rien ne casse, rien n'attend — à faire en premier.
2. **La clé Supabase** (5), puis redéployer.
3. **Slack** (3) et **Meta** (4), puis redéployer. Les deux peuvent se faire
   dans le même redéploiement que 5.
4. **SMSFactor**, **Make**, **Académie Florale** (6, 7, 8) — à leur rythme.

## Vérification après coup

```
curl -s https://go.prodigio.fr/api/health
```

Les quatre intégrations doivent rester `true`. Une qui passe à `false` signale
une variable mal recopiée — l'application se désactive proprement plutôt que
d'échouer en silence, mais la fonction est alors hors service.

## Ce qu'on ne fait plus

Un secret ne se colle pas dans une conversation, un ticket, un message ou un
commit, même temporairement, même « juste pour vérifier ». Les valeurs se
posent directement là où elles servent — Vercel, Supabase, Slack — et se
lisent depuis là. Lorsqu'un outil a besoin d'une valeur, on lui donne un accès,
pas la valeur.

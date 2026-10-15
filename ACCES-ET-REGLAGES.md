# Trois réglages à faire une fois, et ce qu'ils débloquent

Écrit après la panne du 14–15 octobre, où 65 dépôts d'acquéreurs ont été perdus
en vingt-deux heures sans qu'aucun signal ne parte. Chacun de ces trois points
a contribué à la durée de la panne.

---

## 1. Me donner les journaux Vercel — le plus utile

**Ce que ça change.** Pendant la panne, le détail de l'erreur n'existait que
dans les journaux Vercel. Sans eux, j'ai passé une soirée à deviner, et il a
fallu que vous testiez le formulaire vous-même. Avec eux, je lis la cause en
une minute.

**Étapes**

1. Aller sur **vercel.com**, se connecter.
2. En haut à droite, cliquer sur son avatar → **Account Settings**.
3. Dans le menu de gauche : **Tokens**.
4. **Create Token**.
   - *Token Name* : `claude-prodigio`
   - *Scope* : choisir l'équipe qui possède le projet `prodigio-os`
   - *Expiration* : 90 jours (on le renouvellera)
5. **Create**, puis **copier le jeton**. Il ne s'affiche qu'une seule fois.

6. Revenir dans la conversation Claude Code. Dans la **barre de titre de la
   session**, ouvrir le menu de l'environnement cloud, puis **Edit**.
7. Dans **Network secrets** (ou **API credentials** selon la version), ajouter :
   - nom : `VERCEL_TOKEN`
   - valeur : le jeton copié
8. Enregistrer, puis **ouvrir une nouvelle session** : c'est au démarrage que
   l'environnement charge le secret.

> **Ne collez jamais ce jeton dans la conversation.** Il passe par les réglages
> de l'environnement, jamais par un message. Un jeton Vercel peut déployer et
> supprimer : mettez une expiration, et révoquez-le quand il ne sert plus
> (même écran **Tokens**).

Une fois en place, dites-moi simplement « le jeton est posé » et je vérifie.

---

## 2. Mettre `main` comme branche de production des deux landings

**Ce que ça change.** Aujourd'hui les deux landings sont servies depuis des
branches aux noms illisibles (`claude/intelligent-rubin-0sbqog`). Personne ne
peut deviner laquelle est en ligne — c'est la racine de la confusion. Après ce
réglage, la règle devient : **`main` = ce qui est en ligne, partout.**

**C'est sans risque aujourd'hui** : j'ai vérifié que `main` et la branche
servie ont exactement le même contenu sur les deux landings. Le site ne
changera pas d'un pixel.

**Étapes, à faire pour CHACUN des deux projets**
(`villa-verdun-cassis`, puis la landing Jean Jaurès)

1. Sur **vercel.com**, ouvrir le projet.
2. Onglet **Settings** → **Git** (menu de gauche).
3. Champ **Production Branch** : remplacer la valeur par `main`.
4. **Save**.
5. Onglet **Deployments** → sur le déploiement le plus récent, menu `…` →
   **Redeploy**, pour que la production reparte de `main`.
6. Vérifier : ouvrir la landing, le site doit être identique.

Après ce changement, **pousser sur l'ancienne branche ne déploiera plus rien**.
C'est voulu. Je mettrai `LIVRAISON.md` à jour dans la foulée.

---

## 3. Être prévenu quand une construction échoue

**Ce que ça change.** Hier soir, un déploiement est resté bloqué dix minutes
sans que rien ne le signale. On ne l'a vu qu'en interrogeant le site à la main.

**Étapes**

1. Sur **vercel.com**, avatar en haut à droite → **Account Settings** →
   **Notifications**.
2. Activer les notifications d'échec de déploiement (*Deployment Failed* /
   *Deployment Error*) par e-mail.
3. Pour les recevoir dans Slack : page d'équipe → **Integrations** →
   chercher **Slack** → **Add Integration**, puis choisir le canal.

---

## Une décision à prendre : le canari

Un contrôle automatique qui teste le dépôt d'un lead **toutes les heures** et
alerte si ça casse. Hier, ça aurait réduit vingt-deux heures de panne à une.

Deux versions possibles — dites-moi laquelle :

| | Ce qu'il fait | Avantage | Inconvénient |
|---|---|---|---|
| **A. Dépôt réel** | crée un vrai lead de test, puis le supprime | teste la chaîne entière, exactement comme un visiteur | écrit puis efface une ligne toutes les heures |
| **B. Contrôle de structure** | vérifie la cohérence du schéma sans rien écrire | aucune écriture, aucun risque | ne teste pas la chaîne complète |

La **A** est celle qui aurait attrapé la panne d'hier. La **B** aussi, en
réalité, puisque la cause était une incohérence de schéma — mais elle ne
couvrirait pas une panne d'une autre nature.

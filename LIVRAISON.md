# Livraison

Ce fichier existe parce qu'on a passé une soirée à deviner quelle branche était
en ligne. Il répond en premier, et on le tient à jour.

## Ce qui est déployé

| | |
|---|---|
| **Projet** | Prodigio OS (CRM + formulaires) |
| **Branche servie par Vercel** | `main` |
| **Adresse publique** | https://go.prodigio.fr |

**Pousser sur cette branche déploie.** Pousser ailleurs ne déploie rien — y
compris sur `main` si ce n'est pas la branche ci-dessus.

## Vérifier ce qui est réellement en ligne

```sh
curl -s https://go.prodigio.fr/api/health
```

Ne jamais se fier à `git log` seul : il dit ce que contient une branche, pas ce
que sert Vercel. Les deux ont divergé pendant des jours sans que rien ne le
signale.

## Pourquoi les tests ne tournent PAS dans la construction Vercel

On a essayé deux fois de faire lancer la suite de tests par Vercel avant
publication (`vercel-build`). Deux fois la production a cessé de se mettre à
jour. Les deux causes sont connues maintenant, et la seconde est rédhibitoire.

**1. `NODE_ENV=production`.** Vercel l'impose pendant la construction, et React
retire `act` de ses versions de production : les tests de composants échouent
tous avec `React.act is not a function`. Corrigeable — il suffit d'un
`NODE_ENV=test` devant `vitest run`.

**2. Les vraies variables d'environnement.** Celle-là ne se corrige pas
simplement. La construction Vercel reçoit les variables de PRODUCTION. Les
tests du formulaire acquéreur rendent alors un composant configuré comme en
production — contrôle anti-robot actif, bouton en « Vérification… » — et ne
retrouvent plus les éléments qu'ils cherchent. Les mêmes tests passent en local
parce que ces variables y sont absentes.

Autrement dit : **la construction Vercel n'est pas un environnement de test.**
Y faire tourner la suite donne des échecs qui ne disent rien sur le code.

### Ce qui garde la maison à la place

`.github/workflows/verification.yml` lance types, tests et construction à
chaque poussée, sur toutes les branches, dans un environnement propre. Elle
**signale** au lieu de **bloquer** : un commit rouge part quand même en
production, mais il est visible immédiatement sur GitHub.

Pour obtenir une vraie barrière un jour, la voie est l'« Ignored Build Step »
de Vercel, qui interroge le résultat GitHub avant de construire. À faire à
tête reposée, pas dans l'urgence.

## Avant de pousser

1. `npm run typecheck && npm run test:run` — s'il y a un `package.json`.
2. Relire son propre diff en cherchant ce qui pourrait casser.
3. Après la poussée, **vérifier en ligne** avec la commande ci-dessus. Une
   poussée n'est pas une livraison tant qu'on ne l'a pas constatée.

## Si ça casse

Revenir au commit précédent et pousser :

```sh
git revert --no-edit <commit fautif>
git push origin main
```

Vercel reconstruit. Ne pas changer la branche de production pour « forcer » une
livraison : c'est ce qui crée les divergences qu'on paie ensuite.

## Migrations de base de données

Une migration qui touche une contrainte `check` doit vérifier **la valeur par
défaut de la colonne** dans la même migration. Une contrainte resserrée sans
son défaut a rejeté 65 dépôts d'acquéreurs en vingt-deux heures, sans un
signal. Un test relit désormais toutes les migrations et refuse ce cas
(`src/modules/buyers/crm/valeurs-par-defaut.test.ts`).

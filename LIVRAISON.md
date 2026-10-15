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

## La barrière de déploiement

`vercel-build` lance **types + tests + construction** avant toute publication.
Vercel appelle ce script en priorité sur `build` : **un test rouge arrête le
déploiement**, il ne le signale pas après coup.

### Le piège, pour qui y touchera

Vercel impose `NODE_ENV=production` pendant la construction. Or React **retire
`act` de ses versions de production** : sous ce réglage, tous les tests de
composants échouent avec `React.act is not a function`, alors qu'ils passent en
local. Ça a fait croire, un moment, que la barrière était inutilisable et on
l'avait retirée.

D'où le `NODE_ENV=test` devant `vitest run`, dans `package.json` comme dans
l'intégration continue. **Ne l'enlevez pas.**

Pour simuler exactement ce que fait Vercel, avant de pousser :

```sh
NODE_ENV=production npm run vercel-build
```

### Si un test rouge bloque une correction urgente

C'est le prix d'une barrière qui tient. Deux options : corriger le test (le
bon réflexe), ou, si l'urgence l'exige, retirer temporairement `vercel-build`
de `package.json` — en sachant que plus rien n'est verifié, et en le remettant
juste après.

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

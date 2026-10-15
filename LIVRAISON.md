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

## La barrière de déploiement : retirée, et pourquoi

On a tenté de faire lancer les tests par Vercel avant publication
(`vercel-build`). La commande passe en local, mais la production a cessé de se
mettre à jour pendant plus de dix minutes et rien ne permettait de savoir
pourquoi : les journaux Vercel ne sont pas accessibles depuis l'outillage
actuel.

Une barrière qu'on ne peut pas observer et qui bloque les livraisons est pire
que pas de barrière. Elle a donc été retirée.

Ce qui reste : la vérification GitHub (`.github/workflows/verification.yml`)
lance types, tests et construction à chaque poussée, sur toutes les branches.
Elle SIGNALE au lieu de BLOQUER — un commit rouge part quand même en
production, mais on le voit immédiatement sur GitHub.

Pour remettre une vraie barrière, il faut d'abord un accès aux journaux
Vercel. Avec lui, `"vercel-build": "tsc --noEmit && vitest run && next build"`
peut être rétabli en connaissance de cause.

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

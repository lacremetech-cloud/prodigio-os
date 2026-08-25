# 23 — Résilience des actions serveur du CRM

> **Statut : correctif livré.** Une action serveur qui échoue affiche désormais
> un message sous le formulaire et **conserve la saisie**, au lieu de remplacer
> l'écran et de tout perdre.

---

## 1. L'incident

Le 25 août 2026, une sauvegarde d'identité dans la Fabrique de biens a produit
l'écran « Une erreur est survenue lors du chargement ». La saisie — nom, titre,
type, adresse, ville, surface, terrain, pièces, chambres, année, description,
histoire du lieu, détail signature — a été **entièrement perdue**.

### Ce qui a été établi

| Constat | Vérification |
|---|---|
| Rien n'a été enregistré | Ligne `properties` entièrement à `null`, `updated_at` = `created_at`, aucun `bien_identite` dans l'audit |
| La base n'est pas en cause | RPC rejouée sous l'identité réelle de l'utilisateur : `crm_property_access = true`, retour `{"ok": true}`, valeurs correctement écrites — puis annulée |
| Le contrat RPC est correct | Une seule signature, noms de paramètres identiques à ceux envoyés, `authenticated` autorisé |
| Les valeurs saisies sont valides | Aucune contrainte numérique sur `properties` ; 222 222 m² de terrain est accepté |
| La requête n'a jamais atteint Supabase | **Zéro** appel à `/rest/v1/rpc/crm_property_update_identity` dans les journaux ; aucune erreur PostgreSQL, aucune réponse non-2xx, session valide |

La cause première se situe donc **dans la couche applicative**, entre Vercel et
Supabase. Son identification exacte demande les journaux d'exécution Vercel, hors
de portée depuis l'environnement d'analyse. **Ce document ne la présume pas.**

### Ce qui, en revanche, était certain

Quelle qu'en soit la cause, la conséquence était disproportionnée :

```ts
start(async () => {
  const res = await fn();   // ← un rejet ici n'était rattrapé par personne
  ...
});
```

Un rejet non rattrapé dans une transition React remonte jusqu'à la frontière
d'erreur. La page est démontée, l'état local disparaît, la saisie est perdue.
**Un incident passager devenait une perte de travail.**

Le motif était présent dans **16 composants** du CRM.

---

## 2. Le correctif

`src/modules/crm/safe-action.ts` — une fonction pure, sans dépendance React.

```ts
const res = await safeAction(() => monAction({ … }));
```

Elle garantit trois choses :

1. **Aucun rejet ne s'échappe.** Une exception imprévue devient un
   `{ ok: false, error }` lisible. L'écran survit, l'état local aussi.
2. **Aucun détail technique n'est divulgué.** L'utilisateur reçoit une consigne,
   jamais une trace, un hôte ou un identifiant de connexion.
3. **Le contrôle de flux du framework passe.** `redirect()` et `notFound()` de
   Next.js **ne sont pas** des pannes : leurs exceptions sont relancées telles
   quelles. Les rattraper aurait cassé la redirection vers `/connexion` à
   l'expiration d'une session — une régression bien pire que le défaut corrigé.

### Les trois messages

| Situation | Message |
|---|---|
| Panne générique | « L'enregistrement n'a pas abouti — rien n'a été modifié. Votre saisie est conservée : réessayez dans un instant. » |
| Transport (`fetch failed`, `ETIMEDOUT`…) | « Le serveur n'a pas répondu — rien n'a été modifié. Votre saisie est conservée : vérifiez votre connexion et réessayez. » |
| Build remplacé pendant la session | « L'application a été mise à jour depuis l'ouverture de cette page. Copiez votre saisie, rechargez la page, puis recommencez. » |

Chacun dit, dans cet ordre : **ce qui n'a pas marché**, **ce qui est préservé**,
**quoi faire**. Aucun ne prétend qu'une donnée a été enregistrée.

### Un échec métier reste un échec métier

`safeAction` ne réécrit **jamais** un `{ ok: false, error }` produit
volontairement par une action. « Droits insuffisants sur ce bien » continue de
s'afficher tel quel. Seule une exception imprévue est traduite.

---

## 3. Portée

16 composants, 21 sites d'appel. Les huit aides locales `run(...)` couvrent
l'essentiel ; les appels directs ont été enveloppés un par un.

| Domaine | Fichiers |
|---|---|
| Fabrique de biens | `property/shared.tsx`, `documents-manager.tsx`, `media-manager.tsx` |
| Mandats | `mandate/lifecycle-actions.tsx`, `economic-rules-manager.tsx`, `lead-actions.tsx`, `pipeline/kanban-board.tsx` |
| Acquéreurs | `buyers/buyer-kanban.tsx` |
| Agenda | `calendar/agenda.tsx`, `appointment-actions.tsx`, `estimation-scheduler.tsx`, `calendar-connection.tsx` |
| Communications | `communications/message-table.tsx`, `panels.tsx` |
| Équipe & accès | `team/team-manager.tsx`, `invitation-accept.tsx` |

Le funnel acquéreur public possédait déjà son propre `try/catch` : il n'a pas été
touché.

---

## 4. Vérification

| Test | Ce qu'il prouve |
|---|---|
| `safe-action.test.ts` (13) | Aucun rejet ne s'échappe ; aucun détail technique divulgué ; `redirect()` et `notFound()` traversent ; messages spécifiques reconnus |
| `identity-resilience.test.tsx` (4) | Sur le **vrai** formulaire de la Fabrique de biens : message lisible, **saisie conservée**, second essai possible sans retaper, refus métier toujours affiché |
| `action-call-sites.test.ts` (3) | Garde-fou structurel : aucun appel d'action du CRM n'échappe à `safeAction` |

Les quatre tests du formulaire ont été **vérifiés en échec** sur le code
d'origine, avec exactement le symptôme de production :

```
⎯⎯⎯ Unhandled Errors ⎯⎯⎯
Error: Boom côté serveur
Tests  3 failed | 1 passed
```

---

## 5. Ce que ce correctif ne fait pas

Il **ne corrige pas la cause première** de l'incident du 25 août, qui reste à
identifier dans les journaux d'exécution Vercel (déploiement de production →
Runtime Logs, autour de 11:39 UTC).

Il garantit seulement qu'une panne de cette famille — quelle qu'en soit
l'origine — reste un contretemps affiché, et non une perte de travail. Les deux
sujets sont distincts et doivent le rester : rendre l'échec supportable n'est pas
l'empêcher.

# Alerte e-mail « nouveau lead » — EN PLACE depuis le 16/10/2026

**Besoin.** Antoine et JC n'ouvrent ni Slack ni WhatsApp. Les alertes n'allaient
que dans Slack : elles partaient, personne ne les lisait.

**En place :** à chaque dépôt, Prodigio appelle un webhook Make dédié, et Make
envoie l'e-mail via le compte Google de l'agence.

```
dépôt → Prodigio OS → webhook Make → Gmail → agence@indescale.com
                                              adelombares@kprojects.fr
                                              casteljc69@gmail.com
```

## Le piège à ne jamais réintroduire

`buyer_form_webhook_url` (en base, par bien) **n'est plus appelé**. Dans
`universal-submit.ts`, l'accusé de réception prend le chemin SMSFactor dès que
le jeton existe — et **sort de la fonction** :

```ts
if (isSmsFactorConfigured()) { …envoyerSms(…); return; }
if (!config.webhookUrl) return;        // ← jamais atteint
…envoyerAccuseDepot(…)                 // ← code mort en production
```

Y brancher une alerte produirait des e-mails qui ne partent jamais, et une
attente silencieuse de plus. L'alerte équipe a donc son **webhook dédié**,
appelé explicitement : `ALERTE_LEAD_WEBHOOK_URL`.

Les deux webhooks enregistrés en base pointent d'ailleurs vers un compte Make
**introuvable** (ni Indescale, ni celui connecté) — vestige sans effet, puisque
plus rien ne les appelle.

## Le montage

| Pièce | Référence |
|---|---|
| Compte Make | Indescale Agency, `agence@indescale.com`, zone `eu2`, team `2752388` |
| Webhook | « Prodigio — alerte nouveau lead », id `4443795` |
| Scénario | « Prodigio — Nouveau lead → e-mail Antoine & JC », id `9990198`, **actif** |
| Connexion Gmail | id `14675983`, `agence@indescale.com`, expire le **16/04/2027** |
| Variable Vercel | `ALERTE_LEAD_WEBHOOK_URL` (production + preview) |
| Expéditeur affiché | « Prodigio OS » |

⚠️ **La connexion Google expire le 16 avril 2027.** Passé cette date, les
alertes s'arrêtent — en silence, comme toujours. À réautoriser avant.

## Côté code

| Élément | Où |
|---|---|
| Point d'entrée unique des deux tunnels | `alerterEquipe()` dans `notifications/alerte-email.ts` |
| Chemin actif | `alerterEquipeParWebhook()` — prime quand la variable existe |
| Chemin de repli | `alerterEquipeParEmail()` — Lumail, prêt mais sans transport |
| Convertisseurs | `ficheLeadUniverselle()` et `ficheLeadHistorique()` |
| Branchements | `universal-submit.ts` (landings) et `submit.ts` (historique) |

**Jamais les deux canaux** : deux canaux actifs, c'est Antoine qui reçoit deux
fois la même alerte. Le webhook prime, sinon l'e-mail Lumail, sinon rien.

Le chemin Lumail reste en place pour le jour où l'on voudra sortir de Make :
trois variables (`LUMAIL_API_KEY`, `LUMAIL_FROM_EMAIL`, `ALERTES_LEADS_EMAILS`)
et on bascule sans redévelopper.

## Vérifié / pas vérifié au 16/10/2026

- ✅ webhook → Make → Gmail : exécution `SUCCESS`, 2 opérations, 1,2 s
- ⏳ **Prodigio → webhook** : non prouvé. Le code est déployé (`04e46e2`) et la
  variable est en production, mais ce maillon ne se vérifie qu'avec un vrai
  dépôt. Décision de l'utilisateur : laisser venir le premier lead réel.
  **Si le premier vrai lead n'engendre pas d'e-mail, commencer par là.**

## Canal de repli, si Make lâche

Le **SMS est déjà branché** (`SMSFACTOR_API_TOKEN` et `SMSFACTOR_SENDER` en
production, transport `smsfactor.ts` écrit et utilisé tous les jours pour
l'accusé au prospect). C'est le seul canal activable sans aucune action de
l'utilisateur : il ne manque que les numéros d'Antoine et JC.

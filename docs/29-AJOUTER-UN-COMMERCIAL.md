# Ajouter un commercial

Deux étapes. La troisième, qui n'avait aucune interface et coûtait des leads
en silence, est désormais portée par l'invitation elle-même.

---

## 1. Fixer son périmètre sur l'invitation

Un commercial ne voit **que** les leads des biens qui lui sont confiés. C'est
voulu : Édouard ROWLANDSON (Cimalpes) suit les 2 Alpes et ne doit pas voir
Cassis ; Nicolas suit Cassis et ne doit pas voir les 2 Alpes.

Le périmètre se décide au moment où on invite, pas trois jours plus tard quand
la personne se plaint d'un écran vide. Il s'écrit sur l'invitation, et
l'acceptation l'applique.

```sql
-- 1. L'invitation (role commercial).
select crm_create_invitation(
  p_email      => 'adresse@exemple.fr',
  p_first_name => 'Prénom',
  p_last_name  => 'Nom',
  p_role       => 'commercial');

-- 2. Les biens qu'elle emporte avec elle. Reprenez l'id renvoyé ci-dessus.
select crm_invitation_set_scope(
  '<id de l''invitation>'::uuid,
  array(select id from properties
         where project_name in ('Les Airelles aux 2 Alpes')));
```

`crm_invitation_set_scope` refuse un bien d'une autre organisation : on ne peut
pas accorder un accès hors périmètre par inadvertance.

Le formulaire **Paramètres → Équipe** crée l'invitation et envoie l'e-mail,
mais ne pose pas encore le périmètre : la requête ci-dessus reste nécessaire
jusqu'à ce que l'écran le propose.

> **Ne transmettez pas de mot de passe.** L'invitation existe pour que chacun
> choisisse le sien : rien à dicter au téléphone, rien à écrire dans une
> conversation, rien à faire tourner. Un mot de passe envoyé par message est
> un mot de passe à renouveler.

## 2. Contrôler — les deux chiffres qui comptent

Après que la personne a accepté :

```sql
select u.email, m.role, m.status,
       (select count(*) from property_assignments pa where pa.user_id = u.id) as biens,
       (select string_agg(p.project_name, ' | ' order by p.project_name)
          from property_assignments pa
          join properties p on p.id = pa.property_id
         where pa.user_id = u.id)                                             as lesquels
from auth.users u
join organization_memberships m on m.user_id = u.id
where u.email = 'adresse@exemple.fr';
```

`biens` à 0 veut dire que l'invitation n'avait pas de périmètre. La réparation
est de reposer le périmètre puis de rejouer l'acceptation — elle est
rejouable — ou, pour un membre déjà en place, d'affecter à la main :

```sql
insert into property_assignments (property_id, user_id, responsibility, assigned_by)
select p.id, qui.id, 'commercial', moi.id
from properties p
cross join (select id from auth.users where email = 'adresse@exemple.fr')  as qui
cross join (select id from auth.users where email = 'agence@indescale.com') as moi
where p.project_name in ('Les Airelles aux 2 Alpes')
on conflict (property_id, user_id) do nothing;
```

## 3. Vérifier l'isolation, pas seulement l'accès

Un accès qui marche ne prouve pas qu'il est borné. On impersonne la session :

```sql
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"<son uuid>","role":"authenticated"}';
select p.project_name, count(*)
from buyer_interests bi join properties p on p.id = bi.property_id
group by p.project_name;
rollback;
```

Seuls ses biens doivent apparaître. **Faites la contre-épreuve** avec
l'administrateur : si lui aussi voit peu de choses, le test ne prouve rien.

---

## Les deux pièges déjà rencontrés

**Le rôle n'existait pas dans toutes les contraintes.** La migration du
12 octobre a élargi `organization_memberships_role_check` mais pas
`organization_invitations_role_check` : `crm_create_invitation` validait le
rôle, puis la base refusait la ligne. Une valeur de vocabulaire ne vit jamais
dans une seule contrainte. Un test (`roles-coherents.test.ts`) refuse
désormais la prochaine divergence.

**Un compte créé à la main en SQL casse l'authentification.** GoTrue lit
`confirmation_token`, `recovery_token`, `email_change_token_new` et
`email_change` dans des `string` Go, qui n'acceptent pas `NULL`. Une ligne
`auth.users` insérée sans ces colonnes fait répondre 500 à `/recover` :

    error finding user: sql: Scan error on column index 3,
    name "confirmation_token": converting NULL to string is unsupported

Posez-y `''`, comme le fait l'API d'administration. Mieux : passez par
l'invitation, qui crée le compte proprement.

---

## Pourquoi ce document existe

Parce qu'un bien lancé sans affectation, ou un commercial ajouté sans biens,
ne produit **aucune erreur** : les demandes arrivent, l'argent des publicités
tourne, et personne ne voit rien. À l'écran, un CRM vide se confond trait pour
trait avec un refus d'accès — on cherche alors le défaut du côté du mot de
passe, là où il n'est pas.

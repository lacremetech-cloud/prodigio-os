# Ajouter un commercial

Trois étapes. **La troisième n'a aucune interface** : sans elle, la personne
se connecte, voit un écran vide, et croit que l'outil est cassé.

---

## 1. L'inviter — Paramètres → Équipe

Rôle : **commercial**. Vous êtes le seul administrateur, c'est donc vous qui
invitez.

L'invitation envoie un e-mail. La personne clique, **choisit son mot de
passe**, et son adhésion est créée à ce moment-là.

> **Ne transmettez pas de mot de passe.** L'invitation existe pour que chacun
> choisisse le sien : rien à dicter au téléphone, rien à écrire dans une
> conversation, rien à faire tourner. Un mot de passe envoyé par message est
> un mot de passe à renouveler.

## 2. Vérifier qu'elle a bien accepté

```sql
select u.email, m.role, m.status
from organization_memberships m
join auth.users u on u.id = m.user_id
where u.email = 'adresse@exemple.fr';
```

Tant que rien ne sort, l'invitation n'a pas été acceptée : l'étape 3 ne
servirait à rien.

## 3. Lui confier les biens — **l'étape sans interface**

Un commercial ne voit que les leads des biens qui lui sont confiés. C'est
voulu : le jour où une villa à Perpignan sera suivie par d'autres, les
commerciaux actuels ne doivent pas voir ses leads.

Mais rien dans l'application ne permet de confier un bien. Sans cette étape,
le nouveau venu a un compte valide et **zéro lead visible**, sans le moindre
message d'erreur — ni pour lui, ni pour vous.

Dans l'éditeur SQL de Supabase :

```sql
insert into property_assignments (property_id, user_id, responsibility, assigned_by)
select p.id, nouveau.id, 'commercial', moi.id
from properties p
cross join (select id from auth.users where email = 'adresse@exemple.fr')  as nouveau
cross join (select id from auth.users where email = 'agence@indescale.com') as moi
where p.project_name in ('Villa Verdun', 'Villa Jean Jaurès')
on conflict (property_id, user_id) do nothing;
```

Adaptez la liste des biens. `assigned_by` garde une trace de qui a confié.

## 4. Contrôler — le seul chiffre qui compte

```sql
select u.email,
       (select count(*) from buyer_profiles bp
         where exists (select 1 from buyer_interests bi
                        where bi.buyer_profile_id = bp.id
                          and bi.property_id in (select pa.property_id
                                                   from property_assignments pa
                                                  where pa.user_id = u.id))) as leads_visibles,
       (select count(*) from buyer_profiles)                                 as total
from auth.users u
where u.email = 'adresse@exemple.fr';
```

`leads_visibles` doit égaler `total`. S'il vaut 0, l'étape 3 a été oubliée.

---

## Pourquoi ce document existe

Parce que l'étape 3 est invisible et silencieuse. Un bien lancé sans
affectation, ou un commercial ajouté sans biens, ne produit aucune erreur :
les demandes arrivent, l'argent des publicités tourne, et personne ne voit
rien. C'est le seul endroit de ce CRM où oublier un geste coûte des leads
sans que rien ne le signale.

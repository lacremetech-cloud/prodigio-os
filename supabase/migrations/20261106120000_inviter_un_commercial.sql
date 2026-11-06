-- ON NE POUVAIT PAS INVITER UN COMMERCIAL.
--
-- La migration du 12 octobre a créé le rôle `commercial` : elle a élargi
-- `organization_memberships_role_check` et `crm_role_is_assignable`, mais elle
-- a oublié `organization_invitations_role_check`. Les deux premières disent
-- « ce rôle existe et s'attribue depuis l'interface » ; la troisième, restée en
-- arrière, refusait la ligne d'invitation.
--
-- Personne ne s'en était aperçu parce que les trois commerciaux actuels n'ont
-- jamais été invités par ce chemin. Le défaut est sorti le 6 novembre, en
-- préparant l'accès d'Édouard ROWLANDSON (Cimalpes), qui doit traiter les
-- leads des 2 Alpes : `crm_create_invitation` validait le rôle, puis la base
-- refusait l'écriture — un message illisible, sur une action qui aurait dû
-- marcher.
--
-- LA LEÇON, qui ressemble à celle du 28 octobre sur les types d'événements
-- d'audit : une valeur de vocabulaire ne vit pas dans une seule contrainte.
-- Ajouter un rôle, c'est l'ajouter PARTOUT où une contrainte en tient la
-- liste. On aligne donc les deux tables sur la même source, et on ajoute un
-- test qui refusera la prochaine divergence.
--
-- `partenaire_lecture` reste invitable au niveau de la contrainte mais NON
-- attribuable (`crm_role_is_assignable` l'exclut, et c'est elle que
-- `crm_create_invitation` consulte) : son isolation fine n'est pas terminée.
-- On ne change pas cette règle ici, on se contente de ne pas la contredire.

alter table public.organization_invitations
  drop constraint if exists organization_invitations_role_check;

alter table public.organization_invitations
  add constraint organization_invitations_role_check check (
    role = any (array[
      'administrateur', 'manager', 'setter',
      'agent_immobilier', 'commercial', 'partenaire_lecture'
    ]::text[])
  );

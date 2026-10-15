-- Le commercial voit l'historique des dossiers qu'il traite
--
-- CE QUI N'ALLAIT PAS. `audit_events` n'était lisible que par
-- « administrateur » ou « manager ». Antoine et JC sont « commercial » :
-- la section Historique de la fiche leur rendait donc TOUJOURS vide.
--
-- Conséquence concrète, et c'est la plainte : tout ce qu'ils changent depuis
-- le panneau — étape, qualification, prochaine action — part dans ce journal,
-- et disparaît de leur vue. Ils complétaient des informations qui « ne se
-- retrouvaient pas dans la fiche complète ». Elles y étaient, ils n'avaient
-- simplement pas le droit de les lire.
--
-- L'ÉLARGISSEMENT EST ÉTROIT, ET VOLONTAIREMENT. Le journal contient aussi
-- les mandats, les règles économiques, les invitations et les biens : rien de
-- tout cela ne regarde un commercial. On ouvre donc UNIQUEMENT les dossiers
-- acquéreurs, et seulement ceux qu'il a déjà le droit de traiter —
-- `crm_buyer_can_operate` est exactement la règle qui le dit, celle qui
-- gouverne déjà ses écritures. Il lit son propre travail, rien d'autre.
--
-- `alter policy` plutôt que `drop` + `create` : la politique garde son
-- identité, et il n'existe à aucun instant de fenêtre sans politique — pendant
-- laquelle la table serait fermée à tout le monde.

alter policy audit_events_crm_read on public.audit_events
using (
  crm_has_role(variadic array['administrateur', 'manager'])
  or (
    entity_type = 'buyer_profile'
    and public.crm_buyer_can_operate(entity_id)
  )
  or (
    entity_type = 'buyer_interest'
    and public.crm_buyer_can_operate(
      (select i.buyer_profile_id from public.buyer_interests i where i.id = entity_id)
    )
  )
);

comment on policy audit_events_crm_read on public.audit_events is
  'Administrateur et manager lisent tout. Un commercial ne lit que l''historique des dossiers acquéreurs qu''il a le droit de traiter : son propre travail, et rien du reste de l''agence.';

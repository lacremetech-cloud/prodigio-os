-- L'historique du dossier, lisible sans exposer de helper interne.
--
-- CE QUI N'ALLAIT PAS. La migration `20261015160000` a ouvert
-- `audit_events_crm_read` au commercial sur ses propres dossiers, en appelant
-- `crm_buyer_can_operate`. Or une fonction appelee depuis une POLITIQUE
-- s'execute avec les droits du role de la SESSION, et ce helper n'a
-- deliberement aucun droit pour `authenticated` — `execute-surface.test.ts`
-- verrouille cette regle, a juste titre : c'est la surface d'attaque du
-- module.
--
-- Postgres refusait donc la lecture (« permission denied for function
-- crm_buyer_can_operate »), et la fiche, qui ignorait l'erreur, affichait
-- « Aucun evenement ». Le commercial voyait un historique vide la ou la base
-- avait refuse de repondre.
--
-- LA CORRECTION. `crm_buyer_can_operate(x)` n'est que
-- `crm_is_operator() or crm_buyer_profile_access(x)`. Ces deux fonctions sont
-- des points d'entree deja executables par `authenticated`. On ecrit la
-- politique avec elles : meme resultat, aucun helper interne expose, la regle
-- de surface reste intacte.
--
-- `alter policy` plutot que drop + create : il n'existe a aucun instant de
-- fenetre pendant laquelle la table serait sans politique de lecture.

alter policy audit_events_crm_read on public.audit_events
using (
  crm_has_role(variadic array['administrateur', 'manager'])
  or (
    entity_type = 'buyer_profile'
    and (public.crm_is_operator() or public.crm_buyer_profile_access(entity_id))
  )
  or (
    entity_type = 'buyer_interest'
    and (
      public.crm_is_operator()
      or public.crm_buyer_profile_access(
           (select i.buyer_profile_id from public.buyer_interests i where i.id = entity_id))
    )
  )
);

-- On retire le droit pose a tort : le helper reste interne.
revoke execute on function public.crm_buyer_can_operate(uuid) from authenticated;

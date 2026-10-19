-- UNE PANNE DE CONVERSION DOIT SE VOIR.
--
-- Les conversions partent vers Meta sans laisser la moindre trace : pas de
-- ligne, pas de compteur, pas de journal. C'est exactement pour cela que la
-- conversion « rendez-vous programme » est restee cassee du 14 au 19 octobre
-- sans que personne le remarque — cinq jours pendant lesquels l'optimisation
-- des campagnes travaillait sans ses meilleurs signaux.
--
-- Le resultat d'un envoi est pourtant deja connu et type : envoye, ou non
-- envoye avec son motif. Il etait simplement JETE.
--
-- Cette table le garde. Elle ne sert pas a rejouer les envois : elle sert a
-- repondre en une seconde a « est-ce que ca marche encore ? ».

create table if not exists public.meta_conversion_log (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  -- La manifestation concernee. Nullable : `PageView` n'en a pas.
  interest_id   uuid references public.buyer_interests(id) on delete set null,
  -- Le nom Meta : Lead, CompleteRegistration, Schedule, PageView.
  event_name    text not null,
  -- L'identifiant d'evenement envoye : c'est lui qui porte l'idempotence, et
  -- c'est par lui qu'on retrouve une conversion dans le gestionnaire Meta.
  event_id      text,
  -- « envoyee », ou le motif du non-envoi.
  resultat      text not null check (resultat in (
                  'envoyee','non_configure','sans_correspondance','refus','erreur')),
  detail        text
);

comment on table public.meta_conversion_log is
  'Journal des conversions Meta. Repond a « est-ce que ca marche encore ? » — '
  'la panne du 14 au 19 octobre 2026 n''a ete vue par personne faute de trace.';

-- Les lectures utiles sont « les N derniers » et « combien d'echecs recents ».
create index if not exists meta_conversion_log_recent
  on public.meta_conversion_log (created_at desc);
create index if not exists meta_conversion_log_echecs
  on public.meta_conversion_log (resultat, created_at desc)
  where resultat <> 'envoyee';

alter table public.meta_conversion_log enable row level security;

-- LECTURE : l'encadrement seul. Un journal technique n'a rien a faire sous les
-- yeux d'un commercial en train d'appeler.
drop policy if exists meta_conversion_log_read on public.meta_conversion_log;
create policy meta_conversion_log_read on public.meta_conversion_log
  for select using (public.crm_is_operator());

-- ECRITURE : par la fonction ci-dessous UNIQUEMENT. Aucune politique
-- d'insertion : meme un jeton vole ne peut pas fabriquer d'historique.

/**
 * Enregistre le resultat d'un envoi.
 *
 * `security definer` parce que l'ecriture doit aboutir quel que soit le role
 * de qui a declenche le fait metier — un commercial qui planifie une visite
 * produit une conversion, et son journal doit s'ecrire comme les autres.
 */
create or replace function public.crm_meta_conversion_log(
  p_event_name text,
  p_resultat   text,
  p_interest_id uuid default null,
  p_event_id   text default null,
  p_detail     text default null
)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
begin
  -- PAS de garde sur `auth.uid()` : la conversion « Lead » part d'un depot de
  -- formulaire PUBLIC, donc sans session. Un tel garde aurait rendu la trace
  -- muette sur la conversion la plus frequente. La protection vient du DROIT
  -- D'EXECUTION, pas d'une verification dans le corps.
  insert into public.meta_conversion_log (interest_id, event_name, event_id, resultat, detail)
  values (p_interest_id, p_event_name, p_event_id,
          case when p_resultat in ('envoyee','non_configure','sans_correspondance','refus','erreur')
               then p_resultat else 'erreur' end,
          left(coalesce(p_detail, ''), 500));
exception when others then
  -- LE JOURNAL NE DOIT JAMAIS FAIRE ECHOUER CE QU'IL OBSERVE. Une visite
  -- planifiee reste planifiee, meme si sa trace ne s'ecrit pas.
  return;
end;
$function$;

revoke all on function public.crm_meta_conversion_log(text, text, uuid, text, text) from public;
grant execute on function public.crm_meta_conversion_log(text, text, uuid, text, text) to authenticated;

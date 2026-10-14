-- Webhook de dépôt, propre à chaque bien.
--
-- À la soumission d'un formulaire, une automatisation externe (Make) envoie un
-- SMS à la personne avec le lien de son dossier. Le délai de rappel est ce qui
-- distingue un lead traité d'un lead perdu : l'accusé part dans la seconde,
-- sans attendre qu'un commercial soit disponible.
--
-- L'adresse vit EN BASE et non dans une variable d'environnement : il y a un
-- scénario par bien, et un bien se crée sans redéployer l'application. Mettre
-- ces adresses dans l'environnement obligerait à un déploiement à chaque
-- nouvelle villa, et à retrouver quelle variable correspond à quel bien.
--
-- Ce n'est pas un secret au sens strict, mais quiconque détient l'adresse peut
-- déclencher l'envoi d'un SMS : la table n'ouvre sa lecture qu'au rôle
-- `authenticated`, et cette colonne ne sort jamais par `buyer_form_context`,
-- la fonction publique du formulaire.

alter table public.property_public_config
  add column if not exists buyer_form_webhook_url text;

comment on column public.property_public_config.buyer_form_webhook_url is
  'Adresse appelée après un dépôt accepté (accusé de réception automatisé). '
  'Jamais exposée au visiteur ni par buyer_form_context.';

-- Garde-fou : une adresse mal collée ne doit pas partir en production. Seul
-- HTTPS est accepté, et la valeur vide est refusée plutôt que stockée.
alter table public.property_public_config
  drop constraint if exists property_public_config_webhook_https;

alter table public.property_public_config
  add constraint property_public_config_webhook_https
  check (
    buyer_form_webhook_url is null
    or buyer_form_webhook_url ~ '^https://[^[:space:]]+$'
  );

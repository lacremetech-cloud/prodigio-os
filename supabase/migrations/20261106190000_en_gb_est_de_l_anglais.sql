-- « en-GB » EST DE L'ANGLAIS, DES DEUX CÔTÉS.
--
-- Deux couches lisent la langue, et elles ne la lisaient pas pareil.
--
--   TypeScript — `normaliserLangue()` : tronque à deux lettres, donc « en-GB »,
--   « EN » et « en » donnent tous « en ». Son commentaire le dit en toutes
--   lettres : « Accepte "en-GB" et "EN" aussi bien que "en" ».
--
--   SQL — `buyer_form_brochure()` : comparait `lower(p_langue) = 'en'`, en
--   exact. « en-GB » n'était donc PAS de l'anglais pour elle, et elle rendait
--   la brochure française.
--
-- Aujourd'hui le défaut ne se voit pas : l'application normalise avant
-- d'appeler, donc la fonction ne reçoit jamais que « fr » ou « en ». C'est
-- précisément ce qui le rend dangereux — il attend un appel direct, un
-- deuxième client, ou une page qui transmettrait l'en-tête `Accept-Language`
-- tel quel. Et il échouerait en silence : un prospect anglophone recevrait la
-- brochure française, sans erreur nulle part.
--
-- C'est la même leçon que les contraintes d'énumération en double, le
-- 28 octobre et le 6 novembre : une règle de vocabulaire qui vit à deux
-- endroits finit toujours par diverger. On aligne la seconde sur la première.

create or replace function public.buyer_form_brochure(
  p_slug text,
  p_interest_id uuid,
  p_langue text default 'fr'
) returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
  select case
           -- Deux premières lettres, comme `normaliserLangue()` côté code.
           when left(lower(btrim(coalesce(p_langue, 'fr'))), 2) = 'en'
             then coalesce(nullif(btrim(c.buyer_form_brochure_url_en), ''),
                           c.buyer_form_brochure_url)
           else c.buyer_form_brochure_url
         end
  from public.property_public_config c
  join public.buyer_interests i
    on i.property_id = c.property_id and i.id = p_interest_id
  where lower(c.slug) = public.normalize_public_slug(p_slug)
    and (coalesce(c.buyer_form_status, 'inactif') = 'actif' or c.publication_status = 'publie')
  limit 1;
$function$;

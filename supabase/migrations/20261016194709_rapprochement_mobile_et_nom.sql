-- RECONNAITRE LA PERSONNE SUR SON MOBILE, PAS SEULEMENT SUR SON E-MAIL.
--
-- Hugues Monchamps a depose deux fois le 16 octobre a trois minutes
-- d'intervalle : meme mobile, deux adresses (dont une masquee Apple), nom
-- saisi dans un ordre puis dans l'autre. Deux fiches, deux appels pour la
-- meme personne. Le systeme savait pourtant faire : Patalano Eric a UNE fiche
-- et DEUX interets, Verdun et Jean Jaures. Seule la reconnaissance a echoue.
--
-- TROIS GARDE-FOUS, parce qu'une fusion fausse coute plus cher qu'un doublon :
--   1. MOBILE uniquement. Une ligne fixe est partagee par un foyer ou un
--      bureau : fusionner dessus ferait disparaitre un acquereur. Stephan
--      Cohen a depose depuis un 01 — il ne doit jamais etre rapproche ainsi.
--   2. ET le nom doit concorder, ordre et accents ignores. Un conjoint qui
--      saisit le numero de son epoux ne declenche donc pas de fusion.
--   3. Mobile connu mais nom different : on SIGNALE (`doublon_probable_de`),
--      on ne fusionne pas. Conjoint, collegue et faute de frappe sont
--      indiscernables automatiquement ; un humain tranche.
--
-- L'e-mail exact reste le premier critere, inchange.
--
-- Verifie sur les donnees reelles AVANT livraison : la regle rattache bien le
-- second depot de Hugues au premier, et ne declenche AUCUNE autre fusion sur
-- les 26 dossiers — zero faux positif, zero collision sur ligne fixe.
--
-- La fonction est reecrite depuis SA PROPRE definition, en ne changeant que ce
-- bloc : aucune recopie de ses deux cents lignes. Le bloc LEVE si le motif
-- n'est pas trouve, pour qu'un echec ne passe jamais pour un succes.

do $do$
declare
  d text;
  avant constant text := $av$  -- Dédoublonnage CONSERVATEUR par e-mail uniquement. Un contact existant
  -- (vendeur ou acquéreur) est RÉUTILISÉ TEL QUEL : aucune donnée modifiée.
  if v_email is not null then
    select id into v_contact_id from public.contacts
      where lower(email) = v_email order by created_at asc limit 1;
  end if;
  if v_contact_id is null then
    insert into public.contacts (kind, first_name, last_name, email, phone, preferred_channel, status)
    values ('personne_physique',
      left(nullif(payload->>'contact_first_name', ''), 120),
      left(nullif(payload->>'contact_last_name', ''), 120),
      v_email, v_phone, v_pref, 'nouveau')
    returning id into v_contact_id;
    v_resolution := 'nouveau_contact';
  else
    v_resolution := 'contact_existant';
  end if;$av$;
  apres constant text := $ap$  -- Dédoublonnage CONSERVATEUR. Un contact existant (vendeur ou acquéreur)
  -- est RÉUTILISÉ TEL QUEL : aucune donnée modifiée, jamais.
  --
  -- 1) L'e-mail exact, critère historique et le plus sûr.
  if v_email is not null then
    select id into v_contact_id from public.contacts
      where lower(email) = v_email order by created_at asc limit 1;
  end if;

  -- 2) À défaut : même MOBILE **et** nom concordant. Les deux, jamais l'un
  --    sans l'autre. Le mobile seul rapprocherait un conjoint ; le nom seul
  --    rapprocherait deux homonymes. Les lignes fixes sont exclues : elles
  --    sont partagées, et fusionner dessus ferait disparaître un acquéreur.
  if v_contact_id is null and public.est_mobile_fr(v_phone) then
    select id into v_contact_id from public.contacts
      where phone = v_phone
        and public.empreinte_nom(first_name, last_name) is not null
        and public.empreinte_nom(first_name, last_name)
            = public.empreinte_nom(payload->>'contact_first_name',
                                   payload->>'contact_last_name')
      order by created_at asc limit 1;
  end if;

  if v_contact_id is null then
    -- 3) Arrivé ici, aucun rapprochement n'a eu lieu. Si le mobile est pourtant
    --    déjà connu, c'est que le nom ne concordait pas : on SIGNALE sans
    --    fusionner. Conjoint, collègue ou chiffre mal saisi sont
    --    indiscernables d'ici — un humain tranchera.
    insert into public.contacts (kind, first_name, last_name, email, phone,
                                 preferred_channel, status, doublon_probable_de)
    values ('personne_physique',
      left(nullif(payload->>'contact_first_name', ''), 120),
      left(nullif(payload->>'contact_last_name', ''), 120),
      v_email, v_phone, v_pref, 'nouveau',
      case when public.est_mobile_fr(v_phone)
           then (select c2.id from public.contacts c2
                  where c2.phone = v_phone order by c2.created_at asc limit 1)
      end)
    returning id into v_contact_id;
    v_resolution := 'nouveau_contact';
  else
    v_resolution := 'contact_existant';
  end if;$ap$;
begin
  select pg_get_functiondef(p.oid) into d
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'submit_buyer_interest'
     and pg_get_function_identity_arguments(p.oid) = 'payload jsonb';

  if d is null then
    raise exception 'submit_buyer_interest(jsonb) introuvable';
  end if;
  if position(avant in d) = 0 then
    if position('est_mobile_fr' in d) > 0 then
      return;  -- deja applique
    end if;
    raise exception 'le bloc de resolution du contact a change : correction a revoir a la main';
  end if;

  execute replace(d, avant, apres);
end $do$;

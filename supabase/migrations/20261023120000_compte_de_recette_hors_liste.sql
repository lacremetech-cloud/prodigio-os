-- ---------------------------------------------------------------------------
-- LE COMPTE DE RECETTE NE DOIT PLUS ETRE PROPOSE COMME COLLEGUE.
-- ---------------------------------------------------------------------------
-- Le menu « Confier a... » listait « RECETTE (temporaire) » a cote d'Antoine,
-- de JC et de Nicolas. C'est le compte de recette neutralise : personne ne
-- peut s'y connecter. Lui confier un vrai lead l'aurait fait disparaitre du
-- radar de tout le monde, sans erreur et sans avertissement — et sans que
-- quiconque pense a aller le chercher la.
--
-- Son adhesion passe donc en « suspendu ». Le compte RESTE, ses traces
-- d'audit aussi : on ne supprime rien, on cesse seulement de le presenter
-- comme quelqu'un a qui l'on peut passer la main. `crm_buyer_assign` refuse
-- deja les membres non actifs, et la liste a l'ecran filtre desormais sur ce
-- meme statut.
--
-- Si ce compte tient encore un dossier, il n'est pas libere ici : l'affectation
-- etant libre, n'importe qui peut le reprendre en un clic.
-- ---------------------------------------------------------------------------

update public.organization_memberships
   set status = 'suspendu',
       updated_at = now()
 where user_id = 'ffffffff-0000-4000-8000-00000000ff01'
   and status <> 'suspendu';

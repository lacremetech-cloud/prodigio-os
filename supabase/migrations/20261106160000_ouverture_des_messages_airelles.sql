-- LA MÊME PHRASE D'OUVERTURE PARTOUT.
--
-- Les trois premiers e-mails des Airelles ouvrent sur « Je me présente,
-- Édouard, votre contact sur place ». Le message WhatsApp, écrit avant eux,
-- ouvrait sur « moi c'est Édouard ».
--
-- Ce n'est pas qu'une question de style : un prospect reçoit souvent les deux
-- à quelques minutes d'écart, l'e-mail automatique puis le WhatsApp du
-- commercial. Deux formules de présentation différentes de la même personne,
-- et le second message a l'air d'un modèle.
--
-- On ne touche QUE l'ouverture. Le reste du texte est celui de Victor, mot
-- pour mot, apostrophes typographiques comprises.

update public.property_public_config
set whatsapp_message = replace(
      whatsapp_message,
      'moi c’est Édouard, votre contact sur place',
      'je me présente, Édouard, votre contact sur place')
where slug = 'les-airelles-aux-2-alpes'
  and whatsapp_message like '%moi c’est Édouard, votre contact sur place%';

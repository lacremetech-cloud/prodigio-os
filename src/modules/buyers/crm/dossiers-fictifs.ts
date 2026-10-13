/**
 * Dossiers FICTIFS pour vérifier la consolidation, sans toucher à la base.
 *
 * Six situations, choisies parce que chacune a déjà produit une divergence
 * entre deux écrans :
 *
 *   1. jamais contacté            — « À contacter » doit le retenir, et lui seul
 *   2. injoignable, rappel futur  — ne doit PAS compter comme « rappel dû »
 *   3. rappel en retard           — doit remonter en tête de file
 *   4. gros potentiel             — seul jugement qui pèse dans l'urgence
 *   5. non qualifié               — avec son motif, obligatoire
 *   6. et 7. une même personne sur DEUX projets, avec deux qualifications
 *      différentes — le cas qui a motivé toute la séparation par dossier
 *
 * L'instant de référence est fixe : un jeu d'essai dont le résultat change
 * avec l'heure ne prouve rien.
 */

import type { BuyerInboxRow } from "./queries";

/** Jeudi 15 octobre 2026, 10 h 00 UTC. */
export const INSTANT_ESSAI = Date.parse("2026-10-15T10:00:00.000Z");

function base(over: Partial<BuyerInboxRow>): BuyerInboxRow {
  return {
    interestId: "i-0",
    buyerProfileId: "p-0",
    name: "Sans nom",
    emailMasked: "contact@exemple.test",
    phoneMasked: "+33600000000",
    city: "Cassis",
    stage: "nouveau",
    interestCount: 1,
    lastInterestAt: "2026-10-12T09:00:00.000Z",
    createdAt: "2026-10-12T09:00:00.000Z",
    propertyId: "prop-verdun",
    propertyLabel: "Villa Verdun",
    assigneeNames: [],
    assigneeIds: [],
    nextActionAt: null,
    nextActionTitle: null,
    nextActionId: null,
    nextActionKind: null,
    overdue: false,
    noNextAction: true,
    newInterest: true,
    highPotential: false,
    unassigned: true,
    budgetMinCents: null,
    budgetMaxCents: null,
    budgetChoice: null,
    qualification: "a_qualifier",
    qualificationReason: null,
    callAttempts: 0,
    lastCallAt: null,
    lastCallOutcome: null,
    lastNote: null,
    lastNoteAt: null,
    lastNoteBy: null,
    phoneInvalid: false,
    ...over,
  };
}

export const DOSSIERS_FICTIFS: BuyerInboxRow[] = [
  base({
    interestId: "i-1",
    buyerProfileId: "p-1",
    name: "Camille Durand",
    phoneMasked: "+33612345678",
    stage: "nouveau",
  }),
  base({
    interestId: "i-2",
    buyerProfileId: "p-2",
    name: "Marc Lefèvre",
    phoneMasked: "+33623456789",
    stage: "a_rappeler",
    callAttempts: 2,
    lastCallAt: "2026-10-14T16:00:00.000Z",
    lastCallOutcome: "sans_reponse",
    lastNote: "Boîte vocale, deux fois.",
    lastNoteAt: "2026-10-14T16:00:00.000Z",
    // Rappel pris pour DEMAIN : il ne doit rien demander aujourd'hui.
    nextActionAt: "2026-10-16T09:30:00.000Z",
    nextActionTitle: "Rappeler",
    nextActionId: "t-2",
    nextActionKind: "rappel",
    noNextAction: false,
    newInterest: false,
    assigneeNames: ["jean-charles"],
    assigneeIds: ["u-jc"],
    unassigned: false,
  }),
  base({
    interestId: "i-3",
    buyerProfileId: "p-3",
    name: "Sophie Marchand",
    phoneMasked: "+33634567890",
    stage: "en_discussion",
    callAttempts: 1,
    lastCallAt: "2026-10-13T11:00:00.000Z",
    lastCallOutcome: "contact_etabli",
    lastNote: "Veut revoir le jardin avant de se décider.",
    lastNoteAt: "2026-10-13T11:00:00.000Z",
    // Rappel promis AVANT-HIER et jamais tenu.
    nextActionAt: "2026-10-13T15:00:00.000Z",
    nextActionTitle: "Rappeler",
    nextActionId: "t-3",
    nextActionKind: "rappel",
    overdue: true,
    noNextAction: false,
    newInterest: false,
    assigneeNames: ["jean-charles"],
    assigneeIds: ["u-jc"],
    unassigned: false,
  }),
  base({
    interestId: "i-4",
    buyerProfileId: "p-4",
    name: "Olivier Pastor",
    phoneMasked: "+33645678901",
    stage: "visite",
    qualification: "gros_potentiel",
    callAttempts: 3,
    lastCallAt: "2026-10-14T09:00:00.000Z",
    lastCallOutcome: "contact_etabli",
    lastNote: "Vend son appartement à Marseille, finance comptant.",
    lastNoteAt: "2026-10-14T09:00:00.000Z",
    // Visite calée pour AUJOURD'HUI, plus tard dans la journée.
    nextActionAt: "2026-10-15T17:00:00.000Z",
    nextActionTitle: "Visite",
    nextActionId: "t-4",
    nextActionKind: "visite",
    noNextAction: false,
    newInterest: false,
    budgetMinCents: 1_300_000_00,
    budgetMaxCents: 1_800_000_00,
    assigneeNames: ["jean-charles"],
    assigneeIds: ["u-jc"],
    unassigned: false,
    highPotential: true,
  }),
  base({
    interestId: "i-5",
    buyerProfileId: "p-5",
    name: "Nadia Bensaïd",
    phoneMasked: "+33656789012",
    stage: "vivier",
    qualification: "non_qualifie",
    qualificationReason: "Budget incompatible",
    callAttempts: 1,
    lastCallAt: "2026-10-13T14:30:00.000Z",
    lastCallOutcome: "contact_etabli",
    lastNote: "Cherche autour de 600 k€, nous sommes trop haut.",
    lastNoteAt: "2026-10-13T14:30:00.000Z",
    noNextAction: true,
    newInterest: false,
    budgetMinCents: 500_000_00,
    budgetMaxCents: 700_000_00,
    assigneeNames: ["jean-charles"],
    assigneeIds: ["u-jc"],
    unassigned: false,
  }),

  /* La MÊME personne, sur deux projets, avec deux jugements différents. Une
     seule fiche contact, deux suivis commerciaux. C'est le cas qui rendait
     l'ancienne qualification — portée par la personne — intenable. */
  base({
    interestId: "i-6a",
    buyerProfileId: "p-6",
    name: "Hélène Roux",
    phoneMasked: "+33667890123",
    propertyId: "prop-verdun",
    propertyLabel: "Villa Verdun",
    stage: "en_discussion",
    qualification: "gros_potentiel",
    interestCount: 2,
    callAttempts: 2,
    lastCallAt: "2026-10-14T11:00:00.000Z",
    lastCallOutcome: "contact_etabli",
    lastNote: "Verdun lui plaît beaucoup, elle veut revenir avec son mari.",
    lastNoteAt: "2026-10-14T11:00:00.000Z",
    nextActionAt: "2026-10-15T09:00:00.000Z",
    nextActionTitle: "Rappeler",
    nextActionId: "t-6a",
    nextActionKind: "rappel",
    noNextAction: false,
    newInterest: false,
    assigneeNames: ["jean-charles"],
    assigneeIds: ["u-jc"],
    unassigned: false,
    highPotential: true,
  }),
  base({
    interestId: "i-6b",
    buyerProfileId: "p-6",
    name: "Hélène Roux",
    phoneMasked: "+33667890123",
    propertyId: "prop-jean-jaures",
    propertyLabel: "Villa Jean Jaurès",
    stage: "vivier",
    qualification: "non_qualifie",
    qualificationReason: "Projet incompatible",
    interestCount: 2,
    callAttempts: 2,
    lastCallAt: "2026-10-14T11:00:00.000Z",
    lastCallOutcome: "contact_etabli",
    lastNote: "Jean Jaurès : pas de piscine, elle n'en veut pas.",
    lastNoteAt: "2026-10-14T11:00:00.000Z",
    noNextAction: true,
    newInterest: false,
    assigneeNames: ["jean-charles"],
    assigneeIds: ["u-jc"],
    unassigned: false,
  }),
];

export const MEMBRES_FICTIFS = [{ userId: "u-jc", name: "jean-charles" }];

/**
 * Les tâches ouvertes correspondantes, au format que lit `prochaineAction`.
 * Elles portent les MÊMES échéances que `nextActionAt` ci-dessus : c'est
 * précisément ce que les vérifications comparent.
 */
export const TACHES_FICTIVES = DOSSIERS_FICTIFS.filter((d) => d.nextActionAt).map((d) => ({
  id: d.nextActionId as string,
  title: d.nextActionTitle,
  kind: d.nextActionKind,
  due_at: d.nextActionAt,
  status: "a_faire",
  buyer_profile_id: d.buyerProfileId,
  interest_id: d.interestId,
}));

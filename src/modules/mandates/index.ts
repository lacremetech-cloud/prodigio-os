/**
 * Module Mandats — moteur d'acquisition et de qualification des propriétaires
 * vendeurs, jusqu'au résultat commercial de l'opportunité.
 * Voir docs/02-MVP-SCOPE.md et docs/03-DOMAIN-MODEL.md.
 *
 * Première tranche livrée : la capture (landing propriétaire + analyse
 * d'éligibilité + soumission Supabase) et la préqualification (scoring).
 * Voir les sous-modules `funnel` et `scoring`.
 */
export * from "./funnel";
export * from "./scoring";

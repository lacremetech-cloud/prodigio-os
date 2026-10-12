/**
 * Point d'entrée du **Studio Communications & Workflows**.
 *
 * Ce barillet n'exporte que des éléments **purs** (aucune dépendance serveur,
 * aucun accès réseau) : ils peuvent donc être utilisés indifféremment côté
 * serveur ou côté navigateur. Les lectures en base vivent dans `./queries`,
 * qui est `server-only` et s'importe par son chemin explicite.
 */

export * from "./system-automations";
export * from "./automation";
export * from "./fixtures";
export * from "./simulator";
export * from "./activation";
export * from "./preview";
export * from "./diff";

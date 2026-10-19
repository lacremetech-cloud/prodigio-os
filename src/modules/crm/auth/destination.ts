import { roleHome } from "./roles";

/**
 * Où atterrit-on après une connexion réussie.
 *
 * Fonction PURE, dans son propre module : un fichier « use server » ne peut
 * exporter que des fonctions asynchrones, donc la laisser dans `actions.ts`
 * la rendait intestable. Elle y était restée privée, et le câblage qu'elle
 * décrit n'a jamais été vérifié par personne.
 *
 * `roles` ne sert que FAUTE de destination explicite : une personne renvoyée
 * vers la page qu'elle demandait doit y arriver, quel que soit son rôle.
 * Seuls les chemins internes au CRM sont acceptés — « //exemple.test » et
 * « javascript: » n'en sont pas, et une redirection ouverte depuis une page
 * de connexion est un hameçonnage prêt à l'emploi.
 */
export function safeRedirect(target: string | undefined, roles: readonly string[]): string {
  if (target && target.startsWith("/crm")) return target;
  return roleHome(roles);
}

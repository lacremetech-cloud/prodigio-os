import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { roleHome } from "./roles";
import { safeRedirect } from "./destination";

/**
 * J'AI CORRIGÉ UNE FONCTION QUE PERSONNE N'APPELAIT.
 *
 * `roleHome` portait le commentaire « Destination après connexion ». C'était
 * faux : la page de connexion et `signInAction` renvoyaient tous deux
 * « /crm » en dur, et `roleHome` n'avait aucun appelant. J'ai modifié la
 * fonction, le test est passé — parce qu'il testait la fonction morte — et
 * l'utilisatrice s'est connectée pour atterrir exactement où elle atterrissait
 * avant.
 *
 * Tester une fonction ne prouve pas qu'elle sert. Ces tests tiennent les deux
 * bouts : ce que `roleHome` répond, ET le fait que le chemin de connexion
 * l'appelle vraiment.
 */

const lire = (chemin: string) => readFileSync(chemin, "utf8");

describe("la destination après connexion est bien CÂBLÉE", () => {
  it("`signInAction` passe par safeRedirect, qui passe par roleHome", () => {
    const action = lire("src/modules/crm/auth/actions.ts");
    expect(action).toContain('from "./destination"');
    expect(action).toMatch(/redirect\(safeRedirect\(/);
    expect(lire("src/modules/crm/auth/destination.ts")).toMatch(/roleHome\(/);
  });

  it("la page de connexion ne force plus « /crm » par défaut", () => {
    const source = lire("src/app/connexion/page.tsx");
    /* Le défaut DOIT être `undefined` : c'est ce qui laisse `signInAction`
       décider selon le rôle. Remettre « /crm » ici reproduirait le bug à
       l'identique, sans rien casser d'autre — donc sans se voir. */
    expect(source).toMatch(/:\s*undefined;/);
    expect(source).not.toMatch(/\?\s*params\.redirect\s*:\s*"\/crm"/);
  });

  it("roleHome a au moins un appelant hors de son propre module", () => {
    const appelants = ["src/modules/crm/auth/destination.ts"];
    const trouve = appelants.filter((f) => /roleHome\(/.test(lire(f)));
    expect(trouve.length).toBeGreaterThan(0);
  });
});

describe("roleHome : où atterrit-on", () => {
  it("le commercial arrive sur ses leads, filtrés au-dessus d'un million", () => {
    expect(roleHome(["commercial"])).toBe("/crm/acquereurs?budget=plus_1m");
  });

  it("les autres rôles gardent le tableau de bord", () => {
    for (const r of ["administrateur", "manager", "setter", "agent_immobilier"]) {
      expect(roleHome([r]), r).toBe("/crm");
    }
    // Un commercial qui est AUSSI setter opère : il garde le tableau de bord.
    expect(roleHome(["commercial", "setter"])).toBe("/crm");
  });

  it("sans accès, on ne tombe pas dans une boucle de connexion", () => {
    expect(roleHome([])).toBe("/acces");
    expect(roleHome(["role_inconnu"])).toBe("/acces");
  });
});

describe("safeRedirect : la destination demandée prime sur le rôle", () => {
  it("une destination interne explicite est respectée, quel que soit le rôle", () => {
    expect(safeRedirect("/crm/visites", ["commercial"])).toBe("/crm/visites");
    expect(safeRedirect("/crm", ["commercial"])).toBe("/crm");
  });

  it("sans destination, le rôle décide", () => {
    expect(safeRedirect(undefined, ["commercial"])).toBe("/crm/acquereurs?budget=plus_1m");
    expect(safeRedirect(undefined, ["administrateur"])).toBe("/crm");
  });

  it("une destination EXTERNE est refusée : pas de redirection ouverte", () => {
    for (const mechant of ["https://exemple.test", "//exemple.test", "/compte", "javascript:alert(1)"]) {
      expect(safeRedirect(mechant, ["administrateur"]), mechant).toBe("/crm");
    }
  });
});

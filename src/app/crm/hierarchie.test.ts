import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

/**
 * UNE ÉTIQUETTE NE PEUT PAS ÊTRE PLUS GROSSE QUE SA SECTION.
 *
 * Le panneau affichait « ENREGISTRER UN ÉCHANGE » en 10,5 px et, juste en
 * dessous, « BIEN CONCERNÉ » en 11,5 px : le contenant plus petit que son
 * contenu. Les quatre rangs — titre de section, titre de sous-bloc, étiquette
 * de champ, ligne de rang — étaient tous « petit gris gras majuscule
 * espacé », séparés par un demi-pixel. Ce n'est pas une hiérarchie, c'est une
 * texture.
 *
 * Rien ne pouvait l'attraper : le CSS n'est couvert par aucun test, et
 * l'inversion ne casse rien — elle rend seulement l'écran illisible. C'est
 * l'utilisateur qui l'a vue, à l'œil, et il avait raison au demi-pixel près.
 */

const css = readFileSync("src/app/crm/crm.css", "utf8");

/** La valeur d'une propriété dans la première déclaration d'un sélecteur. */
function propriete(selecteur: string, prop: string): string | null {
  const i = css.indexOf(selecteur + " {");
  if (i < 0) return null;
  const bloc = css.slice(i, css.indexOf("}", i));
  const m = new RegExp(`(?:^|[;{\\s])${prop}\\s*:\\s*([^;]+)`, "m").exec(bloc);
  return m ? m[1]!.trim() : null;
}

const px = (selecteur: string, prop = "font-size") => {
  const v = propriete(selecteur, prop);
  expect(v, `${selecteur} { ${prop} }`).toBeTruthy();
  return Number.parseFloat(v!);
};

describe("la hiérarchie du panneau tient debout", () => {
  it("le titre de section domine l'étiquette de champ", () => {
    expect(px(".crm-bloc__titre")).toBeGreaterThan(px(".crm-label"));
  });

  it("le sous-bloc se place ENTRE les deux", () => {
    const section = px(".crm-bloc__titre");
    const sousBloc = px(".crm-sous-bloc__titre");
    const etiquette = px(".crm-label");
    expect(sousBloc).toBeLessThan(section);
    expect(sousBloc).toBeGreaterThan(etiquette);
  });

  it("les rangs se distinguent par la CASSE, pas seulement par la taille", () => {
    // Un titre en capitales de 13 px et une étiquette en capitales de 10,5 px
    // se ressemblent encore trop : le titre reprend la casse normale.
    expect(propriete(".crm-bloc__titre", "text-transform")).toBe("none");
    expect(propriete(".crm-label", "text-transform")).toBe("uppercase");
  });

  it("et par la COULEUR : le titre est plein, l'étiquette s'efface", () => {
    expect(propriete(".crm-bloc__titre", "color")).toBe("var(--crm-text)");
    expect(propriete(".crm-label", "color")).toBe("var(--crm-text-faint)");
  });

  it("la section est délimitée, comme ses voisines", () => {
    // Elle n'avait ni cadre, ni fond, ni filet, entre deux blocs encadrés.
    expect(propriete(".crm-bloc", "border-top")).toContain("var(--crm-line-soft)");
  });
});

describe("l'aplat d'accent ne dit qu'une chose : « ceci écrit »", () => {
  const aplat = (selecteur: string) => propriete(selecteur, "background") ?? "";

  it("le bouton qui valide le porte", () => {
    expect(aplat(".crm-btn--primaire")).toContain("var(--crm-univers)");
  });

  it("une SÉLECTION ne le porte plus — elle se teinte et s'encadre", () => {
    for (const sel of ['.crm-gros-choix[aria-pressed="true"]', '.crm-choix__item[aria-pressed="true"]']) {
      // Teinté, pas rempli : « Rappeler » choisi et « Enregistrer et suivant »
      // étaient le même vert, côte à côte dans le même panneau.
      expect(aplat(sel), sel).not.toBe("var(--crm-univers)");
      expect(propriete(sel, "border-color"), sel).toBe("var(--crm-univers)");
    }
  });

  it("le sélecteur « Confier à… » ne se fait plus passer pour une action principale", () => {
    expect(propriete(".crm-panneau__attribuer-choix", "border")).toContain("var(--crm-line)");
    expect(propriete(".crm-panneau__attribuer-choix", "border")).not.toContain("--crm-univers");
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { ChoixEtape, ChoixQualification } from "./choix-vocabulaire";

/**
 * LES DEUX AXES RESTENT DEUX AXES.
 *
 * Étape de traitement et qualification répondent à deux questions
 * différentes : où en est le dossier, et ce qu'on en pense. Les fusionner ou
 * en cacher un ferait perdre l'information que l'autre ne porte pas. Ils
 * passent en sélecteurs compacts — onze boutons permanents repoussaient la
 * note et la prochaine tâche hors de l'écran — mais ils restent SÉPARÉS et
 * tous deux visibles.
 */

afterEach(cleanup);

describe("sélecteur compact", () => {
  it("affiche la valeur ENREGISTRÉE tant que rien n'est en attente", () => {
    const { getByRole } = render(
      <ChoixEtape valeur={null} actuelle="a_rappeler" onChoisir={() => {}} />,
    );
    expect(getByRole("button").textContent).toContain("À rappeler");
  });

  it("affiche la modification EN ATTENTE, et la signale comme telle", () => {
    // Sans ce marqueur, la pastille annoncerait comme acquis un choix que
    // personne n'a encore enregistré.
    const { getByRole } = render(
      <ChoixEtape valeur="visite_planifiee" actuelle="a_rappeler" onChoisir={() => {}} />,
    );
    const t = getByRole("button").textContent ?? "";
    expect(t).toContain("Visite planifiée");
    expect(t).toContain("modifié");
  });

  it("ne crie pas « modifié » quand la modification égale la valeur enregistrée", () => {
    const { getByRole } = render(
      <ChoixEtape valeur="a_rappeler" actuelle="a_rappeler" onChoisir={() => {}} />,
    );
    expect(getByRole("button").textContent).not.toContain("modifié");
  });

  it("garde les choix fermés, puis les ouvre au clic", () => {
    const { getByRole, queryByRole } = render(
      <ChoixEtape valeur={null} actuelle="a_contacter" onChoisir={() => {}} />,
    );
    expect(queryByRole("listbox")).toBeNull();
    fireEvent.click(getByRole("button"));
    expect(getByRole("listbox")).toBeTruthy();
  });

  it("marque l'option en cours comme sélectionnée", () => {
    const { getByRole, getAllByRole } = render(
      <ChoixEtape valeur={null} actuelle="a_rappeler" onChoisir={() => {}} />,
    );
    fireEvent.click(getByRole("button"));
    const retenues = getAllByRole("option").filter(
      (o) => o.getAttribute("aria-selected") === "true",
    );
    expect(retenues).toHaveLength(1);
    expect(retenues[0]?.textContent).toContain("À rappeler");
  });

  it("remonte le choix d'une AUTRE valeur", () => {
    const vu = vi.fn();
    const { getByRole, getAllByRole } = render(
      <ChoixEtape valeur={null} actuelle="a_contacter" onChoisir={vu} />,
    );
    fireEvent.click(getByRole("button"));
    const cible = getAllByRole("option").find((o) => o.textContent?.includes("À rappeler"));
    fireEvent.click(cible!);
    expect(vu).toHaveBeenCalledWith("a_rappeler");
  });

  it("ANNULE quand on rechoisit la valeur enregistrée", () => {
    // La seule façon de revenir en arrière sans sauvegarder un choix dont on
    // ne voulait pas.
    const vu = vi.fn();
    const { getByRole, getAllByRole } = render(
      <ChoixEtape valeur="visite_planifiee" actuelle="a_contacter" onChoisir={vu} />,
    );
    fireEvent.click(getByRole("button", { name: /Étape/ }));
    const retour = getAllByRole("option").find((o) => o.textContent?.includes("À contacter"));
    fireEvent.click(retour!);
    expect(vu).toHaveBeenCalledWith(null);
  });

  it("se referme sur Échap, sans piéger le clavier", () => {
    const { getByRole, queryByRole } = render(
      <ChoixEtape valeur={null} actuelle="a_contacter" onChoisir={() => {}} />,
    );
    fireEvent.click(getByRole("button"));
    expect(getByRole("listbox")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(queryByRole("listbox")).toBeNull();
  });

  it("n'ouvre rien quand il est désactivé", () => {
    const { getByRole, queryByRole } = render(
      <ChoixEtape valeur={null} actuelle="a_contacter" onChoisir={() => {}} disabled />,
    );
    fireEvent.click(getByRole("button"));
    expect(queryByRole("listbox")).toBeNull();
  });
});

describe("étape et qualification sont DEUX sélecteurs", () => {
  it("nomment chacun leur axe, pour ne pas se confondre", () => {
    // Deux pastilles colorées côte à côte, sans leur libellé, ne disent plus
    // laquelle est l'étape et laquelle le jugement commercial.
    const e = render(<ChoixEtape valeur={null} actuelle="a_rappeler" onChoisir={() => {}} />);
    expect(e.getByRole("button").textContent).toContain("Étape");
    cleanup();
    const q = render(
      <ChoixQualification valeur={null} actuelle="qualifie" onChoisir={() => {}} />,
    );
    expect(q.getByRole("button").textContent).toContain("Qualification");
    expect(q.getByRole("button").textContent).toContain("Qualifié");
  });

  it("proposent des listes distinctes", () => {
    const q = render(
      <ChoixQualification valeur={null} actuelle="qualifie" onChoisir={() => {}} />,
    );
    fireEvent.click(q.getByRole("button"));
    const libelles = q.getAllByRole("option").map((o) => o.textContent);
    // Une étape n'a rien à faire dans la liste des qualifications.
    expect(libelles.join(" ")).not.toContain("Visite planifiée");
  });
});

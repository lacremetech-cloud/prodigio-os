// @vitest-environment jsdom
import { useRef } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "./theme-provider";
import { ThemeToggle } from "./theme-toggle";
import type { ThemePreference } from "./theme";

function Harness({ initial = "dark" as ThemePreference }: { initial?: ThemePreference }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} data-testid="root" data-crm-theme="dark">
      <ThemeProvider initialPreference={initial} rootRef={ref}>
        <ThemeToggle />
      </ThemeProvider>
    </div>
  );
}

afterEach(() => {
  cleanup();
  document.cookie = "crm-theme=; max-age=0; path=/";
});

describe("ThemeToggle", () => {
  it("expose un radiogroup accessible avec les 3 thèmes", () => {
    render(<Harness />);
    const group = screen.getByRole("radiogroup", { name: "Thème de l’interface" });
    expect(group).toBeTruthy();
    for (const label of ["Sombre", "Clair", "Système"]) {
      expect(screen.getByRole("radio", { name: new RegExp(label) })).toBeTruthy();
    }
  });

  it("le thème sombre est sélectionné par défaut", () => {
    render(<Harness initial="dark" />);
    expect((screen.getByRole("radio", { name: /Sombre/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: /Clair/ }) as HTMLInputElement).checked).toBe(false);
  });

  it("sélectionner « Clair » applique le thème et persiste dans le cookie", () => {
    render(<Harness initial="dark" />);
    fireEvent.click(screen.getByRole("radio", { name: /Clair/ }));
    // Attribut appliqué sur l'élément racine (effet).
    expect(screen.getByTestId("root").getAttribute("data-crm-theme")).toBe("light");
    // Persistance cookie.
    expect(document.cookie).toContain("crm-theme=light");
    expect((screen.getByRole("radio", { name: /Clair/ }) as HTMLInputElement).checked).toBe(true);
  });

  it("« Système » est sélectionnable et annonce l'état résolu", () => {
    render(<Harness initial="dark" />);
    fireEvent.click(screen.getByRole("radio", { name: /Système/ }));
    expect(document.cookie).toContain("crm-theme=system");
    // En jsdom sans matchMedia, le système résout en sombre.
    expect(screen.getByText(/Actuellement/)).toBeTruthy();
  });
});

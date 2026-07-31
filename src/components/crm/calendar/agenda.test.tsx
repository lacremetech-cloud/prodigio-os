// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Agenda } from "./agenda";
import type { AgendaEvent } from "@/modules/calendar/agenda";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/modules/calendar/actions", () => ({
  rescheduleAppointmentAction: vi.fn(async () => ({ ok: true })),
  cancelAppointmentAction: vi.fn(async () => ({ ok: true })),
}));

function evt(over: Partial<AgendaEvent> = {}): AgendaEvent {
  return {
    id: over.id ?? "a1",
    opportunityId: over.opportunityId ?? "opp-9",
    agentUserId: over.agentUserId ?? "agent-1",
    agentName: over.agentName ?? "Agent Un",
    contactLabel: over.contactLabel ?? "Marie Dupont",
    city: over.city ?? "Annecy",
    address: over.address ?? "3 rue du Lac",
    ownerPhone: over.ownerPhone ?? "+33612345678",
    ownerEmail: over.ownerEmail ?? "marie@example.com",
    startsAt: over.startsAt ?? "2026-07-15T12:00:00.000Z",
    endsAt: over.endsAt ?? "2026-07-15T13:30:00.000Z",
    timezone: over.timezone ?? "Europe/Paris",
    status: over.status ?? "planifie",
    googleHtmlLink: over.googleHtmlLink ?? null,
    kind: "estimation",
  };
}

const NOW = "2026-07-15T09:00:00.000Z";

afterEach(() => cleanup());

describe("Agenda", () => {
  it("affiche un événement en vue semaine (heure locale Paris)", () => {
    render(<Agenda events={[evt()]} nowIso={NOW} canViewContacts canManage />);
    // 12:00 UTC → 14:00 Europe/Paris.
    expect(screen.getAllByText(/14:00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Marie Dupont/).length).toBeGreaterThan(0);
  });

  it("ouvre le panneau de détail au clic et propose d'ouvrir le dossier", () => {
    render(<Agenda events={[evt()]} nowIso={NOW} canViewContacts canManage />);
    fireEvent.click(screen.getAllByText(/Marie Dupont/)[0]!);
    const link = screen.getByText("Ouvrir le dossier").closest("a");
    expect(link?.getAttribute("href")).toBe("/crm/mandats/opp-9");
  });

  it("masque les coordonnées quand le rôle ne les autorise pas", () => {
    render(<Agenda events={[evt()]} nowIso={NOW} canViewContacts={false} canManage={false} />);
    fireEvent.click(screen.getAllByText(/Marie Dupont/)[0]!);
    expect(screen.getAllByText("•••• masqué").length).toBeGreaterThan(0);
    expect(screen.queryByText("marie@example.com")).toBeNull();
  });

  it("bascule sur la vue liste et affiche l'événement", () => {
    render(<Agenda events={[evt()]} nowIso={NOW} canViewContacts canManage />);
    fireEvent.click(screen.getByRole("tab", { name: "Liste" }));
    expect(screen.getAllByText(/Marie Dupont/).length).toBeGreaterThan(0);
  });

  it("filtre par recherche (ville) sans erreur", () => {
    render(
      <Agenda
        events={[evt({ id: "a", contactLabel: "Marie", city: "Annecy" }), evt({ id: "b", contactLabel: "Paul", city: "Chamonix" })]}
        nowIso={NOW}
        canViewContacts
        canManage
      />,
    );
    fireEvent.change(screen.getByLabelText("Rechercher un rendez-vous"), { target: { value: "chamonix" } });
    expect(screen.queryByText("Marie")).toBeNull();
    expect(screen.getAllByText(/Paul/).length).toBeGreaterThan(0);
  });
});

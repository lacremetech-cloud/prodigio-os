import { afterEach, describe, expect, it, vi } from "vitest";
import { GoogleApiError } from "./google/errors";

// --- État mockable partagé (hoisté pour vi.mock) -----------------------------
const state = vi.hoisted(() => ({
  rpc: {} as Record<string, { data: unknown; error: unknown }>,
  single: {} as Record<string, unknown>,
  user: { id: "user-1" } as { id: string } | null,
  insertBehavior: "ok" as "ok" | "throw",
  rpcCalls: [] as string[],
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    rpc: async (name: string) => {
      state.rpcCalls.push(name);
      return state.rpc[name] ?? { data: null, error: null };
    },
    from: (table: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        maybeSingle: async () => ({ data: state.single[table] ?? null, error: null }),
      };
      return builder;
    },
    auth: { getUser: async () => ({ data: { user: state.user } }) },
  }),
}));

vi.mock("./google/credentials", () => ({
  getFreshAccessToken: vi.fn(async () => "token"),
  CalendarReconnectRequiredError: class CalendarReconnectRequiredError extends Error {},
}));

const insertEvent = vi.fn(async () => ({ id: "evt-1", htmlLink: "https://cal/evt-1" }));
vi.mock("./google/client", () => ({
  queryFreeBusy: vi.fn(async () => []),
  insertEvent: (...args: unknown[]) => {
    if (state.insertBehavior === "throw") throw new GoogleApiError("refus", 403, "forbidden");
    return insertEvent(...(args as []));
  },
  deleteEvent: vi.fn(async () => undefined),
  patchEvent: vi.fn(async () => ({ id: "evt-1", htmlLink: null })),
}));

// Évite l'import de `next/server` (after) : on injecte onAlert dans les tests.
vi.mock("./notifications/schedule", () => ({ scheduleEstimationAlert: vi.fn() }));

import { bookEstimation, cancelEstimation, rescheduleEstimation } from "./booking";

const CONNECTED = {
  id: "conn-1",
  status: "connecte",
  google_calendar_id: "primary",
  user_id: "agent-1",
};

const bookInput = {
  idempotencyKey: "idem-abc-123",
  opportunityId: "11111111-1111-1111-1111-111111111111",
  agentUserId: "22222222-2222-2222-2222-222222222222",
  startsAt: "2026-08-05T12:00:00.000Z",
  endsAt: "2026-08-05T13:30:00.000Z",
  timezone: "Europe/Paris",
  address: "3 rue du Lac",
  city: "Annecy",
  ownerContactId: null,
  ownerEmail: "marie@example.com",
  ownerName: "Marie Dupont",
  notes: null,
};

afterEach(() => {
  state.rpc = {};
  state.single = {};
  state.user = { id: "user-1" };
  state.insertBehavior = "ok";
  state.rpcCalls = [];
  vi.clearAllMocks();
});

describe("bookEstimation — alerte « planifié »", () => {
  it("création réussie → UNE alerte created", async () => {
    state.rpc.crm_reserve_estimation_appointment = {
      data: { id: "appt-1", created: true, google_event_id: null },
      error: null,
    };
    state.rpc.crm_confirm_estimation_appointment = { data: { ok: true }, error: null };
    state.single.calendar_connections = CONNECTED;

    const onAlert = vi.fn();
    const res = await bookEstimation(bookInput, { onAlert });
    expect(res.ok).toBe(true);
    expect(onAlert).toHaveBeenCalledTimes(1);
    expect(onAlert.mock.calls[0]?.[0]).toMatchObject({ kind: "created", appointmentId: "appt-1" });
  });

  it("double-clic / même clé (rejeu idempotent) → AUCUNE alerte", async () => {
    // reserve renvoie created=false (ligne déjà existante, événement déjà rattaché).
    state.rpc.crm_reserve_estimation_appointment = {
      data: { id: "appt-1", created: false, google_event_id: "evt-1" },
      error: null,
    };
    const onAlert = vi.fn();
    const res = await bookEstimation(bookInput, { onAlert });
    expect(res.ok).toBe(true);
    expect(res.alreadyBooked).toBe(true);
    expect(onAlert).not.toHaveBeenCalled();
  });

  it("réservation en cours (rejeu concurrent) → AUCUNE alerte", async () => {
    state.rpc.crm_reserve_estimation_appointment = {
      data: { id: "appt-1", created: false, google_event_id: null },
      error: null,
    };
    const onAlert = vi.fn();
    const res = await bookEstimation(bookInput, { onAlert });
    expect(res.processing).toBe(true);
    expect(onAlert).not.toHaveBeenCalled();
  });

  it("écriture CRM (réservation) échouée → AUCUNE alerte", async () => {
    state.rpc.crm_reserve_estimation_appointment = {
      data: null,
      error: { code: "42501", message: "droits" },
    };
    const onAlert = vi.fn();
    const res = await bookEstimation(bookInput, { onAlert });
    expect(res.ok).toBe(false);
    expect(onAlert).not.toHaveBeenCalled();
  });

  it("création Google échouée (compensation) → AUCUNE alerte", async () => {
    state.rpc.crm_reserve_estimation_appointment = {
      data: { id: "appt-1", created: true, google_event_id: null },
      error: null,
    };
    state.single.calendar_connections = CONNECTED;
    state.insertBehavior = "throw";

    const onAlert = vi.fn();
    const res = await bookEstimation(bookInput, { onAlert });
    expect(res.ok).toBe(false);
    expect(res.code).toBe("google_failed");
    expect(onAlert).not.toHaveBeenCalled();
    // Compensation appelée (abandon de la réservation).
    expect(state.rpcCalls).toContain("crm_discard_pending_appointment");
  });

  it("confirmation CRM échouée APRÈS Google (compensation) → AUCUNE alerte", async () => {
    state.rpc.crm_reserve_estimation_appointment = {
      data: { id: "appt-1", created: true, google_event_id: null },
      error: null,
    };
    state.rpc.crm_confirm_estimation_appointment = {
      data: null,
      error: { code: "22023", message: "conflit" },
    };
    state.single.calendar_connections = CONNECTED;

    const onAlert = vi.fn();
    const res = await bookEstimation(bookInput, { onAlert });
    expect(res.ok).toBe(false);
    expect(onAlert).not.toHaveBeenCalled();
  });
});

describe("rescheduleEstimation — alerte « reporté »", () => {
  const APPT = {
    id: "appt-1",
    starts_at: "2026-08-05T09:00:00.000Z",
    ends_at: "2026-08-05T10:30:00.000Z",
    agent_user_id: "agent-1",
    google_event_id: "evt-1",
    google_calendar_id: "primary",
    timezone: "Europe/Paris",
    address: null,
    owner_name: null,
    owner_email: null,
    status: "planifie",
  };

  it("report réel → UNE alerte avec ancien et nouveau créneau", async () => {
    state.single.estimation_appointments = APPT;
    state.single.calendar_connections = CONNECTED;
    state.rpc.crm_reschedule_estimation_appointment = { data: { ok: true }, error: null };

    const onAlert = vi.fn();
    const res = await rescheduleEstimation(
      "appt-1",
      "2026-08-06T09:00:00.000Z",
      "2026-08-06T10:30:00.000Z",
      { onAlert },
    );
    expect(res.ok).toBe(true);
    expect(onAlert).toHaveBeenCalledTimes(1);
    expect(onAlert.mock.calls[0]?.[0]).toMatchObject({
      kind: "rescheduled",
      oldStartsAt: "2026-08-05T09:00:00.000Z",
      oldEndsAt: "2026-08-05T10:30:00.000Z",
    });
  });

  it("report sans changement d'horaire → AUCUNE alerte", async () => {
    state.single.estimation_appointments = APPT;
    state.single.calendar_connections = CONNECTED;
    state.rpc.crm_reschedule_estimation_appointment = { data: { ok: true }, error: null };

    const onAlert = vi.fn();
    const res = await rescheduleEstimation(
      "appt-1",
      APPT.starts_at,
      APPT.ends_at,
      { onAlert },
    );
    expect(res.ok).toBe(true);
    expect(onAlert).not.toHaveBeenCalled();
  });
});

describe("cancelEstimation — alerte « annulé »", () => {
  it("annulation réelle → UNE alerte", async () => {
    state.single.estimation_appointments = {
      id: "appt-1",
      status: "planifie",
      agent_user_id: "agent-1",
      google_event_id: "evt-1",
      google_calendar_id: "primary",
    };
    state.single.calendar_connections = CONNECTED;
    state.rpc.crm_cancel_estimation_appointment = { data: { ok: true }, error: null };

    const onAlert = vi.fn();
    const res = await cancelEstimation("appt-1", "Propriétaire indisponible", { onAlert });
    expect(res.ok).toBe(true);
    expect(onAlert).toHaveBeenCalledTimes(1);
    expect(onAlert.mock.calls[0]?.[0]).toMatchObject({ kind: "cancelled" });
  });

  it("seconde annulation identique (déjà annulé) → AUCUNE alerte", async () => {
    state.single.estimation_appointments = {
      id: "appt-1",
      status: "annule",
      agent_user_id: "agent-1",
      google_event_id: null,
    };
    state.rpc.crm_cancel_estimation_appointment = { data: { ok: true }, error: null };

    const onAlert = vi.fn();
    const res = await cancelEstimation("appt-1", null, { onAlert });
    expect(res.ok).toBe(true);
    expect(onAlert).not.toHaveBeenCalled();
  });
});

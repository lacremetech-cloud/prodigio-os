import { describe, expect, it, vi } from "vitest";
import {
  emitEstimationAppointmentCreated,
  onEstimationAppointmentCreated,
  type EstimationAppointmentCreatedEvent,
} from "./events";

const sample: EstimationAppointmentCreatedEvent = {
  appointmentId: "a1",
  opportunityId: "o1",
  agentUserId: "u1",
  startsAt: "2026-08-05T12:00:00Z",
  endsAt: "2026-08-05T13:30:00Z",
  timezone: "Europe/Paris",
  city: "Lyon",
  ownerName: "M. Test",
  ownerInvited: true,
};

describe("seam d'événement estimation_appointment_created", () => {
  it("appelle les gestionnaires enregistrés (extension future SMS/WhatsApp/Slack)", async () => {
    const handler = vi.fn();
    onEstimationAppointmentCreated(handler);
    await emitEstimationAppointmentCreated(sample);
    expect(handler).toHaveBeenCalledWith(sample);
    // Ne transporte jamais l'e-mail en clair : seulement un booléen d'invitation.
    expect(sample).not.toHaveProperty("ownerEmail");
  });

  it("un gestionnaire défaillant ne fait jamais échouer l'émission (non bloquant)", async () => {
    onEstimationAppointmentCreated(() => {
      throw new Error("boom");
    });
    await expect(emitEstimationAppointmentCreated(sample)).resolves.toBeUndefined();
  });
});

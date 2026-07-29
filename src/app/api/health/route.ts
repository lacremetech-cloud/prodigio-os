import { NextResponse } from "next/server";
import { site } from "@/lib/site";

/**
 * Sonde de disponibilité. Ne dépend d'aucun service externe : renvoie un état
 * statique tant que la base et les intégrations ne sont pas connectées.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: site.service,
  });
}

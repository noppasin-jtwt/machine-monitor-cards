import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  machine_id: z.number().int().min(1),
  plc: z.number().int().min(0).max(1),
  bolt: z.number().int().min(0).max(1),
  cylinder: z.number().int().min(0).max(1),
  emergency: z.number().int().min(0).max(1),
  rssi: z.number().optional(),
  snr: z.number().optional(),
  line: z.string().max(60).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/machine-status")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["MACHINE_INGEST_KEY"];
        const provided = request.headers.get("x-api-key");
        if (!expected || provided !== expected) {
          return json({ error: "Unauthorized" }, 401);
        }

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        const parsed = payloadSchema.safeParse(raw);
        if (!parsed.success) {
          return json({ error: "Invalid payload", details: parsed.error.issues }, 400);
        }
        const data = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client");

        const { data: existing, error: readError } = await supabaseAdmin
          .from("machines")
          .select("id, name, plc, bolt, cylinder, emergency")
          .eq("id", data.machine_id)
          .maybeSingle();

        if (readError) return json({ error: readError.message }, 500);
        if (!existing) return json({ error: "Unknown machine_id" }, 404);

        const { error: updateError } = await supabaseAdmin
          .from("machines")
          .update({
            plc: data.plc,
            bolt: data.bolt,
            cylinder: data.cylinder,
            emergency: data.emergency,
            ...(data.rssi !== undefined && { rssi: data.rssi }),
            ...(data.snr !== undefined && { snr: data.snr }),
            ...(data.line !== undefined && { line: data.line }),
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.machine_id);

        if (updateError) return json({ error: updateError.message }, 500);

        const wasAlarm =
          existing.plc === 0 ||
          existing.bolt === 1 ||
          existing.cylinder === 1 ||
          existing.emergency === 1;
        const faults: string[] = [];
        if (data.plc === 0) faults.push("PLC signal lost");
        if (data.bolt === 1) faults.push("Bolt fault detected");
        if (data.cylinder === 1) faults.push("Cylinder fault detected");
        if (data.emergency === 1) faults.push("Emergency stop pressed");

        if (faults.length > 0 && !wasAlarm) {
          await supabaseAdmin.from("machine_alarms").insert({
            machine_id: data.machine_id,
            message: `${existing.name}: ${faults.join(", ")}`,
          });
        }

        return json({ ok: true, machine_id: data.machine_id, alarm: faults.length > 0 });
      },
    },
  },
});

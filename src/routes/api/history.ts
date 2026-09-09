import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/history")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const limit = Math.min(Number(url.searchParams.get("limit")) || 500, 2000);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const db = supabaseAdmin as unknown as {
          from: (table: string) => ReturnType<typeof supabaseAdmin.from>;
        };

        const { data, error } = await (db
          .from("machine_logs") as unknown as {
          select: (cols: string) => {
            order: (
              col: string,
              opts: { ascending: boolean },
            ) => { limit: (n: number) => Promise<{ data: LogRow[] | null; error: { message: string } | null }> };
          };
        })
          .select("machine_no, machine_name, event, plc, emergency, auto, rssi, snr, created_at")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        const rows = (data ?? []).map((row) => ({
          timestamp: row.created_at,
          machine_no: String(row.machine_no),
          machine_name: row.machine_name,
          event: row.event,
          plc: String(row.plc),
          emergency: String(row.emergency),
          auto: String(row.auto),
          rssi: row.rssi === null ? "" : String(row.rssi),
          snr: row.snr === null ? "" : String(row.snr),
        }));

        return Response.json(rows);
      },
    },
  },
});

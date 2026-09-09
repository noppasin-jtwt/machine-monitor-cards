CREATE TABLE public.machine_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  machine_no integer NOT NULL,
  machine_name text NOT NULL,
  event text NOT NULL,
  plc integer NOT NULL DEFAULT 1,
  emergency integer NOT NULL DEFAULT 0,
  auto integer NOT NULL DEFAULT 0,
  rssi numeric,
  snr numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.machine_logs TO anon;
GRANT SELECT ON public.machine_logs TO authenticated;
GRANT ALL ON public.machine_logs TO service_role;

ALTER TABLE public.machine_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read machine logs" ON public.machine_logs FOR SELECT TO anon, authenticated USING (true);

CREATE INDEX machine_logs_created_at_idx ON public.machine_logs (created_at DESC);

INSERT INTO public.machine_logs (machine_no, machine_name, event, plc, emergency, auto, rssi, snr, created_at) VALUES
  (1, 'Supply Bolt HS/FW [SL]', 'HEARTBEAT', 1, 0, 1, -60, 11.2, now() - interval '2 minutes'),
  (2, 'Supply Bolt RH [SL]', 'AUTO_MODE', 1, 0, 1, -58, 10.8, now() - interval '9 minutes'),
  (4, 'Front Axle Assembly', 'PLC_ON', 1, 0, 0, -62, 9.4, now() - interval '25 minutes'),
  (3, 'Supply Bolt LH [SL]', 'EMERGENCY_OFF', 1, 0, 0, -55, 12.1, now() - interval '41 minutes'),
  (3, 'Supply Bolt LH [SL]', 'EMERGENCY_ON', 1, 1, 0, -55, 12.0, now() - interval '47 minutes'),
  (7, 'Brake Inspection', 'MANUAL_MODE', 1, 0, 0, -64, 8.9, now() - interval '1 hour'),
  (9, 'Final Inspection', 'PLC_OFF', 0, 0, 0, -70, 6.2, now() - interval '2 hours');
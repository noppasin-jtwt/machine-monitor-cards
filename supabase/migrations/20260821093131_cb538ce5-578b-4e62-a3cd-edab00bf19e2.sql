CREATE TABLE public.machines (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  plc SMALLINT NOT NULL DEFAULT 1,
  bolt SMALLINT NOT NULL DEFAULT 0,
  cylinder SMALLINT NOT NULL DEFAULT 0,
  emergency SMALLINT NOT NULL DEFAULT 0,
  rssi NUMERIC,
  snr NUMERIC,
  line TEXT NOT NULL DEFAULT 'Main Line',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.machine_alarms (
  id BIGSERIAL PRIMARY KEY,
  machine_id INTEGER NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX machine_alarms_created_at_idx ON public.machine_alarms (created_at DESC);

GRANT SELECT ON public.machines TO anon, authenticated;
GRANT ALL ON public.machines TO service_role;
GRANT SELECT ON public.machine_alarms TO anon, authenticated;
GRANT ALL ON public.machine_alarms TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.machine_alarms_id_seq TO service_role;

ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_alarms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Machines are publicly viewable" ON public.machines FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Alarms are publicly viewable" ON public.machine_alarms FOR SELECT TO anon, authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.machines;
ALTER PUBLICATION supabase_realtime ADD TABLE public.machine_alarms;

INSERT INTO public.machines (id, name, plc, bolt, cylinder, emergency, rssi, snr, line, updated_at) VALUES
 (1, 'Machine 1', 1, 0, 0, 0, -62, 9.5, 'Main Line', now()),
 (2, 'Machine 2', 1, 0, 0, 0, -58, 10.2, 'Main Line', now()),
 (3, 'Machine 3', 0, 0, 0, 0, -75, 5.1, 'Main Line', now()),
 (4, 'Machine 4', 1, 0, 0, 0, -66, 8.8, 'Main Line', now()),
 (5, 'Machine 5', 1, 0, 0, 0, -61, 9.9, 'Main Line', now()),
 (6, 'Machine 6', 1, 1, 0, 0, -71, 6.4, 'Main Line', now()),
 (7, 'Machine 7', 1, 0, 0, 0, -59, 11.0, 'Main Line', now()),
 (8, 'Machine 8', 1, 0, 0, 0, -64, 9.1, 'Main Line', now()),
 (9, 'Machine 9', 1, 0, 1, 0, -78, 4.2, 'Main Line', now());

INSERT INTO public.machine_alarms (machine_id, message, created_at) VALUES
 (3, 'Machine 3: PLC signal lost', now() - interval '4 minutes'),
 (6, 'Machine 6: Bolt fault detected', now() - interval '2 minutes'),
 (9, 'Machine 9: Cylinder fault detected', now() - interval '30 seconds');
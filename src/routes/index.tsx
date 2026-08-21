import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Machine Calling System" },
      { name: "description", content: "Real-time machine status monitoring dashboard" },
      { property: "og:title", content: "Machine Calling System" },
      { property: "og:description", content: "Real-time machine status monitoring dashboard" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const navItems = [
  "History",
  "Graph",
  "Sub Line",
  "Main Line",
  "Test Run",
  "Before Paint",
  "Painting",
  "OEM",
];

const OFFLINE_AFTER_MS = 30_000;

type Machine = {
  id: number;
  name: string;
  plc: number;
  bolt: number;
  cylinder: number;
  emergency: number;
  rssi: number | null;
  snr: number | null;
  line: string;
  updated_at: string;
};

type Alarm = {
  id: number;
  machine_id: number;
  message: string;
  created_at: string;
};

type Status = "normal" | "alarm" | "offline";

function getStatus(machine: Machine, now: number): Status {
  if (now - new Date(machine.updated_at).getTime() > OFFLINE_AFTER_MS) return "offline";
  if (machine.plc === 0 || machine.bolt === 1 || machine.cylinder === 1 || machine.emergency === 1) {
    return "alarm";
  }
  return "normal";
}

const statusLabel: Record<Status, string> = {
  normal: "Normal",
  alarm: "Alarm",
  offline: "Offline",
};

const statusClass: Record<Status, string> = {
  normal: "bg-running text-running-foreground hover:bg-running/90",
  alarm: "bg-alert text-alert-foreground hover:bg-alert/90",
  offline: "bg-offline text-offline-foreground hover:bg-offline/90",
};

function Index() {
  const [activeNav, setActiveNav] = useState("Main Line");
  const [machines, setMachines] = useState<Machine[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);

  // Ticks the clock so offline (>30s without an update) is evaluated live.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [machineResult, alarmResult] = await Promise.all([
        supabase.from("machines").select("*").order("id"),
        supabase
          .from("machine_alarms")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (cancelled) return;
      if (machineResult.data) setMachines(machineResult.data as Machine[]);
      if (alarmResult.data) setAlarms(alarmResult.data as Alarm[]);
      setLoading(false);
    }

    void load();

    const channel = supabase
      .channel("machine-monitor")
      .on("postgres_changes", { event: "*", schema: "public", table: "machines" }, (payload) => {
        const row = payload.new as Machine;
        if (!row?.id) return;
        setMachines((prev) => {
          const next = prev.some((m) => m.id === row.id)
            ? prev.map((m) => (m.id === row.id ? row : m))
            : [...prev, row];
          return next.sort((a, b) => a.id - b.id);
        });
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "machine_alarms" },
        (payload) => {
          const row = payload.new as Alarm;
          setAlarms((prev) => [row, ...prev].slice(0, 20));
        },
      )
      .subscribe();

    // Safety net if realtime drops: refresh every 15s.
    const poll = window.setInterval(() => void load(), 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, []);

  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === selected) ?? null,
    [machines, selected],
  );

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Sidebar — becomes a horizontal scrollable nav on mobile */}
      <aside className="shrink-0 bg-panel lg:h-screen lg:w-64 lg:overflow-y-auto">
        <div className="flex items-center gap-2 p-4 lg:p-6">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-nav text-nav-foreground">
            <span className="text-sm font-bold">M</span>
          </div>
          <span className="hidden text-lg font-bold text-panel-foreground lg:block">MCS</span>
        </div>

        <nav
          className="flex gap-2 overflow-x-auto px-4 pb-3 lg:flex-col lg:gap-3 lg:px-4 lg:pb-6"
          aria-label="Machine lines"
        >
          {navItems.map((item) => (
            <button
              key={item}
              onClick={() => setActiveNav(item)}
              className={`shrink-0 rounded-md px-4 py-2.5 text-sm font-medium transition-colors lg:w-full lg:text-base ${
                activeNav === item
                  ? "bg-nav text-nav-foreground"
                  : "bg-background text-foreground hover:bg-muted"
              } ${item === "Graph" ? "mr-8 lg:mr-0 lg:mb-8" : ""}`}
              aria-current={activeNav === item ? "page" : undefined}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex min-w-0 flex-1 flex-col p-4 sm:p-6 lg:p-8">
        <header className="mb-6 text-center lg:mb-8">
          <h1 className="text-2xl font-black tracking-tight text-foreground sm:text-3xl lg:text-4xl">
            Machine Calling System
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live production floor status · updates streamed from the line
          </p>
        </header>

        <section
          className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5"
          aria-label="Machine status cards"
        >
          {loading && machines.length === 0
            ? Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
              ))
            : machines.map((machine) => {
                const status = getStatus(machine, now);
                return (
                  <button
                    key={machine.id}
                    onClick={() => setSelected(machine.id)}
                    className={`flex aspect-square flex-col items-center justify-center rounded-xl p-4 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${statusClass[status]}`}
                    aria-label={`${machine.name}, status ${statusLabel[status]}`}
                  >
                    <span className="text-xl font-bold sm:text-2xl">{machine.name}</span>
                    <span className="mt-2 inline-flex items-center rounded-full bg-black/10 px-2.5 py-0.5 text-xs font-medium">
                      {statusLabel[status]}
                    </span>
                  </button>
                );
              })}
        </section>

        {/* Alarm history */}
        <section className="mt-6 rounded-xl bg-panel p-4 lg:mt-8 lg:p-6">
          <h2 className="mb-3 text-sm font-semibold text-panel-foreground">Alert Message</h2>
          <div className="max-h-56 min-h-[7rem] overflow-y-auto rounded-lg bg-background p-3">
            {alarms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No alarms recorded.</p>
            ) : (
              <ul className="space-y-2">
                {alarms.map((alarm) => (
                  <li
                    key={alarm.id}
                    className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2 text-sm last:border-0 last:pb-0"
                  >
                    <span className="font-medium text-foreground">{alarm.message}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(alarm.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </main>

      {selectedMachine && (
        <MachineDialog
          machine={selectedMachine}
          status={getStatus(selectedMachine, now)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function MachineDialog({
  machine,
  status,
  onClose,
}: {
  machine: Machine;
  status: Status;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows: Array<[string, string]> = [
    ["PLC Status", machine.plc === 1 ? "OK (1)" : "Lost (0)"],
    ["Bolt Status", machine.bolt === 1 ? "Fault (1)" : "Normal (0)"],
    ["Cylinder Status", machine.cylinder === 1 ? "Fault (1)" : "Normal (0)"],
    ["Emergency", machine.emergency === 1 ? "Pressed (1)" : "Clear (0)"],
    ["RSSI", machine.rssi === null ? "—" : `${machine.rssi} dBm`],
    ["SNR", machine.snr === null ? "—" : `${machine.snr} dB`],
    ["Line", machine.line],
    ["Last update", new Date(machine.updated_at).toLocaleString()],
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${machine.name} details`}
        className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-card-foreground">{machine.name}</h2>
            <span
              className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass[status]}`}
            >
              {statusLabel[status]}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
            aria-label="Close details"
          >
            ✕
          </button>
        </div>

        <dl className="divide-y divide-border">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 py-2 text-sm">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium text-card-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

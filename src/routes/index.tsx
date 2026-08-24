import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Machine Calling System — Andon Board" },
      {
        name: "description",
        content:
          "Real-time production monitoring and Andon alert board for factory machine status.",
      },
      { property: "og:title", content: "Machine Calling System — Andon Board" },
      {
        property: "og:description",
        content:
          "Real-time production monitoring and Andon alert board for factory machine status.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const navItems = ["Main", "History", "Graph"] as const;

const MACHINE_NAMES: Record<number, string> = {
  1: "Supply Bolt HS/FW [SL]",
  2: "Supply Bolt RH [SL]",
  3: "Supply Bolt LH [SL]",
  4: "Front Axle Assembly",
  5: "Rear Axle Assembly",
  6: "Engine Mount Assembly",
  7: "Brake Inspection",
  8: "Paint Inspection",
  9: "Final Inspection",
};

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

type Status = "normal" | "alarm" | "offline";

function machineName(machine: Machine) {
  return MACHINE_NAMES[machine.id] ?? machine.name;
}

function getStatus(machine: Machine, now: number): Status {
  if (now - new Date(machine.updated_at).getTime() > OFFLINE_AFTER_MS) return "offline";
  if (machine.plc === 0 || machine.bolt === 1 || machine.cylinder === 1 || machine.emergency === 1) {
    return "alarm";
  }
  return "normal";
}

function alarmReasons(machine: Machine, status: Status): string[] {
  if (status === "offline") return ["Communication Lost"];
  const reasons: string[] = [];
  if (machine.plc === 0) reasons.push("PLC Offline");
  if (machine.bolt === 1) reasons.push("Bolt Alarm");
  if (machine.cylinder === 1) reasons.push("Cylinder Alarm");
  if (machine.emergency === 1) reasons.push("Emergency ON");
  return reasons;
}

const cardClass: Record<Status, string> = {
  normal: "bg-running text-running-foreground",
  alarm: "bg-alert text-alert-foreground",
  offline: "bg-offline text-offline-foreground",
};

function Index() {
  const [activeNav, setActiveNav] = useState<string>("Main");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase.from("machines").select("*").order("id");
      if (cancelled) return;
      if (data) setMachines(data as Machine[]);
      setLoading(false);
    }

    void load();

    const channel = supabase
      .channel("machine-monitor")
      .on("postgres_changes", { event: "*", schema: "public", table: "machines" }, (payload) => {
        const row = payload.new as Machine;
        if (!row?.id) return;
        setMachines((prev) =>
          (prev.some((m) => m.id === row.id)
            ? prev.map((m) => (m.id === row.id ? row : m))
            : [...prev, row]
          ).sort((a, b) => a.id - b.id),
        );
      })
      .subscribe();

    const poll = window.setInterval(() => void load(), 15_000);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, []);

  const activeAlarms = useMemo(
    () =>
      machines.flatMap((machine) => {
        const status = getStatus(machine, now);
        if (status === "normal") return [];
        return alarmReasons(machine, status).map((reason) => ({
          key: `${machine.id}-${reason}`,
          label: `${machineName(machine)} : ${reason}`,
        }));
      }),
    [machines, now],
  );

  const selectedMachine = useMemo(
    () => machines.find((m) => m.id === selected) ?? null,
    [machines, selected],
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-5 shadow-sm sm:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted lg:hidden"
            aria-expanded={sidebarOpen}
            aria-label="Toggle navigation"
          >
            ☰
          </button>
          <div className="flex-1 text-center">
            <h1 className="text-2xl font-black uppercase tracking-tight text-foreground sm:text-3xl lg:text-4xl">
              Machine Calling System
            </h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground sm:text-sm">
              Real-Time Production Monitoring
            </p>
          </div>
          <div className="w-10 lg:hidden" aria-hidden />
        </div>
      </header>

      <div className="flex flex-col lg:flex-row">
        {/* Sidebar */}
        <aside
          className={`shrink-0 bg-panel p-4 lg:block lg:w-[220px] lg:min-h-[calc(100vh-105px)] ${
            sidebarOpen ? "block" : "hidden"
          }`}
        >
          <nav className="flex flex-col gap-3" aria-label="Sections">
            {navItems.map((item) => (
              <button
                key={item}
                onClick={() => {
                  setActiveNav(item);
                  setSidebarOpen(false);
                }}
                className={`w-full rounded-xl px-4 py-3 text-left text-base font-semibold shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                  activeNav === item
                    ? "bg-nav text-nav-foreground"
                    : "bg-card text-foreground hover:bg-muted"
                }`}
                aria-current={activeNav === item ? "page" : undefined}
              >
                {item}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {activeNav === "Main" ? (
            <section
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
              aria-label="Machine status cards"
            >
              {loading && machines.length === 0
                ? Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="h-40 animate-pulse rounded-2xl bg-muted" />
                  ))
                : machines.map((machine) => {
                    const status = getStatus(machine, now);
                    return (
                      <button
                        key={machine.id}
                        onClick={() => setSelected(machine.id)}
                        className={`flex h-40 items-center justify-center rounded-2xl p-6 text-center shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${cardClass[status]}`}
                      >
                        <span className="text-xl font-bold leading-snug sm:text-2xl">
                          {machineName(machine)}
                        </span>
                      </button>
                    );
                  })}
            </section>
          ) : (
            <section className="rounded-2xl bg-card p-10 text-center shadow-sm">
              <h2 className="text-xl font-bold text-card-foreground">{activeNav}</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                This section is coming soon. Machine data keeps streaming in the background.
              </p>
            </section>
          )}

          {/* Alarm panel */}
          <section className="mt-6 rounded-2xl bg-panel p-5 shadow-sm lg:mt-8">
            <h2 className="mb-3 text-base font-bold uppercase tracking-wide text-panel-foreground">
              Active Alarm List
            </h2>
            <div className="max-h-56 min-h-[6rem] overflow-y-auto rounded-xl bg-card p-4">
              {activeAlarms.length === 0 ? (
                <p className="text-sm font-medium text-muted-foreground">No Active Alarm</p>
              ) : (
                <ul className="space-y-2">
                  {activeAlarms.map((alarm) => (
                    <li
                      key={alarm.key}
                      className="border-b border-border pb-2 text-sm font-semibold text-alert last:border-0 last:pb-0"
                    >
                      {alarm.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </main>
      </div>

      {/* Floating alarm popup */}
      {activeAlarms.length > 0 && (
        <div
          role="alert"
          className="fixed right-4 top-4 z-[100] w-[min(22rem,calc(100vw-2rem))] rounded-2xl bg-alert p-4 text-alert-foreground shadow-2xl"
        >
          <div className="flex items-center gap-2">
            <span className="animate-siren text-2xl" aria-hidden>
              🚨
            </span>
            <h2 className="text-sm font-black uppercase tracking-wide">Active Machine Alarm</h2>
          </div>
          <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto text-sm font-medium">
            {activeAlarms.map((alarm) => (
              <li key={alarm.key}>{alarm.label}</li>
            ))}
          </ul>
        </div>
      )}

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
        aria-label={`${machineName(machine)} details`}
        className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-card-foreground">{machineName(machine)}</h2>
            <span
              className={`mt-1 inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${cardClass[status]}`}
            >
              {status === "normal" ? "Running" : status === "alarm" ? "Alarm" : "Offline"}
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

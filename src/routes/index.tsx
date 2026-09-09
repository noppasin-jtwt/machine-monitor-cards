import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getMachines } from "../services/api";
import { MACHINE_NAMES } from "../configs/machine";
import { HistoryView } from "@/components/HistoryView";


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

// const MACHINE_NAMES: Record<number, string> = {
//   1: "Supply Bolt Piston [ML]",
//   2: "Supply Bolt HS/FW [SL]",
//   3: "Supply Head Cover [ML]",
//   4: "FW CiRA CORE [SL]"
// };

const OFFLINE_AFTER_MS = 30_000;

type Machine = {
  machine_no: number;
  PLC: number;
  Emergency: number;
  Auto: number;
  last_update: string;
};

type Status =
  | "online"
  | "offline"
  | "manual"
  | "abnormal";

const statusText: Record<Status, string> = {
  online: "Machine Online",
  offline: "Machine Offline",
  manual: "Manual Mode",
  abnormal: "Abnormal Alert",
};

const cardClass: Record<Status, string> = {
  online: "bg-green-500 text-white",

  offline: "bg-gray-500 text-white",

  manual: "bg-blue-900 text-white",

  abnormal: "bg-red-600 text-white",
};

function machineName(machine: Machine) {
  return (
    MACHINE_NAMES[machine.machine_no] ??
    `Unknown Machine (${machine.machine_no})`
  );
}

function getStatus(
  machine: Machine,
  now: number
): Status {

  // Communication timeout

    if (
      now -
        new Date(
          machine.last_update
        ).getTime() >
      OFFLINE_AFTER_MS
    ) {
      return "offline";
    }

    // PLC OFF

    if (machine.PLC === 0) {
      return "offline";
    }

    // Emergency

    if (machine.Emergency === 1) {
      return "abnormal";
    }

    // Manual mode

    if (machine.Auto === 1) {
      return "manual";
    }

    // Auto + PLC ON + No Emergency

    return "online";
}

function alarmReasons(
  machine: Machine,
  status: Status
): string[] {

  switch (status) {

    case "offline":
      return ["Machine Offline"];

    case "manual":
      return ["Manual Mode"];

    case "abnormal":
      return ["Abnormal Alert"];

    default:
      return [];
  }
}

function Index() {
  const [activeNav, setActiveNav] = useState<string>("Main");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [alarmHistory, setAlarmHistory] = useState<string[]>([]);
  const [previousAlarms, setPreviousAlarms] =
  useState<Set<string>>(new Set());

  useEffect(() => {

  const currentAlarms = new Set<string>();

  machines.forEach((machine) => {

    const status = getStatus(machine, now);

    if (
  status === "abnormal" ||
  status === "manual"
)  {

      alarmReasons(machine, status)
        .forEach((reason) => {

          const key =
            `${machine.machine_no}-${reason}`;

          currentAlarms.add(key);

          if (!previousAlarms.has(key)) {

            const timestamp =
              new Date().toLocaleString();

            setAlarmHistory(prev => [

              `[${timestamp}] ${machineName(machine)} : ${reason}`,

              ...prev,

            ]);
          }
        });
    }
  });

  previousAlarms.forEach((alarm) => {

    if (!currentAlarms.has(alarm)) {

      const machineNo =
        Number(alarm.split("-")[0]);

      const reason =
        alarm.substring(
          alarm.indexOf("-") + 1
        );

      const machine = machines.find(
        m => m.machine_no === machineNo
      );

      if (machine) {

        const timestamp =
          new Date().toLocaleString();

        let recoveryMessage = `${reason} Cleared`;

        if (reason === "Manual Mode") {
          recoveryMessage = "Auto Mode";
        }

        if (reason === "Abnormal Alert") {
          recoveryMessage = "Normally";
        }

        setAlarmHistory(prev => [

          `[${timestamp}] ${machineName(machine)} : ${recoveryMessage}`,

          ...prev,

        ]);
      }
    }
  });

  setPreviousAlarms(currentAlarms);

}, [machines, now]);

  useEffect(() => {

  const loadMachines = async () => {

    try {

      const data = await getMachines();

      setMachines(data);

      setLoading(false);

    } catch (error) {

      console.error(error);

    }

  };

    loadMachines();

    const timer = setInterval(
      loadMachines,
      1000
    );

    return () => clearInterval(timer);

  }, []);

  const activeAlarms = useMemo(
    () =>
      machines.flatMap((machine) => {
        const status = getStatus(machine, now);
        if (status === "online" || status === "offline") return [];
        return alarmReasons(machine, status).map((reason) => ({
          key: `${machine.machine_no}-${reason}`,
          label: `${machineName(machine)} : ${reason}`,
        }));
      }),
    [machines, now],
  );

  const selectedMachine = useMemo(
    () => machines.find((m) => m.machine_no === selected) ?? null,
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
                        key={machine.machine_no}
                        onClick={() => setSelected(machine.machine_no)}
                        className={`flex h-40 items-center justify-center rounded-2xl p-6 text-center shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${cardClass[status]}`}
                      >
                      <div className="flex flex-col items-center">

                        <span className="text-lg font-bold">
                          {machineName(machine)}
                        </span>

                        <span className="mt-3 rounded-lg bg-black/20 px-3 py-1 text-sm">
                          {statusText[status]}
                        </span>

                      </div>
                      </button>
                    );
                  })}
            </section>
          ) : activeNav === "History" ? (
            <HistoryView />
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
             {alarmHistory.length === 0 ? (

              <p className="text-sm text-muted-foreground">
                No Alarm History
              </p>

            ) : (

              <ul className="space-y-2">

                {alarmHistory.map((log, index) => (

                  <li
                    key={index}
                    className="border-b border-border pb-2 text-sm"
                  >
                    {log}
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

  [
    "Machine Status",
    machine.PLC === 1
      ? "Machine Online"
      : "Machine Offline"
  ],

];

// Only show Mode and Alarm when machine is online

if (status !== "offline") {

  rows.push(
    [
      "Operation Mode",
      machine.Auto === 0
        ? "Auto Mode"
        : "Manual Mode"
    ]
  );

  rows.push(
    [
      "Alarm Status",
      machine.Emergency === 1
        ? "Abnormal Alert"
        : "Normally"
    ]
  );

}

rows.push(
  [
    "Last Update",
    new Date(machine.last_update).toLocaleString()
  ]
);

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
              {statusText[status]}
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

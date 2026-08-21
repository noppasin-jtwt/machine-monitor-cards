import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

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

const machines = [
  { id: 1, name: "Machine 1", status: "running" as const },
  { id: 2, name: "Machine 2", status: "running" as const },
  { id: 3, name: "Machine 3", status: "alert" as const },
  { id: 4, name: "Machine 4", status: "running" as const },
  { id: 5, name: "Machine 5", status: "running" as const },
  { id: 6, name: "Machine 6", status: "alert" as const },
  { id: 7, name: "Machine 7", status: "running" as const },
  { id: 8, name: "Machine 8", status: "running" as const },
  { id: 9, name: "Machine 9", status: "alert" as const },
];

function Index() {
  const [activeNav, setActiveNav] = useState("Main Line");
  const [alertMessage, setAlertMessage] = useState("");

  return (
    <div className="flex min-h-screen flex-col bg-background lg:flex-row">
      {/* Sidebar — becomes a horizontal scrollable nav on mobile */}
      <aside className="shrink-0 bg-panel lg:h-screen lg:w-64 lg:overflow-y-auto">
        <div className="flex items-center gap-2 p-4 lg:p-6">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-nav text-nav-foreground">
            <span className="text-sm font-bold">M</span>
          </div>
          <span className="hidden text-lg font-bold text-panel-foreground lg:block">
            MCS
          </span>
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
              }`}
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
            Live production floor status
          </p>
        </header>

        {/* Machine grid */}
        <section
          className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          aria-label="Machine status cards"
        >
          {machines.map((machine) => (
            <MachineCard
              key={machine.id}
              machine={machine}
              onAlert={() =>
                setAlertMessage(
                  `${machine.name} reported an issue at ${new Date().toLocaleTimeString()}`
                )
              }
            />
          ))}
        </section>

        {/* Alert message panel */}
        <section className="mt-6 rounded-lg bg-panel p-4 lg:mt-8 lg:p-6">
          <h2 className="mb-2 text-sm font-semibold text-panel-foreground">
            Alert Message
          </h2>
          <div className="min-h-[4.5rem] rounded-md bg-background p-3 text-sm text-foreground">
            {alertMessage ? (
              <p>{alertMessage}</p>
            ) : (
              <p className="text-muted-foreground">Alert Message ....</p>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function MachineCard({
  machine,
  onAlert,
}: {
  machine: { id: number; name: string; status: "running" | "alert" };
  onAlert: () => void;
}) {
  const isAlert = machine.status === "alert";

  return (
    <button
      onClick={() => isAlert && onAlert()}
      className={`group relative flex aspect-[4/3] flex-col items-center justify-center rounded-lg p-4 text-center shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isAlert
          ? "bg-alert text-alert-foreground hover:bg-alert/90"
          : "bg-running text-running-foreground hover:bg-running/90"
      }`}
      aria-label={`${machine.name}, status ${isAlert ? "alert" : "running"}`}
    >
      <span className="text-lg font-semibold sm:text-xl lg:text-2xl">
        {machine.name}
      </span>
      <span
        className={`mt-2 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          isAlert
            ? "bg-alert-foreground/20 text-alert-foreground"
            : "bg-running-foreground/20 text-running-foreground"
        }`}
      >
        {isAlert ? "Alert" : "Running"}
      </span>
    </button>
  );
}

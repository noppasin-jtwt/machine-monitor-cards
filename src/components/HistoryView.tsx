import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Inbox, RefreshCw, Search } from "lucide-react";

type LogEntry = {
  timestamp: string;
  machine_no: string;
  machine_name: string;
  event: string;
  plc: string;
  emergency: string;
  auto: string;
  rssi: string;
  snr: string;
};

const EVENTS = [
  "HEARTBEAT",
  "PLC_ON",
  "PLC_OFF",
  "MANUAL_MODE",
  "AUTO_MODE",
  "EMERGENCY_ON",
  "EMERGENCY_OFF",
  "STARTUP",
] as const;

const MACHINE_OPTIONS = [
  "Supply Bolt HS/FW [SL]",
  "Supply Bolt Piston [ML]",
  "Supply Head Cover [ML]",
  "FW CiRA CORE [SL]",
] as const;

const badgeClass: Record<string, string> = {
  HEARTBEAT: "bg-muted text-muted-foreground",
  PLC_ON: "bg-running text-running-foreground",
  PLC_OFF: "bg-offline-foreground text-offline",
  MANUAL_MODE: "bg-info text-info-foreground",
  AUTO_MODE: "bg-running text-running-foreground",
  EMERGENCY_ON: "bg-alert text-alert-foreground",
  EMERGENCY_OFF: "bg-warning text-warning-foreground",
};

function formatTimestamp(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function toCsv(rows: LogEntry[]) {
  const header = ["Timestamp", "Machine", "Event", "PLC", "Emergency", "Auto", "RSSI", "SNR"];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [
      formatTimestamp(r.timestamp),
      r.machine_name,
      r.event,
      r.plc,
      r.emergency,
      r.auto,
      r.rssi,
      r.snr,
    ]
      .map(escape)
      .join(","),
  );
  return [header.map(escape).join(","), ...lines].join("\r\n");
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob(["﻿" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string): LogEntry[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length < 2) return [];

  const headers = rows[0];
  if (!headers) {
    return [];
  }
  const normalizedHeaders = headers.map((header) =>
    header.trim().toLowerCase()
  );

  const index = (name: string) => normalizedHeaders.indexOf(name);
  const value = (cells: string[], name: string) => {
    const i = index(name);
    return i >= 0 ? (cells[i] ?? "").trim() : "";
  };

  return rows.slice(1).map((cells) => ({
    timestamp: value(cells, "timestamp"),
    machine_no: value(cells, "machine_no"),
    machine_name: value(cells, "machine_name"),
    event: value(cells, "event"),
    plc: value(cells, "plc"),
    emergency: value(cells, "emergency"),
    auto: value(cells, "auto"),
    rssi: value(cells, "rssi"),
    snr: value(cells, "snr"),
  })).filter((entry) => entry.timestamp || entry.machine_name || entry.event);
}

const selectClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function HistoryView() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [machineFilter, setMachineFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = useCallback(async () => {
    try {
      const backendUrl = (
        import.meta.env["VITE_BACKEND_URL"] || "http://172.20.177.186:5000"
      ).replace(/\/$/, "");

      // The Python backend reads the CSV log files and is the preferred source
      // because it also includes new daily logs.
      const apiRes = await fetch(`${backendUrl}/api/history?limit=5000`, {
        cache: "no-store",
      });

      if (apiRes.ok) {
        const data = (await apiRes.json()) as unknown;
        if (Array.isArray(data)) {
          setLogs(data as LogEntry[]);
          return;
        }
      }

      // Fallback for a standalone/static deployment: show the bundled
      // historical CSV shipped with the website.
      const csvRes = await fetch(`/machine_log.csv?ts=${Date.now()}`, {
        cache: "no-store",
      });
      if (!csvRes.ok) throw new Error(`History CSV returned ${csvRes.status}`);

      const text = await csvRes.text();
      const data = parseCsv(text);
      setLogs(data.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    } catch (error) {
      console.error("Failed to load machine history:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [load]);

  const machineNames = useMemo(() => {
    const names = new Set<string>(MACHINE_OPTIONS);
    logs.forEach((l) => names.add(l.machine_name));
    return Array.from(names);
  }, [logs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (machineFilter !== "all" && l.machine_name !== machineFilter) return false;
      if (eventFilter !== "all" && l.event !== eventFilter) return false;
      if (q && !l.machine_name.toLowerCase().includes(q)) return false;
      const time = new Date(l.timestamp).getTime();
      if (dateFrom && time < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
      if (dateTo && time > new Date(`${dateTo}T23:59:59`).getTime()) return false;
      return true;
    });
  }, [logs, machineFilter, eventFilter, search, dateFrom, dateTo]);

  const emergencyCount = useMemo(
    () => filtered.filter((l) => l.event.startsWith("EMERGENCY")).length,
    [filtered],
  );
  const manualCount = useMemo(
    () => filtered.filter((l) => l.event === "MANUAL_MODE").length,
    [filtered],
  );
  const lastUpdate = filtered[0] ? formatTimestamp(filtered[0].timestamp) : "—";

  const exportCsv = () =>
    download(`machine-history-${Date.now()}.csv`, toCsv(filtered), "text/csv;charset=utf-8");

  const exportExcel = () => {
    const header = ["Timestamp", "Machine", "Event", "PLC", "Emergency", "Auto", "RSSI", "SNR"];
    const rows = filtered
      .map(
        (r) =>
          `<tr><td>${formatTimestamp(r.timestamp)}</td><td>${r.machine_name}</td><td>${r.event}</td><td>${r.plc}</td><td>${r.emergency}</td><td>${r.auto}</td><td>${r.rssi}</td><td>${r.snr}</td></tr>`,
      )
      .join("");
    const html = `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/></head><body><table border="1"><thead><tr>${header
      .map((h) => `<th>${h}</th>`)
      .join("")}</tr></thead><tbody>${rows}</tbody></table></body></html>`;
    download(`machine-history-${Date.now()}.xls`, html, "application/vnd.ms-excel");
  };

  const summaryCards: Array<{ label: string; value: string }> = [
    { label: "Total Records", value: String(filtered.length) },
    { label: "Emergency Events", value: String(emergencyCount) },
    { label: "Manual Mode Events", value: String(manualCount) },
    { label: "Last Update", value: lastUpdate },
  ];

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="History summary">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-2xl bg-card p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-2 truncate text-xl font-black text-card-foreground sm:text-2xl">
              {card.value}
            </p>
          </div>
        ))}
      </section>

      {/* Filter panel */}
      <section
        className="rounded-2xl bg-card p-4 shadow-sm"
        aria-label="History filters"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Machine
            </span>
            <select
              value={machineFilter}
              onChange={(e) => setMachineFilter(e.target.value)}
              className={selectClass}
            >
              <option value="all">All Machines</option>
              {machineNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Event Type
            </span>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className={selectClass}
            >
              <option value="all">All Events</option>
              {EVENTS.map((event) => (
                <option key={event} value={event}>
                  {event}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              From Date
            </span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={selectClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              To Date
            </span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={selectClass}
            />
          </label>
          <label className="block sm:col-span-2 lg:col-span-1">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Search
            </span>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search machine name"
                className={`${selectClass} pl-9`}
              />
            </div>
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-lg bg-nav px-4 py-2 text-sm font-semibold text-nav-foreground shadow-sm transition-colors hover:bg-nav-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </button>
          <button
            onClick={exportExcel}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            Export Excel
          </button>
          <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Auto-refresh every 5s
          </span>
        </div>
      </section>

      {/* Table */}
      <section className="overflow-hidden rounded-2xl bg-card shadow-sm" aria-label="Machine event log">
        {loading && logs.length === 0 ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground" aria-hidden />
            <p className="text-base font-semibold text-card-foreground">
              No machine history available
            </p>
            <p className="text-sm text-muted-foreground">
              Event records will appear here as machines report in.
            </p>
          </div>
        ) : (
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-panel text-left">
                  {["Timestamp", "Machine", "Event", "PLC", "Emergency", "Auto", "RSSI", "SNR"].map(
                    (col) => (
                      <th
                        key={col}
                        scope="col"
                        className="whitespace-nowrap px-4 py-3 text-xs font-bold uppercase tracking-wide text-panel-foreground"
                      >
                        {col}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((log, i) => (
                  <tr
                    key={`${log.timestamp}-${log.machine_no}-${i}`}
                    className="border-t border-border transition-colors odd:bg-card even:bg-muted/40 hover:bg-accent"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium text-card-foreground">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="px-4 py-2.5 text-card-foreground">{log.machine_name}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${badgeClass[log.event] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {log.event}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-card-foreground">{log.plc}</td>
                    <td className="px-4 py-2.5 text-card-foreground">{log.emergency}</td>
                    <td className="px-4 py-2.5 text-card-foreground">{log.auto}</td>
                    <td className="px-4 py-2.5 text-card-foreground">{log.rssi || "—"}</td>
                    <td className="px-4 py-2.5 text-card-foreground">{log.snr || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

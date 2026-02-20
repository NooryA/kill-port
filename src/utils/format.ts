import chalk from "chalk";
import type { Listener, ListenerWithPort } from "../types";

const useColor = process.stdout.isTTY && chalk.supportsColor;

function col(s: string, fn: (x: string) => string): string {
  return useColor ? fn(s) : s;
}

export function formatListenersTable(listeners: Listener[], port: number): string {
  const headers = ["PID", "Name", "Port"];
  const rows = listeners.map((l) => [String(l.pid), l.name ?? "-", String(port)]);
  const colWidths = headers.map((h, i) => {
    const maxCell = Math.max(h.length, ...rows.map((r) => r[i].length));
    return Math.min(maxCell + 2, 24);
  });
  const pad = (s: string, w: number) => s.padEnd(w);
  const headerRow = headers.map((h, i) => pad(h, colWidths[i])).join("");
  const separator = "-".repeat(headerRow.length);
  const bodyRows = rows.map((r) => r.map((c, i) => pad(c, colWidths[i])).join("")).join("\n");
  return col(headerRow, chalk.bold) + "\n" + col(separator, chalk.dim) + "\n" + bodyRows;
}

export function formatSuccess(port: number, killed: number[]): string {
  const pids = killed.join(", ");
  return col(`Killed process(es) ${pids} on port ${port}.`, chalk.green);
}

export function formatErrors(errors: Array<{ pid: number; message: string }>): string {
  return errors.map((e) => col(`PID ${e.pid}: ${e.message}`, chalk.red)).join("\n");
}

export function formatPortFree(port: number): string {
  return col(`Port ${port} is free.`, chalk.green);
}

export function formatListenersListTable(listeners: ListenerWithPort[]): string {
  if (listeners.length === 0) {
    return col("No TCP listeners found.", chalk.dim);
  }
  const headers = ["Port", "PID", "Name"];
  const rows = listeners.map((l) => [String(l.port), String(l.pid), l.name ?? "-"]);
  const colWidths = headers.map((h, i) => {
    const maxCell = Math.max(h.length, ...rows.map((r) => r[i].length));
    return Math.min(maxCell + 2, 24);
  });
  const pad = (s: string, w: number) => s.padEnd(w);
  const headerRow = headers.map((h, i) => pad(h, colWidths[i])).join("");
  const separator = "-".repeat(headerRow.length);
  const bodyRows = rows.map((r) => r.map((c, i) => pad(c, colWidths[i])).join("")).join("\n");
  return col(headerRow, chalk.bold) + "\n" + col(separator, chalk.dim) + "\n" + bodyRows;
}

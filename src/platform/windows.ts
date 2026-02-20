import type { Listener, ListenerWithPort, KillOptions, KillResult } from "../types";
import { exec } from "../utils/exec";
import { parseNetstatWindows, parseNetstatWindowsLineAll } from "../utils/parse";

const NETSTAT_TIMEOUT = 5000;

export async function findListeners(port: number): Promise<Listener[]> {
  const { stdout, exitCode } = await exec("netstat", ["-ano", "-p", "tcp"], { timeout: NETSTAT_TIMEOUT });
  if (exitCode !== 0) return [];

  const pids = new Map<number, void>();
  for (const line of stdout.split(/\r?\n/)) {
    const parsed = parseNetstatWindows(line, port);
    if (parsed) pids.set(parsed.pid, undefined);
  }

  const listeners: Listener[] = [];
  for (const pid of pids.keys()) {
    const name = await getProcessName(pid);
    listeners.push({ pid, name, protocol: "TCP" });
  }
  return listeners;
}

export async function listListeners(): Promise<ListenerWithPort[]> {
  const { stdout, exitCode } = await exec("netstat", ["-ano", "-p", "tcp"], { timeout: NETSTAT_TIMEOUT });
  if (exitCode !== 0) return [];

  const byKey = new Map<string, { port: number; pid: number }>();
  for (const line of stdout.split(/\r?\n/)) {
    const parsed = parseNetstatWindowsLineAll(line);
    if (parsed) byKey.set(`${parsed.port}:${parsed.pid}`, parsed);
  }

  const listeners: ListenerWithPort[] = [];
  for (const { port, pid } of byKey.values()) {
    const name = await getProcessName(pid);
    listeners.push({ pid, name, protocol: "TCP", port });
  }
  listeners.sort((a, b) => a.port - b.port || a.pid - b.pid);
  return listeners;
}

async function getProcessName(pid: number): Promise<string | undefined> {
  if (!Number.isInteger(pid) || pid <= 0) return undefined;
  const { stdout } = await exec("tasklist", ["/FI", `PID eq ${pid}`], {
    timeout: 3000,
  });
  const pidStr = String(pid);
  for (const line of stdout.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) continue;
    if (parts[0] === "Image" && parts[1] === "Name") continue;
    if (parts[0] === "=") continue;
    const pidIdx = parts.indexOf(pidStr);
    if (pidIdx <= 0) continue;
    const name = parts.slice(0, pidIdx).join(" ").trim();
    return name || undefined;
  }
  return undefined;
}

export async function killListeners(listeners: Listener[], _options: KillOptions): Promise<KillResult> {
  const killed: number[] = [];
  const errors: Array<{ pid: number; message: string }> = [];

  for (const listener of listeners) {
    const pid = listener.pid;
    if (!Number.isInteger(pid) || pid <= 0) {
      errors.push({ pid, message: "Invalid PID" });
      continue;
    }

    let result = await exec("taskkill", ["/PID", String(pid), "/T"], {
      timeout: 5000,
    });

    if (result.exitCode !== 0) {
      if (result.stderr.includes("not found") || result.stderr.includes("already ended")) {
        killed.push(pid);
        continue;
      }
      result = await exec("taskkill", ["/PID", String(pid), "/T", "/F"], { timeout: 5000 });
    }

    if (result.exitCode === 0) {
      killed.push(pid);
    } else {
      errors.push({
        pid,
        message: result.stderr.trim() || result.stdout.trim() || "Unknown error",
      });
    }
  }

  return { killed, errors };
}

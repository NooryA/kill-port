import * as process from "process";
import type { Listener, ListenerWithPort, KillOptions, KillResult } from "../types";
import { exec } from "../utils/exec";
import { parseLsofLine, parseLsofLineWithPort, parseSsLine, parseSsLineAll } from "../utils/parse";
import { wait } from "../utils/wait";

const LSOF_TIMEOUT = 5000;
const GRACEFUL_WAIT_MS = 500;

export async function findListeners(port: number): Promise<Listener[]> {
  const listeners = await findListenersLsof(port);
  if (listeners.length > 0) return listeners;

  const ssListeners = await findListenersSs(port);
  if (ssListeners.length > 0) return ssListeners;

  return findListenersNetstat(port);
}

async function findListenersLsof(port: number): Promise<Listener[]> {
  const { stdout, exitCode } = await exec("lsof", ["-n", "-P", `-iTCP:${port}`, "-sTCP:LISTEN"], { timeout: LSOF_TIMEOUT });
  if (exitCode !== 0) return [];

  const seen = new Set<number>();
  const listeners: Listener[] = [];
  const lines = stdout.split(/\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 && /COMMAND\s+PID\s+USER/.test(line)) continue;
    const parsed = parseLsofLine(line);
    if (parsed && !seen.has(parsed.pid)) {
      seen.add(parsed.pid);
      listeners.push(parsed);
    }
  }
  return listeners;
}

async function findListenersSs(port: number): Promise<Listener[]> {
  const { stdout, exitCode } = await exec("ss", ["-lptn"], {
    timeout: LSOF_TIMEOUT,
  });
  if (exitCode !== 0) return [];

  const seen = new Set<number>();
  const listeners: Listener[] = [];
  for (const line of stdout.split(/\n/)) {
    const parsed = parseSsLine(line, port);
    if (parsed && !seen.has(parsed.pid)) {
      seen.add(parsed.pid);
      listeners.push(parsed);
    }
  }
  return listeners;
}

async function findListenersNetstat(port: number): Promise<Listener[]> {
  const { stdout, exitCode } = await exec("netstat", ["-anv"], {
    timeout: LSOF_TIMEOUT,
  });
  if (exitCode !== 0) {
    const r2 = await exec("netstat", ["-anp"], { timeout: LSOF_TIMEOUT });
    if (r2.exitCode !== 0) return [];
    return parseNetstatLines(r2.stdout, port);
  }
  return parseNetstatLines(stdout, port);
}

function parseNetstatLines(stdout: string, port: number): Listener[] {
  const listeners: Listener[] = [];
  const seen = new Set<number>();
  const portStr = `:${port}`;
  for (const line of stdout.split(/\n/)) {
    if (!line.includes("LISTEN") || !line.includes(portStr)) continue;
    const pidMatch = line.match(/pid\s*=\s*(\d+)/) ?? line.match(/\s(\d+)\s+.*\d+\.\d+\.\d+\.\d+:\d+/);
    const pid = pidMatch ? parseInt(pidMatch[1], 10) : undefined;
    if (pid && !Number.isNaN(pid) && !seen.has(pid)) {
      seen.add(pid);
      listeners.push({ pid, protocol: "TCP" });
    }
  }
  return listeners;
}

export async function listListeners(): Promise<ListenerWithPort[]> {
  const fromLsof = await listListenersLsof();
  if (fromLsof.length > 0) return fromLsof;
  return listListenersSs();
}

async function listListenersLsof(): Promise<ListenerWithPort[]> {
  const { stdout, exitCode } = await exec("lsof", ["-n", "-P", "-iTCP", "-sTCP:LISTEN"], { timeout: LSOF_TIMEOUT });
  if (exitCode !== 0) return [];

  const byKey = new Map<string, ListenerWithPort>();
  const lines = stdout.split(/\n/);
  for (let i = 0; i < lines.length; i++) {
    if (i === 0 && /COMMAND\s+PID\s+USER/.test(lines[i])) continue;
    const parsed = parseLsofLineWithPort(lines[i]);
    if (parsed) byKey.set(`${parsed.port}:${parsed.pid}`, parsed);
  }
  const list = Array.from(byKey.values());
  list.sort((a, b) => a.port - b.port || a.pid - b.pid);
  return list;
}

async function listListenersSs(): Promise<ListenerWithPort[]> {
  const { stdout, exitCode } = await exec("ss", ["-lptn"], {
    timeout: LSOF_TIMEOUT,
  });
  if (exitCode !== 0) return [];

  const byKey = new Map<string, ListenerWithPort>();
  for (const line of stdout.split(/\n/)) {
    const parsed = parseSsLineAll(line);
    if (parsed) byKey.set(`${parsed.port}:${parsed.pid}`, parsed);
  }
  const list = Array.from(byKey.values());
  list.sort((a, b) => a.port - b.port || a.pid - b.pid);
  return list;
}

export async function killListeners(listeners: Listener[], options: KillOptions): Promise<KillResult> {
  const killed: number[] = [];
  const errors: Array<{ pid: number; message: string }> = [];
  const port = options.port ?? 0;

  for (const listener of listeners) {
    const pid = listener.pid;
    if (!Number.isInteger(pid) || pid <= 0) {
      errors.push({ pid, message: "Invalid PID" });
      continue;
    }

    try {
      process.kill(pid, "SIGTERM");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ pid, message: msg });
      continue;
    }

    killed.push(pid);
  }

  await wait(GRACEFUL_WAIT_MS);

  if (port > 0) {
    const stillListening = await findListeners(port);
    for (const listener of listeners) {
      if (!killed.includes(listener.pid)) continue;
      const still = stillListening.some((l) => l.pid === listener.pid);
      if (still) {
        try {
          process.kill(listener.pid, "SIGKILL");
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          const idx = killed.indexOf(listener.pid);
          if (idx !== -1) killed.splice(idx, 1);
          errors.push({ pid: listener.pid, message: `SIGKILL: ${msg}` });
        }
      }
    }
  }

  return { killed, errors };
}

import type { Listener, ListenerWithPort } from "../types";

const PORT_MIN = 1;
const PORT_MAX = 65535;

export function parsePort(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  if (/\./.test(trimmed)) return null;
  const num = parseInt(trimmed, 10);
  if (Number.isNaN(num)) return null;
  if (num < PORT_MIN || num > PORT_MAX) return null;
  return num;
}

/**
 * Parse a single line of lsof output.
 * Typical: "node    12345  user    5u  IPv6 ...  TCP *:3000 (LISTEN)"
 * Columns: COMMAND, PID, USER, FD, TYPE, ...
 */
export function parseLsofLine(line: string): Listener | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  if (parts.length < 3) return null;
  const pid = parseInt(parts[1], 10);
  if (Number.isNaN(pid) || pid <= 0) return null;
  return {
    pid,
    name: parts[0] || undefined,
    protocol: "TCP",
  };
}

/**
 * Parse Windows netstat -ano -p tcp line.
 * Example: "TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    1234"
 */
export function parseNetstatWindows(line: string, port: number): { pid: number } | null {
  const parsed = parseNetstatWindowsLineAll(line);
  return parsed && parsed.port === port ? { pid: parsed.pid } : null;
}

/**
 * Parse Windows netstat line for any port (for --list).
 */
export function parseNetstatWindowsLineAll(line: string): { port: number; pid: number } | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith("TCP")) return null;
  const parts = trimmed.split(/\s+/);
  if (parts.length < 5) return null;
  const localAddr = parts[1];
  const state = parts[3];
  const pidStr = parts[4];
  if (state !== "LISTENING") return null;
  const portMatch = localAddr.match(/:(\d+)$/);
  if (!portMatch) return null;
  const port = parseInt(portMatch[1], 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) return null;
  const pid = parseInt(pidStr, 10);
  if (Number.isNaN(pid) || pid <= 0) return null;
  return { port, pid };
}

/**
 * Parse ss -lptn line. Example:
 * "LISTEN 0 128 *:3000 *:* users:((\"node\",pid=12345,...))"
 */
export function parseSsLine(line: string, port: number): Listener | null {
  const parsed = parseSsLineAll(line);
  return parsed && parsed.port === port ? parsed : null;
}

/**
 * Parse ss -lptn line for any port (for --list).
 */
export function parseSsLineAll(line: string): ListenerWithPort | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith("LISTEN")) return null;
  const portMatch = trimmed.match(/:(\d+)\s/);
  if (!portMatch) return null;
  const port = parseInt(portMatch[1], 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) return null;
  const pidMatch = trimmed.match(/pid=(\d+)/);
  const nameMatch = trimmed.match(/users:\(\(\s*"([^"]*)"/);
  const pid = pidMatch ? parseInt(pidMatch[1], 10) : undefined;
  if (pid === undefined || Number.isNaN(pid) || pid <= 0) return null;
  return {
    pid,
    name: nameMatch ? nameMatch[1] : undefined,
    protocol: "TCP",
    port,
  };
}

/**
 * Parse lsof line and extract port from NAME column (e.g. "*:3000 (LISTEN)").
 */
export function parseLsofLineWithPort(line: string): ListenerWithPort | null {
  const base = parseLsofLine(line);
  if (!base) return null;
  const match = line.match(/:(\d+)\s*\(LISTEN\)/);
  if (!match) return null;
  const port = parseInt(match[1], 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) return null;
  return { ...base, port };
}

#!/usr/bin/env node

import { program } from "commander";
import { findListeners, killListeners, isPortFree, listListeners, type ListJsonOutput, type MultiPortJsonOutput } from "./index";
import { parsePort } from "./utils/parse";
import { confirm } from "./utils/confirm";
import { formatListenersListTable, formatSuccess, formatErrors, formatPortFree } from "./utils/format";
import type { Listener, ListenerWithPort } from "./types";

const DEFAULT_TIMEOUT_MS = 3000;

function toListenerWithPort(listener: Listener, port: number): { port: number; pid: number; name?: string; protocol?: string } {
  return { port, pid: listener.pid, name: listener.name, protocol: listener.protocol };
}

function filterListeners(listeners: ListenerWithPort[], pattern: string): ListenerWithPort[] {
  const trimmed = pattern.trim();
  if (!trimmed) return listeners;
  const isRegex = trimmed.length >= 2 && trimmed.startsWith("/") && trimmed.endsWith("/");
  if (isRegex) {
    let re: RegExp;
    try {
      re = new RegExp(trimmed.slice(1, -1));
    } catch {
      return listeners;
    }
    return listeners.filter((l) => re.test(l.name ?? "") || re.test(String(l.port)) || re.test(String(l.pid)));
  }
  const lower = trimmed.toLowerCase();
  return listeners.filter(
    (l) => (l.name ?? "").toLowerCase().includes(lower) || String(l.port).includes(trimmed) || String(l.pid).includes(trimmed),
  );
}

program
  .name("kill-port")
  .description("Kill process(es) listening on a TCP port")
  .usage("[ports...] [options]")
  .argument("[ports...]", "TCP port(s) (1-65535); required unless using --list")
  .option("-l, --list", "List all TCP listeners (no kill)")
  .option("--filter <pattern>", "With --list: show only rows matching pattern (substring or /regex/)")
  .option("-f, --force", "Skip confirmation prompt")
  .option("-d, --dry-run", "Show what would be killed without killing")
  .option("-v, --verbose", "Print debug info")
  .option("--json", "Output machine-readable JSON")
  .option("--timeout <ms>", "Wait up to this many ms for port to free after kill", (v) => parseInt(v, 10), DEFAULT_TIMEOUT_MS)
  .action(
    async (
      portArgs: string[],
      options: {
        list?: boolean;
        filter?: string;
        force?: boolean;
        dryRun?: boolean;
        verbose?: boolean;
        json?: boolean;
        timeout?: number;
      },
    ) => {
      if (options.list) {
        try {
          let listeners = await listListeners();
          if (options.filter) {
            listeners = filterListeners(listeners, options.filter);
          }
          if (options.json) {
            const out: ListJsonOutput = {
              listeners: listeners.map((l) => ({
                port: l.port,
                pid: l.pid,
                name: l.name,
                protocol: l.protocol,
              })),
            };
            console.log(JSON.stringify(out));
          } else {
            console.log(formatListenersListTable(listeners));
          }
          process.exit(0);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (options.verbose) console.error("listListeners error:", e);
          if (options.json) {
            console.log(JSON.stringify({ listeners: [], error: msg }));
          } else {
            console.error("Error:", msg);
          }
          process.exit(1);
        }
        return;
      }

      const rawPorts = Array.isArray(portArgs) ? portArgs : portArgs != null && String(portArgs).trim() !== "" ? [String(portArgs)] : [];
      if (rawPorts.length === 0) {
        console.error("Error: At least one port is required (or use --list to list all listeners).");
        process.exit(1);
      }

      const ports: number[] = [];
      for (const raw of rawPorts) {
        const p = parsePort(raw);
        if (p === null) {
          console.error(`Error: Invalid port "${raw}". Port must be an integer between 1 and 65535.`);
          process.exit(1);
        }
        ports.push(p);
      }

      const timeoutMs = Number.isNaN(options.timeout as number) ? DEFAULT_TIMEOUT_MS : Math.max(0, options.timeout as number);

      const portListeners: Array<{ port: number; listeners: Listener[] }> = [];
      for (const port of ports) {
        try {
          const listeners = await findListeners(port);
          portListeners.push({ port, listeners });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (options.verbose) console.error("findListeners error:", e);
          if (options.json) {
            console.log(
              JSON.stringify({
                results: [{ port, found: [], killed: [], errors: [{ pid: 0, message: msg }] }],
              } as MultiPortJsonOutput),
            );
          } else {
            console.error(`Error (port ${port}):`, msg);
          }
          process.exit(1);
        }
      }

      const allListenersFlat = portListeners.flatMap(({ port, listeners }) => listeners.map((l) => ({ port, listener: l })));

      if (allListenersFlat.length === 0) {
        if (options.json) {
          const out: MultiPortJsonOutput = {
            results: portListeners.map(({ port }) => ({ port, found: [], killed: [], errors: [] })),
          };
          console.log(JSON.stringify(out));
        } else {
          for (const { port } of portListeners) {
            console.log(formatPortFree(port));
          }
        }
        process.exit(0);
      }

      const combinedForDisplay = allListenersFlat.map(({ port, listener }) => ({
        port,
        pid: listener.pid,
        name: listener.name,
        protocol: listener.protocol,
      }));

      if (options.dryRun) {
        if (options.json) {
          const out: MultiPortJsonOutput = {
            results: portListeners.map(({ port, listeners }) => ({
              port,
              found: listeners.map((l) => toListenerWithPort(l, port)),
              killed: [],
              errors: [],
            })),
          };
          console.log(JSON.stringify(out));
        } else {
          console.log(formatListenersListTable(combinedForDisplay));
          console.log("(Dry run — no processes killed)");
        }
        process.exit(0);
      }

      if (!options.force) {
        console.log(formatListenersListTable(combinedForDisplay));
        const ok = await confirm("Kill these processes? (y/N) ");
        if (!ok) {
          if (options.json) {
            const out: MultiPortJsonOutput = {
              results: portListeners.map(({ port, listeners }) => ({
                port,
                found: listeners.map((l) => toListenerWithPort(l, port)),
                killed: [],
                errors: [],
              })),
            };
            console.log(JSON.stringify(out));
          }
          process.exit(0);
        }
      }

      const results: MultiPortJsonOutput["results"] = [];
      let hasErrors = false;
      for (const { port, listeners } of portListeners) {
        if (listeners.length === 0) {
          results.push({ port, found: [], killed: [], errors: [] });
          continue;
        }
        const result = await killListeners(listeners, {
          force: options.force,
          timeoutAfterKill: timeoutMs,
          port,
        });
        if (timeoutMs > 0) {
          await isPortFree(port, timeoutMs);
        }
        results.push({
          port,
          found: listeners.map((l) => toListenerWithPort(l, port)),
          killed: result.killed,
          errors: result.errors,
        });
        if (result.errors.length > 0) hasErrors = true;
      }

      if (options.json) {
        console.log(JSON.stringify({ results } as MultiPortJsonOutput));
      } else {
        for (const r of results) {
          if (r.killed.length > 0) {
            console.log(formatSuccess(r.port, r.killed));
          }
          if (r.errors.length > 0) {
            console.error(formatErrors(r.errors));
          }
        }
      }

      process.exit(hasErrors ? 1 : 0);
    },
  );

program.parseAsync().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

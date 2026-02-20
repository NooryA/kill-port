import type { Listener, ListenerWithPort, KillOptions, KillResult, JsonOutput, ListJsonOutput, MultiPortJsonOutput } from "./types";
import * as windows from "./platform/windows";
import * as unix from "./platform/unix";
import { isPortFree as waitIsPortFree } from "./utils/wait";

export type { Listener, ListenerWithPort, KillOptions, KillResult, JsonOutput, ListJsonOutput, MultiPortJsonOutput };

function getPlatform(): typeof windows | typeof unix {
  if (process.platform === "win32") return windows;
  return unix;
}

export async function findListeners(port: number): Promise<Listener[]> {
  return getPlatform().findListeners(port);
}

export async function killListeners(listeners: Listener[], options: KillOptions): Promise<KillResult> {
  return getPlatform().killListeners(listeners, options);
}

export async function isPortFree(port: number, timeoutMs: number = 3000): Promise<boolean> {
  const platform = getPlatform();
  return waitIsPortFree(port, timeoutMs, (p) => platform.findListeners(p));
}

export async function listListeners(): Promise<ListenerWithPort[]> {
  return getPlatform().listListeners();
}

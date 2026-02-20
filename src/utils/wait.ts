import type { Listener } from "../types";

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function isPortFree(
  port: number,
  timeoutMs: number,
  findListeners: (p: number) => Promise<Listener[]>
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const listeners = await findListeners(port);
    if (listeners.length === 0) return true;
    await wait(200);
  }
  return false;
}

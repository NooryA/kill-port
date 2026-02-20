import { describe, it, expect, vi } from "vitest";
import { findListeners, killListeners, isPortFree } from "../src/index";
import { isPortFree as waitIsPortFree } from "../src/utils/wait";

describe("findListeners", () => {
  it("returns a promise of list", async () => {
    const result = findListeners(65535);
    expect(result).toBeInstanceOf(Promise);
    const list = await result;
    expect(Array.isArray(list)).toBe(true);
  });
});

describe("killListeners", () => {
  it("accepts empty list and returns killed and errors", async () => {
    const result = await killListeners([], {});
    expect(result).toEqual({ killed: [], errors: [] });
  });
});

describe("isPortFree", () => {
  it("resolves to true when findListeners returns empty within timeout", async () => {
    const mockFind = vi.fn().mockResolvedValue([]);
    const result = await waitIsPortFree(39999, 500, mockFind);
    expect(result).toBe(true);
    expect(mockFind).toHaveBeenCalledWith(39999);
  });

  it("resolves to false when port never frees within timeout", async () => {
    const mockFind = vi.fn().mockResolvedValue([{ pid: 1, name: "x", protocol: "TCP" }]);
    const result = await waitIsPortFree(39998, 300, mockFind);
    expect(result).toBe(false);
  });
});

describe("isPortFree (public API)", () => {
  it("is callable with port and optional timeout", async () => {
    const p = isPortFree(40000, 100);
    expect(p).toBeInstanceOf(Promise);
    await p;
  });
});

import { describe, it, expect } from "vitest";
import {
  parsePort,
  parseLsofLine,
  parseLsofLineWithPort,
  parseNetstatWindows,
  parseNetstatWindowsLineAll,
  parseSsLine,
  parseSsLineAll,
} from "../src/utils/parse";

describe("parsePort", () => {
  it("accepts valid ports 1, 8080, 65535", () => {
    expect(parsePort("1")).toBe(1);
    expect(parsePort("8080")).toBe(8080);
    expect(parsePort("65535")).toBe(65535);
  });

  it("returns null for 0, 65536, non-integers, empty", () => {
    expect(parsePort("0")).toBeNull();
    expect(parsePort("65536")).toBeNull();
    expect(parsePort("abc")).toBeNull();
    expect(parsePort("")).toBeNull();
    expect(parsePort("   ")).toBeNull();
    expect(parsePort("80.5")).toBeNull();
  });

  it("trims whitespace", () => {
    expect(parsePort("  3000  ")).toBe(3000);
  });
});

describe("parseLsofLine", () => {
  it("parses typical lsof line with PID and command", () => {
    const line = "node    12345  noor    5u  IPv6 0x...  TCP *:3000 (LISTEN)";
    const r = parseLsofLine(line);
    expect(r).not.toBeNull();
    expect(r!.pid).toBe(12345);
    expect(r!.name).toBe("node");
  });

  it("handles extra spaces", () => {
    const line = "node      999   root";
    const r = parseLsofLine(line);
    expect(r).not.toBeNull();
    expect(r!.pid).toBe(999);
    expect(r!.name).toBe("node");
  });

  it("returns null for empty or insufficient columns", () => {
    expect(parseLsofLine("")).toBeNull();
    expect(parseLsofLine("  ")).toBeNull();
    expect(parseLsofLine("node")).toBeNull();
    expect(parseLsofLine("node  abc  x")).toBeNull();
  });
});

describe("parseNetstatWindows", () => {
  it("parses TCP LISTENING line and extracts PID for matching port", () => {
    const line = "TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    1234";
    const r = parseNetstatWindows(line, 3000);
    expect(r).not.toBeNull();
    expect(r!.pid).toBe(1234);
  });

  it("returns null for wrong port", () => {
    const line = "TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    1234";
    expect(parseNetstatWindows(line, 8080)).toBeNull();
  });

  it("returns null for non-TCP or non-LISTENING", () => {
    expect(parseNetstatWindows("UDP    0.0.0.0:3000    0.0.0.0:0    LISTENING    1234", 3000)).toBeNull();
    expect(parseNetstatWindows("TCP    0.0.0.0:3000    0.0.0.0:0    ESTABLISHED    1234", 3000)).toBeNull();
  });
});

describe("parseSsLine", () => {
  it("parses ss line with port and pid", () => {
    const line = 'LISTEN 0 128 *:3000 *:* users:(("node",pid=12345,fd=10))';
    const r = parseSsLine(line, 3000);
    expect(r).not.toBeNull();
    expect(r!.pid).toBe(12345);
    expect(r!.name).toBe("node");
  });

  it("returns null for wrong port", () => {
    const line = 'LISTEN 0 128 *:3000 *:* users:(("node",pid=12345,fd=10))';
    expect(parseSsLine(line, 8080)).toBeNull();
  });

  it("returns null for non-LISTEN line", () => {
    expect(parseSsLine("ESTAB 0 0 1.2.3.4:3000 5.6.7.8:22", 3000)).toBeNull();
  });
});

describe("parseNetstatWindowsLineAll", () => {
  it("parses TCP LISTENING line and returns port and pid", () => {
    const line = "TCP    0.0.0.0:3000    0.0.0.0:0    LISTENING    1234";
    const r = parseNetstatWindowsLineAll(line);
    expect(r).not.toBeNull();
    expect(r!.port).toBe(3000);
    expect(r!.pid).toBe(1234);
  });

  it("returns null for non-LISTENING", () => {
    expect(parseNetstatWindowsLineAll("TCP    0.0.0.0:3000    0.0.0.0:0    ESTABLISHED    1234")).toBeNull();
  });
});

describe("parseSsLineAll", () => {
  it("parses ss line and returns port and listener", () => {
    const line = 'LISTEN 0 128 *:8080 *:* users:(("node",pid=999,fd=10))';
    const r = parseSsLineAll(line);
    expect(r).not.toBeNull();
    expect(r!.port).toBe(8080);
    expect(r!.pid).toBe(999);
    expect(r!.name).toBe("node");
  });
});

describe("parseLsofLineWithPort", () => {
  it("parses lsof line and extracts port from NAME", () => {
    const line = "node    12345  noor    5u  IPv6 0x...  TCP *:3000 (LISTEN)";
    const r = parseLsofLineWithPort(line);
    expect(r).not.toBeNull();
    expect(r!.port).toBe(3000);
    expect(r!.pid).toBe(12345);
  });

  it("returns null when LISTEN port not present", () => {
    expect(parseLsofLineWithPort("node      999   root")).toBeNull();
  });
});

export interface Listener {
  pid: number;
  name?: string;
  protocol?: string;
}

export interface ListenerWithPort extends Listener {
  port: number;
}

export interface KillOptions {
  force?: boolean;
  timeoutAfterKill?: number;
  /** Port (used on Unix to re-check after SIGTERM before SIGKILL) */
  port?: number;
}

export interface KillResult {
  killed: number[];
  errors: Array<{ pid: number; message: string }>;
}

export interface JsonOutput {
  port: number;
  found: Array<{ pid: number; name?: string; protocol?: string }>;
  killed: number[];
  errors: Array<{ pid: number; message: string }>;
}

export interface ListJsonOutput {
  listeners: Array<{ port: number; pid: number; name?: string; protocol?: string }>;
}

export interface MultiPortJsonOutput {
  results: Array<{ port: number; found: JsonOutput["found"]; killed: number[]; errors: JsonOutput["errors"] }>;
}

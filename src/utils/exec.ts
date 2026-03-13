import { getExeca } from "../execaLoader";

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function exec(
  cmd: string,
  args: string[],
  options?: { timeout?: number }
): Promise<ExecResult> {
  const execa = await getExeca();
  const result = await execa(cmd, args, {
    timeout: options?.timeout ?? 10000,
    reject: false,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.exitCode ?? -1,
  };
}

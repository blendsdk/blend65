import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import type { CliJsonEnvelope } from "./cli-protocol.js";
import type { CliAdapter } from "./commands.js";

/** Maximum captured child output in bytes. */
const MAX_OUTPUT_BYTES = 1_048_576;

/** Narrow one untrusted JSON envelope before use. */
export function parseCliEnvelope(value: unknown): CliJsonEnvelope {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Blend65 CLI returned a non-object result");
  }
  const record = value as Record<string, unknown>;
  if (
    record.kind !== "blend65.cli" ||
    record.schemaVersion !== 1 ||
    typeof record.command !== "string" ||
    typeof record.outcome !== "string" ||
    typeof record.exitStatus !== "number" ||
    !Array.isArray(record.diagnostics)
  ) {
    throw new Error("Blend65 CLI returned an unsupported result");
  }
  return value as CliJsonEnvelope;
}

/** Resolve the packaged CLI executable entry point. */
function cliEntry(): string {
  const require = createRequire(import.meta.url);
  return require.resolve("@blend65/cli/bin");
}

/** Start and own one CLI child process for an explicit editor command. */
export function createCliAdapter(): CliAdapter {
  let entry: string | null = null;
  return {
    run(args, signal) {
      entry ??= cliEntry();
      return new Promise<CliJsonEnvelope>((resolve, reject) => {
        const child = spawn(process.execPath, [entry!, ...args], {
          cwd: process.cwd(),
          stdio: ["ignore", "pipe", "pipe"],
          detached: process.platform !== "win32",
          windowsHide: true,
        });
        let stdout = "";
        let stderr = "";
        let settled = false;
        const terminate = (): void => {
          if (child.exitCode !== null || child.signalCode !== null) return;
          try {
            if (process.platform !== "win32" && child.pid !== undefined) {
              process.kill(-child.pid, "SIGTERM");
            } else {
              child.kill("SIGTERM");
            }
          } catch {
            child.kill("SIGTERM");
          }
        };
        const abort = (): void => terminate();
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) terminate();
        child.stdout.on("data", (chunk: Buffer) => {
          if (stdout.length < MAX_OUTPUT_BYTES) stdout += chunk.toString("utf8");
        });
        child.stderr.on("data", (chunk: Buffer) => {
          if (stderr.length < MAX_OUTPUT_BYTES) stderr += chunk.toString("utf8");
        });
        child.on("error", (error) => {
          if (settled) return;
          settled = true;
          signal.removeEventListener("abort", abort);
          reject(error);
        });
        child.on("close", () => {
          if (settled) return;
          settled = true;
          signal.removeEventListener("abort", abort);
          if (signal.aborted) {
            reject(new Error("Blend65 command was cancelled"));
            return;
          }
          const line = stdout.trim();
          if (line.length === 0) {
            reject(new Error(stderr.trim() || "Blend65 CLI returned no result"));
            return;
          }
          try {
            resolve(parseCliEnvelope(JSON.parse(line)));
          } catch (error) {
            reject(error);
          }
        });
      });
    },
  };
}

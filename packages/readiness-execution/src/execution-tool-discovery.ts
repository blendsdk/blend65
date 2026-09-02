import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type {
  ExecutionEnvironmentCapabilitiesV1,
  ExecutionToolVersionV1,
} from "./execution-orchestration-types.js";

/** Closed external tools whose version can affect execution evidence. */
export type ExecutionExternalToolV1 = "acme" | "vice";

const execFileAsync = promisify(execFile);

function version(text: string): string {
  const match = /\b\d+(?:\.\d+){1,3}\b/u.exec(text);
  return match?.[0] ?? "available";
}

/** Probes one allowlisted executable with bounded argv, time, and retained output. */
export async function probeExecutionExternalToolV1(
  tool: ExecutionExternalToolV1,
): Promise<Readonly<{ readonly available: boolean; readonly version?: string }>> {
  const command = tool === "vice" ? "x64sc" : "acme";
  try {
    const completed = await execFileAsync(command, ["--version"], {
      encoding: "utf8",
      timeout: 2_000,
      maxBuffer: 64 * 1024,
      windowsHide: true,
    });
    return Object.freeze({
      available: true,
      version: version(`${completed.stdout}${completed.stderr}`),
    });
  } catch {
    return Object.freeze({ available: false });
  }
}

/** Discovers the exact bounded capability projection used by campaign execution. */
export async function discoverExecutionEnvironmentCapabilitiesV1(): Promise<ExecutionEnvironmentCapabilitiesV1> {
  const [acme, vice] = await Promise.all([
    probeExecutionExternalToolV1("acme"),
    probeExecutionExternalToolV1("vice"),
  ]);
  return Object.freeze({ acme, vice });
}

/** Freshly resolves only the external version rows required by one historical route. */
export async function discoverRequiredExecutionToolVersionsV1(
  tools: readonly ExecutionExternalToolV1[],
): Promise<readonly ExecutionToolVersionV1[] | undefined> {
  const selected = [...new Set(tools)].sort();
  const observed = await Promise.all(
    selected.map(async (tool) =>
      Object.freeze({ tool, result: await probeExecutionExternalToolV1(tool) }),
    ),
  );
  if (observed.some(({ result }) => !result.available || result.version === undefined)) {
    return undefined;
  }
  return Object.freeze(
    observed.map(({ tool, result }) => Object.freeze({ tool, version: result.version! })),
  );
}

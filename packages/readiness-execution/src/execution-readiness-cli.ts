import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { resolvePublishedSnapshot, type ExecutionPolicyV1 } from "@blend65/readiness";
import { createPublishedOracleContext } from "@blend65/readiness/published-oracle";

import {
  EXECUTION_AUTHORITY_REPORT_PATH_V1,
  writeExecutionAuthorityReportV1,
} from "./execution-authority-report.js";
import { createLocalExecutionCampaignV1 } from "./execution-campaign-factory.js";
import { getExecutionEnvironmentCapabilitiesOverrideV1 } from "./execution-orchestration-conformance-v1.js";
import type {
  ExecutionCliIoV1,
  ExecutionEnvironmentCapabilitiesV1,
} from "./execution-orchestration-types.js";
import { executeReadinessCampaign } from "./execution-orchestration.js";
import { resolveExecutionReviewContextV1 } from "./execution-publication-catalog.js";

/** Compatibility name for the command I/O boundary. */
export type ReadinessExecutionCliIoV1 = ExecutionCliIoV1;

/** Closed exit statuses returned by the readiness execution command. */
export type ReadinessExecutionCliExitV1 = 0 | 1 | 2 | 3 | 4;

const USAGE =
  "Usage: yarn readiness:execute -- --target c64 --seed <64-lowercase-hex> " +
  "[--report readiness/execution-evidence/rd-04-local-v1.json]\n";
const POLICY: ExecutionPolicyV1 = Object.freeze({
  revision: "execution-policy-v1",
  budget: Object.freeze({
    operationMs: 60_000,
    launchAttemptMs: 15_000,
    routeMs: 120_000,
    cleanupGraceMs: 3_000,
    outputBytes: 1_048_576,
    evidenceBytes: 16_777_216,
    instructions: 65_535,
    cycles: 100_000_000,
    launchAttempts: 2,
  }),
});
const execFileAsync = promisify(execFile);

function parseArguments(argv: readonly string[]): string | undefined {
  if (
    !Array.isArray(argv) ||
    Object.getPrototypeOf(argv) !== Array.prototype ||
    (argv.length !== 4 && argv.length !== 6) ||
    Reflect.ownKeys(argv).length !== argv.length + 1 ||
    argv[0] !== "--target" ||
    argv[1] !== "c64" ||
    argv[2] !== "--seed" ||
    typeof argv[3] !== "string" ||
    !/^[0-9a-f]{64}$/u.test(argv[3]) ||
    (argv.length === 6 &&
      (argv[4] !== "--report" || argv[5] !== EXECUTION_AUTHORITY_REPORT_PATH_V1))
  ) {
    return undefined;
  }
  return argv[3];
}

function version(text: string): string {
  const match = /\b\d+(?:\.\d+){1,3}\b/u.exec(text);
  return match?.[0] ?? "available";
}

async function probeTool(command: "acme" | "x64sc"): Promise<{
  readonly available: boolean;
  readonly version?: string;
}> {
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

async function discoverCapabilities(): Promise<ExecutionEnvironmentCapabilitiesV1> {
  const scoped = getExecutionEnvironmentCapabilitiesOverrideV1();
  if (scoped !== undefined) return scoped;
  const [acme, vice] = await Promise.all([probeTool("acme"), probeTool("x64sc")]);
  return Object.freeze({ acme, vice });
}

function boundedIssues(
  issues: readonly { readonly code: string; readonly path: string }[],
): string {
  return `${issues
    .map((issue) => `${issue.code}:${issue.path}`)
    .sort()
    .join("\n")}\n`;
}

/**
 * Executes the exact local C64 readiness command grammar and publishes its canonical report.
 *
 * @param argv Command arguments after the executable and entry module.
 * @param io Operation-local current directory and output sinks.
 * @returns A closed exit status distinguishing grammar, tools, execution, and publication.
 *
 * @example
 * ```ts
 * const exit = await runReadinessExecutionCliV1(argv, io);
 * ```
 */
export async function runReadinessExecutionCliV1(
  argv: readonly string[],
  io: ExecutionCliIoV1,
): Promise<ReadinessExecutionCliExitV1> {
  const seed = parseArguments(argv);
  if (seed === undefined) {
    io.writeErr(USAGE);
    return 2;
  }
  try {
    const parent = await resolvePublishedSnapshot({ repositoryRoot: io.cwd });
    if (!parent.ok) {
      io.writeErr(boundedIssues(parent.diagnostics));
      return 4;
    }
    const oracle = createPublishedOracleContext(parent.value);
    if (!oracle.ok) {
      io.writeErr(
        `${oracle.diagnostics
          .map((entry) => entry.code)
          .sort()
          .join("\n")}\n`,
      );
      return 4;
    }
    const execution = resolveExecutionReviewContextV1(parent.value);
    if (!execution.ok) {
      io.writeErr(boundedIssues(execution.issues));
      return 4;
    }
    const [campaign, capabilities] = await Promise.all([
      createLocalExecutionCampaignV1(parent.value, seed),
      discoverCapabilities(),
    ]);
    const executed = await executeReadinessCampaign({
      parent: parent.value,
      execution: execution.value,
      oracle: oracle.value,
      campaign,
      target: "c64",
      policy: POLICY,
      capabilities,
    });
    if (!executed.ok) {
      io.writeErr(boundedIssues(executed.issues));
      return 1;
    }
    const written = await writeExecutionAuthorityReportV1(io.cwd, executed.value);
    const output = `${JSON.stringify({
      revision: "execution-campaign-summary-v1",
      report: EXECUTION_AUTHORITY_REPORT_PATH_V1,
      ...executed.value.summary,
    })}\n`;
    io.writeOut(output);
    if (!written.ok) {
      io.writeErr(boundedIssues(written.issues));
      return 4;
    }
    if (executed.value.summary.status === "unavailable") {
      io.writeErr(
        `${executed.value.summary.blockers
          .filter((blocker) => blocker.startsWith("tier-unavailable:"))
          .join("\n")}\n`,
      );
      return 3;
    }
    if (executed.value.summary.status === "failure") {
      io.writeErr(
        `${executed.value.summary.blockers
          .filter((blocker) => blocker.startsWith("execution-failure:"))
          .join("\n")}\n`,
      );
      return 1;
    }
    return 0;
  } catch {
    io.writeErr("execution.io:\n");
    return 4;
  }
}

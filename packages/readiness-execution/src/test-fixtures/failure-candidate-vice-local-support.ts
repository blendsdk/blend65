import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

type Api = Readonly<Record<string, unknown>>;
type Data = Readonly<Record<string, unknown>>;
type ExecutionTierV1 = "frontend" | "compiler-api" | "cli" | "emit" | "acme" | "vice";

interface WorkerRequestV1 {
  readonly tier: "frontend" | "compiler-api" | "cli" | "emit";
  readonly caseIdentity: string;
}

interface SelectedProcessTraceV1 {
  readonly category: "acme" | "vice-launcher" | "other";
  readonly start: "ok" | "failure";
  readonly failureCode: string | null;
  completion?: {
    readonly exitCode: number | null;
    readonly signal: string | null;
  };
}

interface DiagnosticOutcomeV1 {
  readonly code: string;
  readonly phase: "lexer" | "parser" | "semantic" | "sfa";
  readonly severity: "error";
}

/** Shared state observed by the local VICE fixture. */
export interface FailureCandidateViceLocalControllerV1 {
  readonly scenario:
    | "standalone-stable"
    | "direct-shrink-stable"
    | "sequence-only"
    | "flaky"
    | "infrastructure-with-passing-control";
  failingPosition: number;
  readonly sequenceLength: number;
  subjectTier: ExecutionTierV1;
  readonly rejectOwnedShutdownOrdinal?: number;
  readonly activity: {
    readonly workerThreads: number[];
    readonly isolateIdentities: `sha256:${string}`[];
    readonly rootIdentities: `sha256:${string}`[];
    readonly processLaunches: number[];
    readonly workerRequests: {
      readonly caseIdentity: string;
      readonly tier: WorkerRequestV1["tier"];
      readonly workerIdentity: number;
      readonly dedicated: boolean;
    }[];
    readonly ownedShutdownAttempts: number[];
    readonly viceLauncherInjections: number[];
    readonly viceLauncherArmTransitions: ("armed" | "consumed")[];
  };
  phase: "report" | "candidate";
  freshOrdinal: number;
  candidateIdentity?: string;
  reportFailureIdentity?: string;
  reportRoutePosition: number;
  armedProcessTier?: "acme" | "vice";
  armedProcessOrdinal: number;
  ownedExecutorOrdinal: number;
  rejectedOwnedShutdown: boolean;
  readonly diagnosticOutcomes: Map<string, DiagnosticOutcomeV1>;
  selectedDiagnosticOutcome?: DiagnosticOutcomeV1;
  viceLauncherInjectionCount: number;
  readonly selectedWorkerTiers: WorkerRequestV1["tier"][];
  selectedEmitCompletion?: Data;
  readonly selectedProcessTrace: SelectedProcessTraceV1[];
  protocolApis?: Readonly<{
    readonly execution: Api;
    readonly internals: Api;
    readonly readiness: Api;
    readonly reduction: Api;
    readonly reports: Api;
    readonly published: Api;
  }>;
}

let activeController: FailureCandidateViceLocalControllerV1 | undefined;
let activeShim:
  | {
      readonly directory: string;
      readonly markers: readonly [string, string];
      readonly consumed: readonly [string, string];
      readonly audit: string;
      readonly originalPath: string;
      synchronizedInjections: number;
    }
  | undefined;

function callable(api: Api, name: string): (...arguments_: readonly unknown[]) => unknown {
  const value = api[name];
  if (typeof value !== "function") throw new TypeError(`missing callable ${name}`);
  return value as (...arguments_: readonly unknown[]) => unknown;
}

function recordValue(value: unknown, message: string): Data {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(message);
  }
  return value as Data;
}

function controller(): FailureCandidateViceLocalControllerV1 {
  if (activeController === undefined) throw new TypeError("local VICE controller unavailable");
  return activeController;
}

function installViceExecutableShim(): void {
  if (activeShim !== undefined) throw new TypeError("local VICE shim already active");
  const resolved = spawnSync("which", ["x64sc"], { encoding: "utf8", timeout: 5_000 });
  const candidate = resolved.status === 0 ? resolved.stdout.trim() : "";
  if (candidate.length === 0) throw new TypeError("canonical VICE executable unavailable");
  const realVice = realpathSync(candidate);
  const directory = mkdtempSync(join(tmpdir(), "blend65-vice-shim-"));
  const markers = [join(directory, "inject.marker.1"), join(directory, "inject.marker.2")] as const;
  const consumed = [
    join(directory, "inject.consumed.1"),
    join(directory, "inject.consumed.2"),
  ] as const;
  const audit = join(directory, "inject.audit");
  const executable = join(directory, "x64sc");
  writeFileSync(audit, "", { encoding: "utf8", mode: 0o600 });
  const source = `#!${process.execPath}
const { appendFileSync, existsSync, renameSync } = require("node:fs");
const markers = ${JSON.stringify(markers)};
const consumed = ${JSON.stringify(consumed)};
const environment = {};
for (const name of ["LANG", "LC_ALL", "TZ"]) {
  if (typeof process.env[name] === "string") environment[name] = process.env[name];
}
if (typeof process.env.DISPLAY === "string") environment.DISPLAY = process.env.DISPLAY;
const delegate = () => process.execve(
  ${JSON.stringify(realVice)},
  [${JSON.stringify(realVice)}, ...process.argv.slice(2)],
  environment,
);
if (process.argv.slice(2).includes("--version")) delegate();
if (markers.some((marker) => existsSync(marker))) {
  const arguments_ = process.argv.slice(2);
  const address = (value) => {
    const match = /^127\\.0\\.0\\.1:([1-9][0-9]{0,4})$/.exec(value);
    if (match === null) return null;
    const port = Number(match[1]);
    return port <= 65535 ? port : null;
  };
  const firstPort = address(arguments_[2]);
  const secondPort = address(arguments_[5]);
  const routeLaunch =
    arguments_.length === 10 &&
    arguments_[0] === "-binarymonitor" &&
    arguments_[1] === "-binarymonitoraddress" &&
    firstPort !== null &&
    arguments_[3] === "-remotemonitor" &&
    arguments_[4] === "-remotemonitoraddress" &&
    secondPort !== null &&
    firstPort !== secondPort &&
    arguments_[6] === "+sound" &&
    arguments_[7] === "-warp" &&
    arguments_[8] === "-console" &&
    arguments_[9] === "-silent";
  if (!routeLaunch) {
    appendFileSync(${JSON.stringify(audit)}, "other\\n", { encoding: "utf8", mode: 0o600 });
    process.exit(126);
  }
  for (let index = 0; index < markers.length; index += 1) {
    try {
      renameSync(markers[index], consumed[index]);
      appendFileSync(${JSON.stringify(audit)}, "route-launch\\n", {
        encoding: "utf8",
        mode: 0o600,
      });
      process.exit(127);
    } catch (error) {
      if (error === null || typeof error !== "object" || error.code !== "ENOENT") throw error;
    }
  }
}
delegate();
`;
  writeFileSync(executable, source, { encoding: "utf8", mode: 0o700 });
  chmodSync(executable, 0o700);
  const originalPath = process.env.PATH ?? "";
  process.env.PATH = `${directory}${delimiter}${originalPath}`;
  activeShim = {
    directory,
    markers,
    consumed,
    audit,
    originalPath,
    synchronizedInjections: 0,
  };
}

/** Arms exactly one future canonical VICE executable launch. */
export function armFailureCandidateViceShimV1(): void {
  const shim = activeShim;
  const current = controller();
  if (shim === undefined) throw new TypeError("local VICE shim unavailable");
  if (shim.markers.some((marker) => existsSync(marker))) {
    throw new TypeError("local VICE shim already armed");
  }
  for (const consumed of shim.consumed) {
    if (existsSync(consumed)) unlinkSync(consumed);
  }
  for (const marker of shim.markers) {
    writeFileSync(marker, "armed\n", { encoding: "utf8", flag: "wx", mode: 0o600 });
  }
  current.activity.viceLauncherArmTransitions.push("armed");
}

/** Synchronizes bounded external audit evidence into the fixture activity projection. */
export async function synchronizeFailureCandidateViceShimV1(): Promise<
  Readonly<{
    readonly injectionCount: number;
    readonly markerPresent: boolean;
    readonly consumedPresent: boolean;
  }>
> {
  const shim = activeShim;
  const current = controller();
  if (shim === undefined) throw new TypeError("local VICE shim unavailable");
  const expectedAttempts = (shim.synchronizedInjections + 1) * 2;
  const deadline = Date.now() + 15_000;
  let auditedAttempts = 0;
  for (;;) {
    const auditText = readFileSync(shim.audit, "utf8");
    const auditLines = auditText.split("\n").filter((line) => line.length > 0);
    if (auditLines.some((line) => line === "other")) {
      throw new TypeError("local VICE shim armed non-route invocation");
    }
    if (auditLines.some((line) => line !== "route-launch")) {
      throw new TypeError("local VICE shim audit category");
    }
    auditedAttempts = auditLines.length;
    const markerPresent = shim.markers.some((marker) => existsSync(marker));
    const consumedPresent = shim.consumed.every((consumed) => existsSync(consumed));
    if (auditedAttempts === expectedAttempts && !markerPresent && consumedPresent) break;
    if (
      auditedAttempts > expectedAttempts ||
      auditedAttempts < shim.synchronizedInjections * 2 ||
      Date.now() >= deadline
    ) {
      throw new TypeError("local VICE shim audit bounds");
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 25));
  }
  const injectionCount = auditedAttempts / 2;
  while (shim.synchronizedInjections < injectionCount) {
    shim.synchronizedInjections += 1;
    current.viceLauncherInjectionCount = shim.synchronizedInjections;
    current.activity.viceLauncherInjections.push(shim.synchronizedInjections);
    current.activity.viceLauncherArmTransitions.push("consumed");
  }
  return Object.freeze({
    injectionCount,
    markerPresent: shim.markers.some((marker) => existsSync(marker)),
    consumedPresent: shim.consumed.every((consumed) => existsSync(consumed)),
  });
}

/** Installs the controller and private executable shim used by one local VICE fixture. */
export function activateFailureCandidateViceControllerV1(
  value: FailureCandidateViceLocalControllerV1,
): void {
  if (activeController !== undefined) throw new TypeError("local VICE controller already active");
  activeController = value;
  try {
    installViceExecutableShim();
  } catch (error) {
    activeController = undefined;
    throw error;
  }
}

/** Restores the executable path and releases the local controller. */
export async function closeFailureCandidateViceControllerV1(
  value: FailureCandidateViceLocalControllerV1,
): Promise<void> {
  const shim = activeShim;
  if (shim !== undefined) {
    process.env.PATH = shim.originalPath;
    rmSync(shim.directory, { recursive: true, force: true });
    activeShim = undefined;
  }
  if (activeController === value) activeController = undefined;
}

function toolVersion(name: "acme" | "x64sc"): {
  readonly available: boolean;
  readonly text: string;
} {
  const result = spawnSync(name, ["--version"], {
    encoding: "utf8",
    timeout: 5_000,
  });
  const code =
    typeof result.error === "object" && result.error !== null
      ? Reflect.get(result.error, "code")
      : undefined;
  return {
    available: code !== "ENOENT",
    text: `${result.stdout ?? ""}\n${result.stderr ?? ""}`,
  };
}

/** Whether the local platform exposes the true external VICE boundary. */
export function hasFailureCandidateViceLocalRuntimeV1(): boolean {
  return (
    process.platform === "linux" &&
    typeof Reflect.get(process, "execve") === "function" &&
    toolVersion("acme").available &&
    toolVersion("x64sc").available
  );
}

/** Requires the exact reviewed local ACME and VICE versions when both tools are present. */
export function assertFailureCandidateViceLocalVersionsV1(): void {
  const acme = toolVersion("acme");
  const vice = toolVersion("x64sc");
  if (!acme.available || !vice.available || !hasFailureCandidateViceLocalRuntimeV1()) {
    throw new TypeError("local VICE runtime unavailable");
  }
  if (!/\b0\.97\b/u.test(acme.text)) throw new TypeError("local ACME version must be 0.97");
  if (!/\b3\.10\b/u.test(vice.text)) throw new TypeError("local VICE version must be 3.10");
}

/** Public-only result of preparing one genuine selected VICE route without launching VICE. */
export interface FailureCandidateVicePreparationDiagnosticV1 {
  readonly caseIdentity: string;
  readonly routeCaseIdentity: string;
  readonly controlCaseIdentity: string;
  readonly routeRankDigest: string;
  readonly subjectPosition: number;
  readonly controlPosition: number;
  readonly sameFixtureContract: boolean;
  readonly ok: boolean;
  readonly issue: {
    readonly code: string;
    readonly path: string | null;
    readonly message: string | null;
  } | null;
  readonly controlPreparation: {
    readonly ok: boolean;
    readonly issue: {
      readonly code: string;
      readonly path: string | null;
      readonly message: string | null;
    } | null;
  };
}

function operationValue<T>(result: unknown): T {
  if (typeof result !== "object" || result === null || Reflect.get(result, "ok") !== true) {
    const issues =
      typeof result === "object" && result !== null ? Reflect.get(result, "issues") : undefined;
    throw new TypeError(JSON.stringify(Array.isArray(issues) ? issues : []));
  }
  return Reflect.get(result, "value") as T;
}

function invoke<T>(api: Api, name: string, ...arguments_: readonly unknown[]): T {
  return Reflect.apply(callable(api, name), undefined, arguments_) as T;
}

/** Prepares one bounded same-contract VICE pair through the normal graph without exporting artifacts. */
export async function diagnoseFailureCandidateVicePreparationV1(): Promise<FailureCandidateVicePreparationDiagnosticV1> {
  assertFailureCandidateViceLocalVersionsV1();
  const catalogFixtures =
    (await import("./execution-publication-catalog-spec-fixture.js")) as unknown as Api;
  const readiness = (await import("@blend65/readiness")) as unknown as Api;
  const published = (await import("@blend65/readiness/published-oracle")) as unknown as Api;
  const campaignIdentity =
    (await import("@blend65/readiness/execution-campaign-identity")) as unknown as Api;
  const execution = (await import("../index.js")) as unknown as Api;
  const catalog = await invoke<
    Promise<{
      readonly parentDigest: string;
      readonly release: object;
      readonly repositoryRoot: string;
      cleanup(): Promise<void>;
    }>
  >(catalogFixtures, "createExecutionPublicationCatalogFixtureV1");
  try {
    const parent = operationValue<object>(
      await invoke<Promise<unknown>>(readiness, "resolvePublishedSnapshotByDigest", {
        repositoryRoot: catalog.repositoryRoot,
        publicationDigest: catalog.parentDigest,
      }),
    );
    const campaign = operationValue<object>(
      invoke<unknown>(campaignIdentity, "createPublishedExecutionCampaignV1", parent, {
        schemaVersion: 1,
        target: "c64",
        seed: `sha256:${"7".repeat(64)}`,
        configuration: {
          caseCount: 26,
          maxInvalidCases: 0,
          enabledRuleIds: [
            "rule.ch12.3-1-memory-access.peek-addr.signature.word",
            "rule.ch12.3-1-memory-access.peekw-addr.signature.word",
            "rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte",
            "rule.ch12.3-1-memory-access.pokew-addr-val.signature.word-word",
          ],
          spellings: ["literal", "parameter"],
          budget: {
            maxModules: 4,
            maxDeclarations: 128,
            maxIrNodes: 512,
            maxStatements: 256,
            maxExpressionDepth: 16,
            maxLoopWork: 1n,
            maxSourceBytes: 65_536,
            maxAttempts: 128,
          },
        },
      }),
    );
    const policy = Object.freeze({
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
    const composite = operationValue<object>(
      invoke<unknown>(readiness, "resolveCompositeReadinessSnapshot", parent, catalog.release),
    );
    const parentProjection = operationValue<object>(
      invoke<unknown>(readiness, "getCompositeReadinessProjectionV1", composite),
    );
    const campaignProjection = operationValue<object>(
      invoke<unknown>(readiness, "projectExecutionCampaignV1", campaign),
    );
    const routePlan = operationValue<Data>(
      invoke<unknown>(execution, "planExecutionRoutesV1", {
        parent: parentProjection,
        campaign: campaignProjection,
        oracleDigest: catalog.parentDigest,
        policy,
      }),
    );
    const items = routePlan.items;
    if (!Array.isArray(items) || items.length !== 62) throw new TypeError("VICE route plan");
    const summary = recordValue(Reflect.get(campaign, "summary"), "campaign summary");
    const totalCaseCount = Number(summary.totalCaseCount);
    const findExecutionCase = (
      identity: unknown,
    ): { readonly authority: object; readonly identity: string; readonly fixture: unknown } => {
      for (let ordinal = 0; ordinal < totalCaseCount; ordinal += 1) {
        const created = invoke<unknown>(readiness, "createExecutionCaseV1", campaign, ordinal, {
          kind: "scalar-bytes",
          byteLength: 1,
        });
        if (
          typeof created !== "object" ||
          created === null ||
          Reflect.get(created, "ok") !== true
        ) {
          continue;
        }
        const candidate = Reflect.get(created, "value");
        const projection = invoke<unknown>(readiness, "getExecutionCaseProjectionV1", candidate);
        if (
          typeof projection !== "object" ||
          projection === null ||
          Reflect.get(projection, "ok") !== true
        ) {
          continue;
        }
        const projected = recordValue(
          Reflect.get(projection, "value"),
          "execution case projection",
        );
        if (projected.sourceCaseDigest !== identity) continue;
        return Object.freeze({
          authority: candidate as object,
          identity: String(projected.sourceCaseDigest),
          fixture: projected.fixture,
        });
      }
      throw new TypeError("selected VICE execution case");
    };
    const selectedRoute = recordValue(items[10], "selected VICE route");
    const routeCaseIdentity = String(selectedRoute.caseIdentity);
    const controlCaseIdentity = routeCaseIdentity;
    const routeRankDigest = String(selectedRoute.rankDigest);
    const subjectCase = findExecutionCase(routeCaseIdentity);
    const controlCase = subjectCase;
    const oracle = operationValue<object>(
      invoke<unknown>(published, "createPublishedOracleContext", parent),
    );
    const prepare = async (executionCase: object) => {
      const evaluation = operationValue<object>(
        invoke<unknown>(
          readiness,
          "createPublishedRuntimeEvaluationAuthorityV1",
          oracle,
          executionCase,
        ),
      );
      const prepared = await invoke<Promise<unknown>>(
        execution,
        "prepareEvaluatedViceRouteV1",
        executionCase,
        evaluation,
        policy,
        AbortSignal.timeout(120_000),
      );
      const ok =
        typeof prepared === "object" && prepared !== null && Reflect.get(prepared, "ok") === true;
      const issues =
        typeof prepared === "object" && prepared !== null
          ? Reflect.get(prepared, "issues")
          : undefined;
      const firstIssue = Array.isArray(issues) ? issues[0] : undefined;
      const issue =
        typeof firstIssue === "object" && firstIssue !== null
          ? Object.freeze({
              code: String(Reflect.get(firstIssue, "code")),
              path:
                typeof Reflect.get(firstIssue, "path") === "string"
                  ? String(Reflect.get(firstIssue, "path"))
                  : null,
              message:
                typeof Reflect.get(firstIssue, "message") === "string"
                  ? String(Reflect.get(firstIssue, "message"))
                  : null,
            })
          : null;
      return Object.freeze({ ok, issue });
    };
    const subjectPreparation = await prepare(subjectCase.authority);
    const controlPreparation = await prepare(controlCase.authority);
    return Object.freeze({
      caseIdentity: subjectCase.identity,
      routeCaseIdentity,
      controlCaseIdentity,
      routeRankDigest,
      subjectPosition: 11,
      controlPosition: 11,
      sameFixtureContract:
        JSON.stringify(subjectCase.fixture) === JSON.stringify(controlCase.fixture),
      ok: subjectPreparation.ok,
      issue: subjectPreparation.issue,
      controlPreparation,
    });
  } finally {
    await catalog.cleanup();
  }
}

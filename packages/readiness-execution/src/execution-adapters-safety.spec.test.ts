import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  compile,
  compileWithEvidence,
  emitAsm,
  emitAsmWithEvidence,
  emitIl,
  emitIlWithEvidence,
  invokeAcme,
  type CompileResult,
  type CompilerEvidenceFacadeV1,
} from "@blend65/compiler";
import { runCli } from "@blend65/cli";
import {
  createDiagnosticBag,
  renderJson,
  type AstNode,
  type Scope,
  type SemanticModel,
  type SourceMap,
  type Symbol as SemanticSymbol,
  type Type,
} from "@blend65/core";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import {
  SPEC_POLICY,
  createGenuineDiagnosticFixture,
  createGenuineRouteFixture,
  createOwnershipProbe,
  createProcessKernelHarness,
  ownsNothing,
  scriptedDiagnosticWorker,
  scriptedProcess,
  scriptedWorker,
  successfulWorkerResponse,
  type Cancellation,
  type DiagnosticRouteRequest,
  type DiagnosticRouteApi,
  type GenuineDiagnosticFixture,
  type GenuineRouteFixture,
  type PublishedDiagnosticApi,
  type ControlRead,
  type ProcessKernelApi,
  type ProcessRequest,
  type ProcessRuntime,
  type RouteApi,
  type RouteRequest,
  type ScriptedProcess,
  type WorkerExecutor,
  type WorkerRequest,
} from "./test-fixtures/execution-adapters-safety-spec-fixture.js";
import {
  parseReplayEnvelope,
  type ExecutionOperationResultV1,
  type ExecutionPolicyV1,
  type ExecutionResultV1,
  type ExecutionStageV1,
  type ExecutionUsageV1,
} from "@blend65/readiness";

interface Workspace {
  readonly root: string;
  readonly identity: { readonly device: bigint; readonly inode: bigint; readonly uid: number };
  resolveRegularFile(relativePath: string): Promise<string>;
  dispose(): Promise<void>;
}

interface Supervisor {
  createWorkspace(): Promise<ExecutionOperationResultV1<Workspace>>;
  runWorker(request: WorkerRequest): Promise<ExecutionOperationResultV1<unknown>>;
  runProcess(request: ProcessRequest): Promise<ExecutionOperationResultV1<unknown>>;
  cleanup(): Promise<ExecutionOperationResultV1<{ readonly ok: boolean }>>;
}

interface TimeRuntime {
  monotonicNow(): number;
  waitUntil(deadline: number, signal: AbortSignal): Promise<"deadline" | "cancelled">;
}

interface SupervisorDependencies {
  readonly time?: TimeRuntime;
  readonly workspaceProvider?: {
    create(): Promise<ExecutionOperationResultV1<Workspace>>;
  };
  readonly workerExecutor?: WorkerExecutor;
  readonly processRuntime?: ProcessRuntime;
  readonly runtimeDirectory?: string;
}

interface EvidenceLedger {
  append(bytes: Uint8Array): ExecutionOperationResultV1<{
    readonly digest: string;
    readonly retainedBytes: number;
    readonly truncated: boolean;
  }>;
  summarize(): {
    readonly digest: string;
    readonly retainedBytes: number;
    readonly truncated: boolean;
  };
}

type DiagnosticClassificationResult =
  | { readonly status: "pass"; readonly code: "pass" }
  | {
      readonly status: "failure";
      readonly code: "diagnostic-mismatch" | "unexpected-emission";
    };

interface BudgetScope {
  readonly deadline: {
    readonly hardDeadlineMs: number;
    readonly workDeadlineMs: number;
    readonly cleanupGraceMs: number;
  };
  beginOperation(stage: ExecutionStageV1, now: number): ExecutionOperationResultV1<Cancellation>;
  beginLaunchAttempt(
    now: number,
  ): ExecutionOperationResultV1<{ readonly ordinal: number; readonly deadlineMonotonicMs: number }>;
  chargeOutput(bytes: number): ExecutionOperationResultV1<ExecutionUsageV1>;
  chargeEvidence(bytes: number): ExecutionOperationResultV1<ExecutionUsageV1>;
  chargeInstructions(count: number): ExecutionOperationResultV1<ExecutionUsageV1>;
  beginStopwatch(sample: unknown): ExecutionOperationResultV1<ExecutionUsageV1>;
  completeStopwatch(sample: unknown): ExecutionOperationResultV1<ExecutionUsageV1>;
  snapshot(now: number): ExecutionOperationResultV1<ExecutionUsageV1>;
}

interface ExecutionApi extends RouteApi, ProcessKernelApi {
  readonly classifyDiagnosticRouteEvidenceV1: (
    authority: unknown,
    observed: unknown,
  ) => ExecutionOperationResultV1<DiagnosticClassificationResult>;
  readonly parseExecutionWorkerResponseV1: (
    request: WorkerRequest,
    value: unknown,
  ) => ExecutionOperationResultV1<unknown>;
  readonly createExecutionRouteHandlersV1: (dependencies: {
    readonly worker: { readonly executor: WorkerExecutor };
    readonly acme: { readonly runner: { run(...args: readonly unknown[]): Promise<unknown> } };
    readonly lifecycle: { readonly supervisor: Supervisor };
    readonly vice: {
      readonly execute: (...args: readonly unknown[]) => Promise<ExecutionResultV1>;
    };
  }) => Readonly<
    Record<
      "frontend" | "compiler-api" | "cli" | "emit" | "acme" | "vice",
      {
        execute(
          request: RouteRequest | DiagnosticRouteRequest,
          cancellation: Cancellation,
        ): Promise<ExecutionResultV1>;
      }
    >
  >;
  readonly createExecutionSupervisorV1: (
    policy: ExecutionPolicyV1,
    dependencies?: SupervisorDependencies,
  ) => ExecutionOperationResultV1<Supervisor>;
  readonly createExecutionEvidenceLedgerV1: (
    limit: number,
  ) => ExecutionOperationResultV1<EvidenceLedger>;
  readonly createExecutionBudgetScopeV1: (
    policy: ExecutionPolicyV1,
    startedAt: number,
  ) => ExecutionOperationResultV1<BudgetScope>;
}

interface CompilerPhaseApi {
  readonly invokeBoundedAcmeV1: (
    request: AcmeInvocation,
    runner: { run(request: AcmeInvocation, controls: AcmeControls): Promise<AcmeRunOutput> },
    controls: AcmeControls,
  ) => Promise<AcmeRunOutput>;
}

interface AcmeInvocation {
  readonly acmeExe: string;
  readonly asmPath: string;
  readonly binaryPath: string;
  readonly labelPath: string;
  readonly reportPath: string;
  readonly cwd: string;
}

interface AcmeControls {
  readonly signal: AbortSignal;
  readonly deadlineMonotonicMs: number;
  readonly onStdout: (bytes: Uint8Array) => void;
  readonly onStderr: (bytes: Uint8Array) => void;
}

interface AcmeRunOutput {
  readonly exitCode: number;
  readonly stderr: string;
}

const REQUIRED_EXECUTION_EXPORTS = [
  "createExecutionRouteRequestV1",
  "parseExecutionWorkerResponseV1",
  "createExecutionRouteHandlersV1",
  "createExecutionSupervisorV1",
  "createExecutionEvidenceLedgerV1",
  "createExecutionBudgetScopeV1",
] as const;
const REQUIRED_PROCESS_KERNEL_EXPORTS = [
  "createExecutionProcessRuntimeV1",
  "runExecutionProcessAnchorV1",
] as const;
const REQUIRED_DIAGNOSTIC_EXECUTION_EXPORTS = ["classifyDiagnosticRouteEvidenceV1"] as const;
const REQUIRED_PUBLISHED_DIAGNOSTIC_EXPORTS = [
  "createPublishedDiagnosticCaseV1",
  "getPublishedDiagnosticCaseProjectionV1",
] as const;
const ENCODER = new TextEncoder();
const temporaryRoots: string[] = [];
const cancellation: Cancellation = {
  signal: new AbortController().signal,
  deadlineMonotonicMs: 10_000,
};

let execution: ExecutionApi;
let compilerPhase: CompilerPhaseApi;
let genuine: GenuineRouteFixture;
let missingExports: readonly string[] = [];
let publishedDiagnostic: PublishedDiagnosticApi;
let diagnosticRouteApi: DiagnosticRouteApi;
let diagnosticFixturePromise: Promise<GenuineDiagnosticFixture> | undefined;
let missingDiagnosticExports: readonly string[] = [];
let missingProcessKernelExports: readonly string[] = [];

function kernelSink() {
  const stdout: Uint8Array[] = [];
  const stderr: Uint8Array[] = [];
  return {
    stdout,
    stderr,
    sink: {
      onStdout: (bytes: Uint8Array) => stdout.push(Uint8Array.from(bytes)),
      onStderr: (bytes: Uint8Array) => stderr.push(Uint8Array.from(bytes)),
    },
  };
}

function kernelRequest(overrides: Partial<ProcessRequest> = {}): ProcessRequest {
  return {
    executable: "/usr/bin/spec-tool",
    argv: ["--mode", "safe"],
    cwd: "/owned/case",
    deadline: { hardDeadlineMs: 10_000, workDeadlineMs: 9_000, cleanupGraceMs: 1_000 },
    ...overrides,
  };
}

function decodeControlFrame(bytes: Uint8Array): Record<string, unknown> {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  expect(text.endsWith("\n")).toBe(true);
  expect(text.slice(0, -1)).not.toContain("\n");
  expect(text.endsWith("\n\n")).toBe(false);
  const value = JSON.parse(text.slice(0, -1)) as Record<string, unknown>;
  expect(`${JSON.stringify(value)}\n`).toBe(text);
  return value;
}

function frameKinds(frames: readonly Uint8Array[]): string[] {
  return frames.map((bytes) => String(decodeControlFrame(bytes).kind));
}

async function expectPromisePending(promise: Promise<unknown>): Promise<void> {
  const marker = Symbol("pending");
  expect(await Promise.race([promise, Promise.resolve(marker)])).toBe(marker);
}

function requireSuccess<T>(result: ExecutionOperationResultV1<T>): T {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new TypeError(JSON.stringify(result.issues));
  return result.value;
}

function expectFailure(result: ExecutionOperationResultV1<unknown>, code: string): void {
  expect(result.ok).toBe(false);
  if (result.ok) throw new TypeError("expected a rejected operation");
  expect(result.issues.some((issue) => issue.code === code)).toBe(true);
  expect(result).not.toHaveProperty("value");
}

function policy(overrides: Partial<ExecutionPolicyV1["budget"]>): ExecutionPolicyV1 {
  return {
    revision: "execution-policy-v1",
    budget: { ...SPEC_POLICY.budget, ...overrides },
  };
}

function immediateDeadline(now = 0): TimeRuntime {
  return {
    monotonicNow: () => now,
    waitUntil: async (_deadline, signal) => (signal.aborted ? "cancelled" : "deadline"),
  };
}

function inertViceResult(): ExecutionResultV1 {
  return {
    status: "failure",
    tier: "vice",
    stage: "vice-launch",
    code: "tier-unavailable",
    usage: {
      wallMs: 0,
      outputBytes: 0,
      evidenceBytes: 0,
      instructions: 0,
      cycles: 0,
      launchAttempts: 0,
    },
    evidence: {
      digest: `sha256:${"0".repeat(64)}`,
      retainedBytes: 0,
      truncated: false,
    },
  };
}

function createSupervisor(
  selectedPolicy: ExecutionPolicyV1,
  dependencies?: SupervisorDependencies,
): Supervisor {
  return requireSuccess(execution.createExecutionSupervisorV1(selectedPolicy, dependencies));
}

function createHandlers(worker: WorkerExecutor, supervisor: Supervisor, acmeRunner?: object) {
  return execution.createExecutionRouteHandlersV1({
    worker: { executor: worker },
    acme: {
      runner: (acmeRunner as
        | { run(...args: readonly unknown[]): Promise<unknown> }
        | undefined) ?? { run: async () => ({ exitCode: 0, stderr: "" }) },
    },
    lifecycle: { supervisor },
    vice: { execute: async () => inertViceResult() },
  });
}

function sha256(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function nodeProjection(node: AstNode): object {
  return {
    kind: node.kind,
    span: {
      sourceId: node.span.sourceId,
      start: node.span.start,
      end: node.span.end,
    },
  };
}

function typeProjection(type: Type): object {
  switch (type.kind) {
    case "primitive":
      return { kind: type.kind, name: type.name };
    case "array":
      return { kind: type.kind, element: typeProjection(type.element), size: type.size };
    case "struct":
      return {
        kind: type.kind,
        name: type.name,
        declaration: nodeProjection(type.decl),
        fields: [...type.fields].map(([name, field]) => ({
          name,
          type: typeProjection(field.type),
          offset: field.offset,
        })),
        byteSize: type.byteSize,
      };
    case "enum":
      return {
        kind: type.kind,
        name: type.name,
        declaration: nodeProjection(type.decl),
        members: [...type.members],
      };
    case "error":
      return { kind: type.kind };
  }
}

function symbolProjection(symbol: SemanticSymbol | null): object | null {
  if (symbol === null) return null;
  return {
    name: symbol.name,
    kind: symbol.kind,
    type: typeProjection(symbol.type),
    declaration: nodeProjection(symbol.decl),
    scopeKind: symbol.scope.kind,
    exported: symbol.exported,
    mutable: symbol.mutable,
    storage: symbol.storage,
    constValue:
      symbol.constValue === undefined
        ? undefined
        : {
            type: typeProjection(symbol.constValue.type),
            value: symbol.constValue.value,
            bytes: symbol.constValue.bytes,
            source: symbol.constValue.source,
          },
    byRef: symbol.byRef,
  };
}

function scopeProjection(scope: Scope): object {
  return {
    kind: scope.kind,
    parentKind: scope.parent?.kind ?? null,
    node: scope.node === null ? null : nodeProjection(scope.node),
    symbols: [...scope.symbols].map(([name, symbol]) => ({
      name,
      symbol: symbolProjection(symbol),
    })),
    children: scope.children.map(scopeProjection),
  };
}

function semanticProjection(model: SemanticModel): object {
  const queryNodes = new Set<AstNode>([
    ...model.typeMap.keys(),
    ...model.symbolMap.keys(),
    ...model.forLoopInfo.keys(),
  ]);
  return {
    ownKeys: Object.keys(model).sort(),
    globalScope: scopeProjection(model.globalScope),
    typeMap: [...model.typeMap].map(([node, type]) => ({
      node: nodeProjection(node),
      type: typeProjection(type),
    })),
    symbolMap: [...model.symbolMap].map(([node, symbol]) => ({
      node: nodeProjection(node),
      symbol: symbolProjection(symbol),
    })),
    forLoopInfo: [...model.forLoopInfo].map(([node, info]) => ({
      node: nodeProjection(node),
      wrapSafe: info.wrapSafe,
      evaluatedBound: info.evaluatedBound,
    })),
    callGraph: {
      functions: [...model.callGraph.functions].map(symbolProjection),
      edges: [...model.callGraph.edges].map(([caller, callees]) => ({
        caller: symbolProjection(caller),
        callees: [...callees].map(symbolProjection),
      })),
      cycles: model.callGraph.findCycles().map((cycle) => cycle.map(symbolProjection)),
    },
    initOrder: model.initOrder.map(symbolProjection),
    constValues: [...model.constValues].map(([symbol, value]) => ({
      symbol: symbolProjection(symbol),
      value: {
        type: typeProjection(value.type),
        value: value.value,
        bytes: value.bytes,
        source: value.source,
      },
    })),
    pairAccessedParams: [...model.pairAccessedParams].map(symbolProjection),
    addressTakenFunctions: [...model.addressTakenFunctions].map(symbolProjection),
    structTypes: [...model.structTypes].map(([name, type]) => ({
      name,
      type: typeProjection(type),
    })),
    enumTypes: [...model.enumTypes].map(([name, type]) => ({
      name,
      type: typeProjection(type),
    })),
    embeddedAssets: [...model.embeddedAssets],
    mainFunction: symbolProjection(model.mainFunction),
    hasErrors: model.hasErrors,
    queries: {
      types: [...model.typeMap.keys()].map((node) => ({
        node: nodeProjection(node),
        result: typeProjection(model.typeOf(node)),
      })),
      symbols: [...model.symbolMap.keys()].map((node) => ({
        node: nodeProjection(node),
        result: symbolProjection(model.symbolOf(node)),
      })),
      scopes: [...queryNodes].map((node) => {
        const scope = model.scopeOf(node);
        return {
          node: nodeProjection(node),
          result: {
            kind: scope.kind,
            node: scope.node === null ? null : nodeProjection(scope.node),
          },
        };
      }),
    },
  };
}

function sourceMapProjection(sourceMap: SourceMap, sourceText: string): object {
  const sourceId = 0;
  const lineMap = sourceMap.getLineMap(sourceId);
  const byteLength = ENCODER.encode(sourceText).byteLength;
  const offsets = [0, sourceText.indexOf("poke"), byteLength];
  return {
    ownKeys: Object.keys(sourceMap).sort(),
    hasSource: sourceMap.has(sourceId),
    hasNextSource: sourceMap.has(1),
    path: sourceMap.getPath(sourceId),
    content: sourceMap.getContent(sourceId),
    positions: offsets.map((offset) => ({
      offset,
      lineColumn: lineMap.getLineCol(offset),
      utf16Column: lineMap.getUtf16Column(offset),
      lineText: lineMap.getLineText(offset),
    })),
  };
}

function compileResultProjection(result: CompileResult, sourceText: string): object {
  return {
    ownKeys: Object.keys(result).sort(),
    hasErrors: result.hasErrors,
    diagnosticsJson: renderJson(result.diagnostics),
    config: result.config,
    sourceMap: sourceMapProjection(result.sourceMap, sourceText),
    semanticModel:
      result.semanticModel === undefined ? null : semanticProjection(result.semanticModel),
    allocationPlan: result.allocationPlan ?? null,
  };
}

function requirePhaseExports(): void {
  if (missingExports.length > 0) {
    throw new TypeError(`Missing adapter safety exports: ${missingExports.join(", ")}`);
  }
}

function requireDiagnosticExports(): void {
  if (missingDiagnosticExports.length > 0) {
    throw new TypeError(
      `Missing diagnostic authority exports: ${missingDiagnosticExports.join(", ")}`,
    );
  }
}

function requireProcessKernelExports(): void {
  if (missingProcessKernelExports.length > 0) {
    throw new TypeError(
      `Missing process kernel exports: ${missingProcessKernelExports.join(", ")}`,
    );
  }
}

async function requireGenuineDiagnosticFixture(): Promise<GenuineDiagnosticFixture> {
  requireDiagnosticExports();
  if (diagnosticFixturePromise === undefined) {
    throw new TypeError("diagnostic fixture was not initialized");
  }
  return diagnosticFixturePromise;
}

beforeAll(async () => {
  const [executionModule, compilerModule, publishedModule] = await Promise.all([
    vi.importActual<Partial<ExecutionApi>>("./index.js"),
    vi.importActual<Partial<CompilerPhaseApi>>("@blend65/compiler"),
    vi.importActual<Partial<PublishedDiagnosticApi>>("@blend65/readiness/published-oracle"),
  ]);
  missingExports = [
    ...REQUIRED_EXECUTION_EXPORTS.filter((name) => typeof executionModule[name] !== "function"),
    ...(typeof compilerModule.invokeBoundedAcmeV1 === "function" ? [] : ["invokeBoundedAcmeV1"]),
  ];
  missingProcessKernelExports = [
    ...REQUIRED_PROCESS_KERNEL_EXPORTS.filter(
      (name) => typeof executionModule[name] !== "function",
    ),
    ...(typeof executionModule.defaultExecutionProcessRuntimeV1?.start === "function"
      ? []
      : ["defaultExecutionProcessRuntimeV1"]),
    ...(executionModule.EXECUTION_PROCESS_KERNEL_LIMITS_V1 === undefined
      ? ["EXECUTION_PROCESS_KERNEL_LIMITS_V1"]
      : []),
  ];
  execution = executionModule as ExecutionApi;
  compilerPhase = compilerModule as CompilerPhaseApi;
  publishedDiagnostic = publishedModule as PublishedDiagnosticApi;
  diagnosticRouteApi = executionModule as DiagnosticRouteApi;
  missingDiagnosticExports = [
    ...REQUIRED_DIAGNOSTIC_EXECUTION_EXPORTS.filter(
      (name) => typeof executionModule[name] !== "function",
    ),
    ...REQUIRED_PUBLISHED_DIAGNOSTIC_EXPORTS.filter(
      (name) => typeof publishedModule[name] !== "function",
    ),
  ];
  if (missingExports.length === 0) {
    genuine = await createGenuineRouteFixture(execution);
  }
  if (missingExports.length === 0 && missingDiagnosticExports.length === 0) {
    diagnosticFixturePromise = createGenuineDiagnosticFixture(
      diagnosticRouteApi,
      publishedDiagnostic,
    );
  }
}, 120_000);

afterAll(async () => {
  await genuine?.cleanup();
  const completedDiagnosticFixture = await diagnosticFixturePromise?.catch(() => undefined);
  await completedDiagnosticFixture?.cleanup();
  await Promise.all(temporaryRoots.map((root) => rm(root, { recursive: true, force: true })));
});

describe("real adapters and bounded lifecycle", () => {
  it("sends one closed tier-specific request through the injected worker boundary", async () => {
    requirePhaseExports();
    const expectedContracts = {
      frontend: "frontend-pipeline-v1",
      "compiler-api": "compiler-evidence-facade-v1",
      cli: "blendc-cli-v1",
      emit: "assembly-emitter-v1",
    } as const;

    for (const tier of ["frontend", "compiler-api", "cli", "emit"] as const) {
      const probe = createOwnershipProbe();
      const worker = scriptedWorker("success", probe);
      const supervisor = createSupervisor(SPEC_POLICY, {
        workerExecutor: worker,
        time: immediateDeadline(),
      });
      const handlers = createHandlers(worker, supervisor);
      const result = await handlers[tier].execute(genuine.requests[tier], cancellation);

      expect(result).toMatchObject({ status: "pass", tier, code: "pass" });
      expect(worker.requests).toHaveLength(1);
      const request = worker.requests[0];
      expect(request).toMatchObject({
        revision: "execution-worker-request-v1",
        tier,
        contract: expectedContracts[tier],
        source: {
          revision: "execution-worker-source-v1",
          relativePath: expect.stringMatching(/\.blend$/u),
          digest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        },
      });
      expect(structuredClone(request)).toEqual(request);
      for (const forbidden of ["expected", "expectedDiagnostic", "oracle", "diagnosticTruth"]) {
        expect(request).not.toHaveProperty(forbidden);
      }
      expect(
        execution.parseExecutionWorkerResponseV1(request, successfulWorkerResponse(request)),
      ).toMatchObject({ ok: true });
      await supervisor.cleanup();
      expect(ownsNothing(probe)).toBe(true);
    }
  });

  it("keeps ordinary compiler, diagnostic, command-line, and assembler contracts unchanged", async () => {
    requirePhaseExports();
    const root = await mkdtemp(join(tmpdir(), "blend65-adapter-compat-"));
    temporaryRoots.push(root);
    const sourcePath = join(root, "main.blend");
    const source = "module Main;\nfunction main(): void {\n  poke(0xD020, 05);\n}\n";
    await writeFile(sourcePath, source);
    const options = {
      platform: "c64",
      cwd: root,
      sourceFiles: [sourcePath],
      warnAsError: true,
    };

    const ordinaryCompile = compile(options);
    const observedCompile = compileWithEvidence(options);
    expect(observedCompile.result).not.toBe(ordinaryCompile);
    expect(observedCompile.result.sourceMap).not.toBe(ordinaryCompile.sourceMap);
    expect(Object.keys(observedCompile.result).sort()).toEqual(Object.keys(ordinaryCompile).sort());
    expect(compileResultProjection(observedCompile.result, source)).toEqual(
      compileResultProjection(ordinaryCompile, source),
    );
    expect(ordinaryCompile).not.toHaveProperty("evidence");
    expect(observedCompile.result).not.toHaveProperty("evidence");
    expect(ordinaryCompile.hasErrors).toBe(true);
    expect(ordinaryCompile.diagnostics).toHaveLength(1);
    expect(renderJson(observedCompile.result.diagnostics)).toBe(
      renderJson(ordinaryCompile.diagnostics),
    );
    expect(
      observedCompile.evidence.entries.map(({ code, finalSeverity }) => ({
        code,
        severity: finalSeverity,
      })),
    ).toEqual(
      ordinaryCompile.diagnostics.map(({ code, severity }) => ({
        code,
        severity,
      })),
    );
    expect(observedCompile.evidence.entries).toEqual([
      expect.objectContaining({
        code: ordinaryCompile.diagnostics[0]?.code,
        phase: "lexer",
        finalSeverity: "error",
      }),
    ]);
    const ordinaryIl = emitIl(options);
    const observedIl = emitIlWithEvidence(options);
    const ordinaryAsm = emitAsm(options);
    const observedAsm = emitAsmWithEvidence(options);
    expect(observedIl.result.text).toBe(ordinaryIl.text);
    expect(observedAsm.result.text).toBe(ordinaryAsm.text);
    expect(renderJson(observedCompile.result.diagnostics)).toBe(
      renderJson(ordinaryCompile.diagnostics),
    );

    const outputA = join(root, "ordinary");
    const outputB = join(root, "evidence");
    const io = (cwd: string) => {
      const out: string[] = [];
      const err: string[] = [];
      return {
        out,
        err,
        io: {
          writeOut: (text: string) => out.push(text),
          writeErr: (text: string) => err.push(text),
          isTTY: false,
          env: {},
          cwd,
        },
      };
    };
    const first = io(root);
    const second = io(root);
    const argsA = ["check", sourcePath, "--platform", "c64", "--out-dir", outputA];
    const argsB = ["check", sourcePath, "--platform", "c64", "--out-dir", outputB];
    const firstCode = await runCli(argsA, first.io);
    const evidenceSeen = vi.fn();
    const secondCode = await runCli(argsB, second.io, {
      compilerFacade: {
        compile: compileWithEvidence,
        emitIl: emitIlWithEvidence,
        emitAsm: emitAsmWithEvidence,
        build: vi.fn(),
      } as CompilerEvidenceFacadeV1,
      evidenceObserver: { onDiagnosticEvidence: evidenceSeen },
    });
    expect(secondCode).toBe(firstCode);
    expect(second.out).toEqual(first.out);
    expect(second.err).toEqual(first.err);
    expect(await readdir(root)).toEqual(expect.arrayContaining(["main.blend"]));

    const invocation: AcmeInvocation = {
      acmeExe: "/tools/acme",
      asmPath: "/work/main.asm",
      binaryPath: "/work/main.prg",
      labelPath: "/work/main.lbl",
      reportPath: "/work/main.report",
      cwd: "/work",
    };
    const calls: unknown[][] = [];
    const legacyRunner = {
      run: async (exe: string, argv: readonly string[], cwd: string) => {
        calls.push([exe, argv, cwd]);
        return { exitCode: 0, stderr: "" };
      },
      binarySize: () => 42,
    };
    const bag = createDiagnosticBag();
    expect(await invokeAcme(invocation, bag, legacyRunner)).toMatchObject({
      success: true,
      binarySize: 42,
    });
    expect(calls).toEqual([
      [
        "/tools/acme",
        ["--vicelabels", "/work/main.lbl", "--report", "/work/main.report", "/work/main.asm"],
        "/work",
      ],
    ]);
    const boundedCalls: unknown[] = [];
    const boundedControls: AcmeControls = {
      signal: cancellation.signal,
      deadlineMonotonicMs: 10_000,
      onStdout: vi.fn(),
      onStderr: vi.fn(),
    };
    await compilerPhase.invokeBoundedAcmeV1(
      invocation,
      {
        run: async (request, controls) => {
          boundedCalls.push([request, controls]);
          return { exitCode: 0, stderr: "" };
        },
      },
      boundedControls,
    );
    expect(boundedCalls).toEqual([[invocation, boundedControls]]);
  });

  it("distinguishes absent assembler discovery from an invoked assembler failure", async () => {
    requirePhaseExports();
    const worker = scriptedWorker("success", createOwnershipProbe());
    const missingSupervisor = createSupervisor(SPEC_POLICY, {
      workerExecutor: worker,
      time: immediateDeadline(),
    });
    const missing = createHandlers(worker, missingSupervisor, {
      run: async () => {
        throw Object.assign(new Error("not found"), { code: "ENOENT" });
      },
    });
    expect(await missing.acme.execute(genuine.requests.acme, cancellation)).toMatchObject({
      status: "failure",
      code: "tier-unavailable",
      stage: "acme",
    });

    const failingWorker = scriptedWorker("success", createOwnershipProbe());
    const failingSupervisor = createSupervisor(SPEC_POLICY, {
      workerExecutor: failingWorker,
      time: immediateDeadline(),
    });
    const failing = createHandlers(failingWorker, failingSupervisor, {
      run: async () => ({ exitCode: 1, stderr: "syntax error" }),
    });
    expect(await failing.acme.execute(genuine.requests.acme, cancellation)).toMatchObject({
      status: "failure",
      code: "assembler-failure",
      stage: "acme",
    });
  });

  it("terminates hung, crashed, and malformed workers without a parent-side fallback", async () => {
    requirePhaseExports();
    for (const tier of ["frontend", "compiler-api", "cli", "emit"] as const) {
      for (const mode of ["hang", "crash", "malformed"] as const) {
        const probe = createOwnershipProbe();
        const worker = scriptedWorker(mode, probe);
        const workspaceRoot = `/owned/${tier}-${mode}`;
        const workspace: Workspace = {
          root: workspaceRoot,
          identity: { device: 1n, inode: 2n, uid: 3 },
          resolveRegularFile: async (path) => `${workspaceRoot}/${path}`,
          dispose: async () => {
            probe.workspaces.delete(workspaceRoot);
          },
        };
        const supervisor = createSupervisor(SPEC_POLICY, {
          workerExecutor: worker,
          time: immediateDeadline(),
          workspaceProvider: {
            create: async () => {
              probe.workspaces.add(workspaceRoot);
              return { ok: true, value: workspace };
            },
          },
        });
        const result = await createHandlers(worker, supervisor)[tier].execute(
          genuine.requests[tier],
          cancellation,
        );
        expect(result).toMatchObject({
          status: "failure",
          code: mode === "hang" ? "wall-time-exhaustion" : "compiler-ice",
        });
        await supervisor.cleanup();
        expect(worker.terminations).toHaveLength(1);
        expect(ownsNothing(probe)).toBe(true);
      }
    }
  });

  it("rejects traversal, absolute paths, links, and non-regular files before use", async () => {
    requirePhaseExports();
    const supervisor = createSupervisor(SPEC_POLICY);
    const workspace = requireSuccess(await supervisor.createWorkspace());
    const outside = await mkdtemp(join(tmpdir(), "blend65-adapter-outside-"));
    temporaryRoots.push(outside);
    await writeFile(join(outside, "outside.bin"), "outside");
    await symlink(join(outside, "outside.bin"), join(workspace.root, "linked.bin"));
    await mkdir(join(workspace.root, "directory.bin"));

    for (const invalid of [
      "../outside.bin",
      resolve(outside, "outside.bin"),
      "linked.bin",
      "directory.bin",
    ]) {
      await expect(workspace.resolveRegularFile(invalid)).rejects.toThrow();
    }
    await workspace.dispose();
    await supervisor.cleanup();
  });

  it("passes shell metacharacters as one argv value without shell evaluation", async () => {
    requirePhaseExports();
    const probe = createOwnershipProbe();
    const argument = "value;$(touch should-not-exist)|&`false`";
    const process = scriptedProcess({ chunks: [], completes: true }, probe);
    const supervisor = createSupervisor(SPEC_POLICY, {
      processRuntime: process,
      time: immediateDeadline(),
    });
    const request: ProcessRequest = {
      executable: "/usr/bin/tool",
      argv: ["--value", argument],
      cwd: "/owned",
      deadline: { hardDeadlineMs: 10_000, workDeadlineMs: 9_000, cleanupGraceMs: 1_000 },
    };
    requireSuccess(await supervisor.runProcess(request));
    expect(process.requests).toEqual([request]);
    expect(process.requests[0]?.argv).toEqual(["--value", argument]);
    await supervisor.cleanup();
  });

  it("drains both streams under one aggregate bound and excludes flood scheduling from authority", async () => {
    requirePhaseExports();
    const exactPolicy = policy({ outputBytes: 8 });
    const finiteProbe = createOwnershipProbe();
    const finite = scriptedProcess(
      {
        chunks: [
          { stream: "stderr", bytes: ENCODER.encode("12") },
          { stream: "stdout", bytes: ENCODER.encode("abc") },
          { stream: "stderr", bytes: ENCODER.encode("345") },
        ],
        completes: true,
      },
      finiteProbe,
    );
    const finiteSupervisor = createSupervisor(exactPolicy, {
      processRuntime: finite,
      time: immediateDeadline(),
    });
    const processRequest: ProcessRequest = {
      executable: "/usr/bin/tool",
      argv: [],
      cwd: "/owned",
      deadline: { hardDeadlineMs: 10_000, workDeadlineMs: 9_000, cleanupGraceMs: 1_000 },
    };
    const exact = requireSuccess(await finiteSupervisor.runProcess(processRequest)) as {
      readonly authority: {
        readonly kind: string;
        readonly stdout: { readonly totalBytes: number; readonly sha256: string };
        readonly stderr: { readonly totalBytes: number; readonly sha256: string };
      };
    };
    expect(Object.keys(exact.authority)).toEqual(["kind", "stdout", "stderr"]);
    expect(exact.authority).toMatchObject({
      kind: "finite-streams",
      stdout: { totalBytes: 3, sha256: sha256(ENCODER.encode("abc")) },
      stderr: { totalBytes: 5, sha256: sha256(ENCODER.encode("12345")) },
    });

    const excess = scriptedProcess(
      { chunks: [{ stream: "stdout", bytes: ENCODER.encode("123456789") }], completes: true },
      createOwnershipProbe(),
    );
    const excessSupervisor = createSupervisor(exactPolicy, {
      processRuntime: excess,
      time: immediateDeadline(),
    });
    expectFailure(await excessSupervisor.runProcess(processRequest), "output-exhaustion");

    const flood = scriptedProcess(
      {
        chunks: [
          { stream: "stdout", bytes: ENCODER.encode("12345") },
          { stream: "stderr", bytes: ENCODER.encode("67890") },
        ],
        completes: false,
      },
      createOwnershipProbe(),
    );
    const floodSupervisor = createSupervisor(exactPolicy, {
      processRuntime: flood,
      time: immediateDeadline(),
    });
    const flooded = await floodSupervisor.runProcess(processRequest);
    expectFailure(flooded, "output-exhaustion");
    expect(JSON.stringify(flooded)).not.toMatch(/stdout|stderr|head|tail|sha256|totalBytes/u);
    expect(flood.terminations.length).toBeGreaterThan(0);
  });

  it("fails the evidence ledger on the first byte beyond sixteen mebibytes without a partial pass", () => {
    requirePhaseExports();
    const limit = 16_777_216;
    const ledger = requireSuccess(execution.createExecutionEvidenceLedgerV1(limit));
    const exact = requireSuccess(ledger.append(new Uint8Array(limit)));
    expect(exact).toMatchObject({ retainedBytes: limit, truncated: false });
    const before = ledger.summarize();
    expectFailure(ledger.append(Uint8Array.of(1)), "evidence-exhaustion");
    expect(ledger.summarize()).toEqual(before);
    expect(ledger.summarize()).not.toHaveProperty("partialPass");
  });

  it("reserves cleanup grace and applies exact operation, launch, work, and route bounds", () => {
    requirePhaseExports();
    const startedAt = 1_000;
    const bounded = policy({
      operationMs: 500,
      launchAttemptMs: 15_000,
      routeMs: 20_000,
      cleanupGraceMs: 2_000,
      launchAttempts: 2,
    });
    const scope = requireSuccess(execution.createExecutionBudgetScopeV1(bounded, startedAt));
    expect(scope.deadline).toEqual({
      hardDeadlineMs: 21_000,
      workDeadlineMs: 19_000,
      cleanupGraceMs: 2_000,
    });
    expect(requireSuccess(scope.beginOperation("frontend", 18_500)).deadlineMonotonicMs).toBe(
      19_000,
    );
    expect(requireSuccess(scope.snapshot(21_000)).wallMs).toBe(20_000);
    expectFailure(scope.snapshot(21_001), "wall-time-exhaustion");
    expect(requireSuccess(scope.beginLaunchAttempt(1_000))).toEqual({
      ordinal: 1,
      deadlineMonotonicMs: 16_000,
    });
    expect(requireSuccess(scope.beginLaunchAttempt(4_000))).toEqual({
      ordinal: 2,
      deadlineMonotonicMs: 19_000,
    });
    expectFailure(scope.beginLaunchAttempt(4_001), "emulator-launch-failure");

    expectFailure(
      execution.createExecutionBudgetScopeV1(
        policy({ routeMs: 2_000, cleanupGraceMs: 2_000 }),
        startedAt,
      ),
      "execution.invalid-schema",
    );
  });

  it("keeps retry counters cumulative and accepts only monotonic same-child stopwatch samples", () => {
    requirePhaseExports();
    const selected = policy({
      launchAttempts: 2,
      outputBytes: 8,
      evidenceBytes: 8,
      instructions: 8,
      cycles: 10,
    });
    const scope = requireSuccess(execution.createExecutionBudgetScopeV1(selected, 0));
    requireSuccess(scope.beginLaunchAttempt(0));
    requireSuccess(scope.beginLaunchAttempt(1));
    expect(requireSuccess(scope.chargeOutput(8)).outputBytes).toBe(8);
    expect(requireSuccess(scope.chargeEvidence(8)).evidenceBytes).toBe(8);
    expect(requireSuccess(scope.chargeInstructions(8)).instructions).toBe(8);
    expectFailure(scope.chargeOutput(1), "output-exhaustion");
    expectFailure(scope.chargeEvidence(1), "evidence-exhaustion");
    expectFailure(scope.chargeInstructions(1), "instruction-exhaustion");

    const first = {
      revision: "execution-stopwatch-sample-v1",
      childIdentityDigest: `sha256:${"1".repeat(64)}`,
      absoluteCycles: 100n,
    };
    requireSuccess(scope.beginStopwatch(first));
    expect(requireSuccess(scope.completeStopwatch({ ...first, absoluteCycles: 110n })).cycles).toBe(
      10,
    );
    expectFailure(scope.beginStopwatch(undefined), "invalid-evidence-input");
    requireSuccess(scope.beginStopwatch({ ...first, absoluteCycles: 200n }));
    expectFailure(
      scope.completeStopwatch({ ...first, absoluteCycles: 199n }),
      "invalid-evidence-input",
    );
    expectFailure(
      scope.completeStopwatch({
        ...first,
        childIdentityDigest: `sha256:${"2".repeat(64)}`,
        absoluteCycles: 201n,
      }),
      "invalid-evidence-input",
    );
  });

  it("releases every owned boundary after injected acquisition and completion failures", async () => {
    requirePhaseExports();
    for (const boundary of ["workspace", "worker", "child", "monitor", "checkpoint"] as const) {
      const probe = createOwnershipProbe();
      const worker = scriptedWorker(boundary === "worker" ? "crash" : "success", probe);
      const process: ScriptedProcess = scriptedProcess(
        {
          chunks: [],
          completes: boundary !== "child" && boundary !== "monitor" && boundary !== "checkpoint",
        },
        probe,
      );
      const workspaceRoot = `/owned/${boundary}`;
      const supervisor = createSupervisor(SPEC_POLICY, {
        workerExecutor: worker,
        processRuntime: process,
        time: immediateDeadline(),
        workspaceProvider: {
          create: async () => {
            if (boundary === "workspace") {
              return {
                ok: false,
                issues: [{ code: "execution.io", path: "/workspace", message: "injected" }],
              };
            }
            probe.workspaces.add(workspaceRoot);
            return {
              ok: true,
              value: {
                root: workspaceRoot,
                identity: { device: 1n, inode: 2n, uid: 3 },
                resolveRegularFile: async (path: string) => `${workspaceRoot}/${path}`,
                dispose: async () => {
                  probe.workspaces.delete(workspaceRoot);
                },
              },
            };
          },
        },
      });
      await supervisor.createWorkspace();
      await supervisor.runWorker({
        revision: "execution-worker-request-v1",
        tier: "frontend",
        contract: "frontend-pipeline-v1",
        caseIdentity: `sha256:${"3".repeat(64)}`,
        caseRoot: workspaceRoot,
        source: {
          revision: "execution-worker-source-v1",
          relativePath: "main.blend",
          bytes: ENCODER.encode("module Main;"),
          digest: sha256(ENCODER.encode("module Main;")),
        },
      });
      await supervisor.runProcess({
        executable: "/usr/bin/tool",
        argv: [],
        cwd: workspaceRoot,
        deadline: { hardDeadlineMs: 10_000, workDeadlineMs: 9_000, cleanupGraceMs: 1_000 },
      });
      await supervisor.cleanup();
      await supervisor.cleanup();
      expect(ownsNothing(probe)).toBe(true);
    }
  });

  it("runs an argv-only target inside a detached anchor and waits for descendant absence", async () => {
    requireProcessKernelExports();
    const streams = [
      { stream: "stdout" as const, bytes: ENCODER.encode("out") },
      { stream: "stderr" as const, bytes: ENCODER.encode("err") },
    ];
    const harness = createProcessKernelHarness(execution, { targetStreams: streams });
    const captured = kernelSink();
    const request = kernelRequest();
    const runtime = execution.createExecutionProcessRuntimeV1(harness.parentHost);
    const handle = requireSuccess(await runtime.start(request, captured.sink, cancellation));

    expect(harness.parentHost).not.toHaveProperty("signal");
    expect(harness.parentHost).not.toHaveProperty("signalSelfProcessGroup");
    expect(harness.anchorSpawns).toHaveLength(1);
    expect(harness.anchorSpawns[0]).toEqual({
      revision: "execution-anchor-spawn-v1",
      executable: process.execPath,
      argv: [expect.any(String)],
      cwd: request.cwd,
      environment: { LANG: "C", LC_ALL: "C", TZ: "UTC" },
      detached: true,
      shell: false,
      stdio: "ignore-output-control-pipes",
    });
    expect(harness.anchorSpawns[0]?.argv).toHaveLength(1);
    expect(harness.anchorSpawns[0]?.argv[0]).not.toBe(request.executable);
    expect(harness.targetSpawns).toEqual([
      {
        revision: "execution-target-spawn-v1",
        executable: request.executable,
        argv: request.argv,
        cwd: request.cwd,
        environment: { LANG: "C", LC_ALL: "C", TZ: "UTC" },
        detached: false,
        shell: false,
        stdio: "ignore-output-pipes",
      },
    ]);
    expect(handle.identity).toEqual({
      bootId: harness.targetIdentity.bootId,
      pid: harness.targetIdentity.pid,
      startTicks: harness.targetIdentity.startTicks,
      processGroupId: harness.anchorIdentity.processGroupId,
    });
    expect(captured.stdout).toEqual([ENCODER.encode("out")]);
    expect(captured.stderr).toEqual([ENCODER.encode("err")]);

    harness.completeTarget({ kind: "exit", exitCode: 7 });
    harness.enqueueMembership({ kind: "present", witness: harness.targetIdentity });
    await expectPromisePending(handle.completion);
    expect(harness.anchorMembershipQueries).toEqual([
      {
        revision: "execution-group-membership-query-v1",
        anchor: harness.anchorIdentity,
        scope: "excluding-anchor",
      },
    ]);
    harness.enqueueMembership({ kind: "absent" });
    await expect(handle.completion).resolves.toEqual({ exitCode: 7, signal: null });
    expect(harness.sentinel.alive).toBe(true);
    expect(harness.signals).toEqual([]);

    const parentFrames = harness.parentFrames.map(decodeControlFrame);
    const anchorFrames = harness.anchorFrames.map(decodeControlFrame);
    expect(parentFrames.map(({ kind }) => kind)).toEqual(["bootstrap", "launch"]);
    expect(anchorFrames.map(({ kind }) => kind)).toEqual([
      "anchor-ready",
      "target-started",
      "target-exit",
      "group-empty",
    ]);
    expect(parentFrames.map(({ sequence }) => sequence)).toEqual([0, 1]);
    expect(anchorFrames.map(({ sequence }) => sequence)).toEqual([0, 1, 2, 3]);
    expect(parentFrames[0]).toEqual({
      revision: "execution-process-anchor-frame-v1",
      direction: "parent-to-anchor",
      nonce: "ab".repeat(32),
      sequence: 0,
      kind: "bootstrap",
    });
    expect(Object.keys(parentFrames[1] ?? {}).sort()).toEqual([
      "argv",
      "cwd",
      "direction",
      "executable",
      "kind",
      "nonce",
      "revision",
      "sequence",
    ]);
    expect(parentFrames[1]).toMatchObject({
      direction: "parent-to-anchor",
      nonce: "ab".repeat(32),
      sequence: 1,
      kind: "launch",
      executable: request.executable,
      argv: request.argv,
      cwd: request.cwd,
    });
    expect(anchorFrames[0]).toMatchObject({
      direction: "anchor-to-parent",
      nonce: "ab".repeat(32),
      sequence: 0,
      kind: "anchor-ready",
      identity: {
        bootId: harness.anchorIdentity.bootId,
        pid: harness.anchorIdentity.pid,
        startTicks: "101",
        processGroupId: harness.anchorIdentity.processGroupId,
        sessionId: harness.anchorIdentity.sessionId,
      },
    });
    expect(anchorFrames[2]).toMatchObject({
      direction: "anchor-to-parent",
      kind: "target-exit",
      exitCode: 7,
      signal: null,
    });
  });

  it("keeps cooperative and forced group termination inside the live anchor", async () => {
    requireProcessKernelExports();
    const cooperative = createProcessKernelHarness(execution);
    const cooperativeHandle = requireSuccess(
      await execution
        .createExecutionProcessRuntimeV1(cooperative.parentHost)
        .start(kernelRequest(), kernelSink().sink, cancellation),
    );
    await cooperativeHandle.terminate("SIGTERM");
    expect(cooperative.signals).toEqual([
      {
        revision: "execution-self-group-signal-v1",
        target: "self-process-group",
        signal: "SIGTERM",
      },
    ]);
    cooperative.completeTarget({ kind: "signal", signal: "SIGTERM" });
    cooperative.enqueueMembership({ kind: "absent" });
    await expect(cooperativeHandle.completion).resolves.toEqual({
      exitCode: null,
      signal: "SIGTERM",
    });
    expect(frameKinds(cooperative.anchorFrames)).toEqual([
      "anchor-ready",
      "target-started",
      "term-applied",
      "target-exit",
      "group-empty",
    ]);

    const forced = createProcessKernelHarness(execution);
    const forcedHandle = requireSuccess(
      await execution
        .createExecutionProcessRuntimeV1(forced.parentHost)
        .start(kernelRequest(), kernelSink().sink, cancellation),
    );
    await forcedHandle.terminate("SIGTERM");
    await forcedHandle.terminate("SIGKILL");
    expect(forced.signals.map(({ signal }) => signal)).toEqual(["SIGTERM", "SIGKILL"]);
    const killArmedIndex = forced.events.findIndex(
      (event) =>
        event.kind === "anchor-frame" && decodeControlFrame(event.bytes).kind === "kill-armed",
    );
    const killSignalIndex = forced.events.findIndex(
      (event) => event.kind === "self-group-signal" && event.signal.signal === "SIGKILL",
    );
    expect(killArmedIndex).toBeGreaterThanOrEqual(0);
    expect(killSignalIndex).toBeGreaterThan(killArmedIndex);
    forced.completeTarget({ kind: "signal", signal: "SIGKILL" });
    forced.enqueueMembership({ kind: "absent" });
    await expect(forcedHandle.completion).resolves.toEqual({
      exitCode: null,
      signal: "SIGKILL",
    });
    expect(forced.sentinel.alive).toBe(true);
    expect(forced.parentHost).not.toHaveProperty("signal");
  });

  it("rejects noncanonical, unauthenticated, out-of-order, duplicate, and oversized frames", async () => {
    requireProcessKernelExports();
    const rewrite = (
      bytes: Uint8Array,
      change: (value: Record<string, unknown>) => Record<string, unknown>,
    ): ControlRead => {
      const value = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
      return { kind: "frame", bytes: ENCODER.encode(`${JSON.stringify(change(value))}\n`) };
    };
    const invalidMutations = {
      "wrong nonce": (bytes: Uint8Array) =>
        rewrite(bytes, (value) => ({ ...value, nonce: "cd".repeat(32) })),
      "wrong sequence": (bytes: Uint8Array) =>
        rewrite(bytes, (value) => ({ ...value, sequence: Number(value.sequence) + 1 })),
      "duplicate frame": (bytes: Uint8Array) => [
        { kind: "frame" as const, bytes },
        { kind: "frame" as const, bytes },
      ],
      "malformed json": () => ({ kind: "frame" as const, bytes: ENCODER.encode("{]\n") }),
      "invalid utf8": () => ({
        kind: "frame" as const,
        bytes: Uint8Array.of(0xc3, 0x28, 0x0a),
      }),
      "extra key": (bytes: Uint8Array) => rewrite(bytes, (value) => ({ ...value, extra: true })),
      "two line feeds": (bytes: Uint8Array) => ({
        kind: "frame" as const,
        bytes: Uint8Array.from([...bytes, 0x0a]),
      }),
      "oversized frame": () => ({
        kind: "frame" as const,
        bytes: new Uint8Array(8_388_609).fill(0x20),
      }),
    } satisfies Readonly<
      Record<string, (bytes: Uint8Array) => ControlRead | readonly ControlRead[]>
    >;

    for (const [name, mutation] of Object.entries(invalidMutations)) {
      for (const direction of ["parent", "anchor"] as const) {
        const harness = createProcessKernelHarness(execution, {
          ...(direction === "parent"
            ? { mutateParentFrame: (bytes: Uint8Array) => mutation(bytes) }
            : { mutateAnchorFrame: (bytes: Uint8Array) => mutation(bytes) }),
        });
        const result = await execution
          .createExecutionProcessRuntimeV1(harness.parentHost)
          .start(kernelRequest(), kernelSink().sink, cancellation);
        expect(result.ok, `${direction} ${name}`).toBe(false);
        expect(harness.sentinel.alive, `${direction} ${name}`).toBe(true);
        expect(harness.signals, `${direction} ${name}`).toEqual([]);
        expect(harness.parentHost, `${direction} ${name}`).not.toHaveProperty("signal");
      }
    }
  });

  it("fails closed when anchor ownership or control proof disappears at every termination phase", async () => {
    requireProcessKernelExports();
    const phases = ["before-term", "after-term", "after-kill-armed"] as const;
    for (const phase of phases) {
      for (const loss of ["eof", "crash"] as const) {
        for (const membership of ["unknown", "recycled"] as const) {
          const harness = createProcessKernelHarness(execution);
          const handle = requireSuccess(
            await execution
              .createExecutionProcessRuntimeV1(harness.parentHost)
              .start(kernelRequest(), kernelSink().sink, cancellation),
          );
          if (phase !== "before-term") await handle.terminate("SIGTERM");
          if (phase === "after-kill-armed") await handle.terminate("SIGKILL");
          harness.enqueueMembership(
            membership === "unknown"
              ? { kind: "unknown", reason: "io" }
              : {
                  kind: "recycled",
                  witness: {
                    ...harness.anchorIdentity,
                    bootId: "unrelated-boot",
                    startTicks: harness.anchorIdentity.startTicks + 1n,
                  },
                },
          );
          harness.crashAnchor(
            { kind: "crash", code: "io", message: "anchor stopped" },
            loss === "eof"
              ? { kind: "eof" }
              : { kind: "crash", code: "io", message: "control stopped" },
          );
          await expect(handle.completion, `${phase} ${loss} ${membership}`).rejects.toBeDefined();
          expect(harness.parentMembershipQueries).toEqual([
            {
              revision: "execution-group-membership-query-v1",
              anchor: harness.anchorIdentity,
              scope: "including-anchor",
            },
          ]);
          expect(harness.signals.map(({ signal }) => signal)).toEqual(
            phase === "before-term"
              ? []
              : phase === "after-term"
                ? ["SIGTERM"]
                : ["SIGTERM", "SIGKILL"],
          );
          expect(harness.sentinel.alive).toBe(true);
          expect(harness.parentHost).not.toHaveProperty("signal");
        }
      }
    }
  });

  it("enforces process kernel bounds and cancellation before granting process authority", async () => {
    requireProcessKernelExports();
    expect(execution.EXECUTION_PROCESS_KERNEL_LIMITS_V1).toEqual({
      controlFrameBytes: 8_388_608,
      controlBytesPerDirection: 16_777_216,
      controlFramesPerDirection: 16,
      nonceBytes: 32,
      executableBytes: 65_536,
      cwdBytes: 65_536,
      argvItems: 1_024,
      argumentBytes: 65_536,
      argvBytes: 524_288,
      environmentEntries: 3,
      environmentBytes: 131_072,
      protocolMessageBytes: 4_096,
    });
    expect(execution.defaultExecutionProcessRuntimeV1).toEqual(
      expect.objectContaining({ start: expect.any(Function) }),
    );

    const invalidRequests: readonly ProcessRequest[] = [
      kernelRequest({ executable: "" }),
      kernelRequest({ executable: "x".repeat(65_537) }),
      kernelRequest({ cwd: "x".repeat(65_537) }),
      kernelRequest({ argv: Array.from({ length: 1_025 }, () => "x") }),
      kernelRequest({ argv: ["x".repeat(65_537)] }),
      kernelRequest({ argv: Array.from({ length: 9 }, () => "x".repeat(65_536)) }),
    ];
    for (const request of invalidRequests) {
      const harness = createProcessKernelHarness(execution);
      const result = await execution
        .createExecutionProcessRuntimeV1(harness.parentHost)
        .start(request, kernelSink().sink, cancellation);
      expect(result.ok).toBe(false);
      expect(harness.anchorSpawns).toEqual([]);
      expect(harness.signals).toEqual([]);
    }

    const preCancelled = new AbortController();
    preCancelled.abort();
    const neverSpawned = createProcessKernelHarness(execution);
    const cancelledStart = await execution
      .createExecutionProcessRuntimeV1(neverSpawned.parentHost)
      .start(kernelRequest(), kernelSink().sink, {
        signal: preCancelled.signal,
        deadlineMonotonicMs: 10_000,
      });
    expect(cancelledStart.ok).toBe(false);
    expect(neverSpawned.anchorSpawns).toEqual([]);

    const inFlightController = new AbortController();
    const inFlight = createProcessKernelHarness(execution);
    const inFlightHandle = requireSuccess(
      await execution
        .createExecutionProcessRuntimeV1(inFlight.parentHost)
        .start(kernelRequest(), kernelSink().sink, {
          signal: inFlightController.signal,
          deadlineMonotonicMs: 10_000,
        }),
    );
    inFlight.enqueueMembership({ kind: "unknown", reason: "io" });
    inFlightController.abort();
    inFlight.crashAnchor();
    await expect(inFlightHandle.completion).rejects.toBeDefined();
    expect(inFlight.signals).toEqual([]);
    expect(inFlight.sentinel.alive).toBe(true);
  });
});

describe("genuine invalid diagnostic authority", () => {
  it("constructs only an authenticated invalid-source diagnostic capability", async () => {
    const diagnosticFixture = await requireGenuineDiagnosticFixture();
    expect(diagnosticFixture.projection).toMatchObject({
      schemaVersion: 1,
      kind: "invalid-source-transform",
      sourceCaseDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      expectedDiagnostic: {
        kind: "diagnostic",
        code: expect.any(String),
        phase: expect.stringMatching(/^(lexer|parser|semantic|sfa)$/u),
        severity: "error",
      },
      authority: {
        joinPolicyRevision: "published-diagnostic-case-equivalence-v1",
        selectedReleaseDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        selectedCampaignDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        selectedSourceCaseDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        evaluationIdentity: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        sourceContentIdentity: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      },
    });
    expect(diagnosticFixture.projection.authority.selectedCampaignDigest).not.toBe(
      diagnosticFixture.campaign.summary.campaignDigest,
    );
    expect(diagnosticFixture.projection.authority.selectedSourceCaseDigest).not.toBe(
      diagnosticFixture.projection.sourceCaseDigest,
    );
    expect(
      publishedDiagnostic.createPublishedDiagnosticCaseV1(
        diagnosticFixture.context,
        diagnosticFixture.campaign,
        diagnosticFixture.ordinals.valid,
      ),
    ).toMatchObject({ ok: false });
    expect(
      publishedDiagnostic.createPublishedDiagnosticCaseV1(
        diagnosticFixture.context,
        diagnosticFixture.campaign,
        diagnosticFixture.ordinals.invalidParameter,
      ),
    ).toMatchObject({ ok: false });
    for (const forgedContext of [{}, { ...diagnosticFixture.context }]) {
      expect(
        publishedDiagnostic.createPublishedDiagnosticCaseV1(
          forgedContext,
          diagnosticFixture.campaign,
          diagnosticFixture.ordinals.invalidSource,
        ),
      ).toMatchObject({ ok: false });
    }
    for (const forgedCase of [
      {},
      { ...diagnosticFixture.diagnosticCase },
      diagnosticFixture.projection,
      new Proxy(diagnosticFixture.diagnosticCase, {}),
    ]) {
      expect(publishedDiagnostic.getPublishedDiagnosticCaseProjectionV1(forgedCase)).toMatchObject({
        ok: false,
      });
    }
    const second = publishedDiagnostic.getPublishedDiagnosticCaseProjectionV1(
      diagnosticFixture.diagnosticCase,
    );
    expect(second).toMatchObject({ ok: true, value: diagnosticFixture.projection });
    if (second.ok) {
      expect(second.value.sourceBytes).not.toBe(diagnosticFixture.projection.sourceBytes);
      expect(second.value.sourceBytes).toEqual(diagnosticFixture.projection.sourceBytes);
    }
  });

  it("accepts authenticated seed and configuration while rejecting publication-owned ambient mismatches", async () => {
    const diagnosticFixture = await requireGenuineDiagnosticFixture();
    const primary = diagnosticFixture.projection;
    const repeated = diagnosticFixture.seedCases.repeated.projection;
    const different = diagnosticFixture.seedCases.different.projection;
    expect(diagnosticFixture.seedCases.repeated.campaign.summary.campaignDigest).toBe(
      diagnosticFixture.campaign.summary.campaignDigest,
    );
    expect(diagnosticFixture.seedCases.repeated.ordinal).toBe(
      diagnosticFixture.ordinals.invalidSource,
    );
    expect(repeated).toEqual(primary);
    expect(diagnosticFixture.seedCases.different.campaign.summary.campaignDigest).not.toBe(
      diagnosticFixture.campaign.summary.campaignDigest,
    );
    expect(different.sourceCaseDigest).not.toBe(primary.sourceCaseDigest);
    expect(different.authority.selectedCampaignDigest).not.toBe(
      primary.authority.selectedCampaignDigest,
    );
    expect(different.authority.selectedSourceCaseDigest).not.toBe(
      primary.authority.selectedSourceCaseDigest,
    );
    expect(different.authority.evaluationIdentity).not.toBe(primary.authority.evaluationIdentity);

    expect(parseReplayEnvelope(diagnosticFixture.seedCases.replayBytes)).toMatchObject({
      ok: true,
    });
    expect(parseReplayEnvelope(diagnosticFixture.seedCases.hostileReplayBytes)).toMatchObject({
      ok: false,
      diagnostics: [expect.objectContaining({ code: "replay.identity.mismatch" })],
    });

    const differentConfiguration = diagnosticFixture.configurationCase.projection;
    expect(diagnosticFixture.configurationCase.campaign.summary.campaignDigest).not.toBe(
      diagnosticFixture.campaign.summary.campaignDigest,
    );
    expect(differentConfiguration.sourceCaseDigest).not.toBe(primary.sourceCaseDigest);
    expect(differentConfiguration.authority.selectedCampaignDigest).not.toBe(
      primary.authority.selectedCampaignDigest,
    );
    expect(differentConfiguration.authority.selectedSourceCaseDigest).not.toBe(
      primary.authority.selectedSourceCaseDigest,
    );
    expect(differentConfiguration.authority.evaluationIdentity).not.toBe(
      primary.authority.evaluationIdentity,
    );
    expect(
      parseReplayEnvelope(diagnosticFixture.configurationCase.hostileReplayBytes),
    ).toMatchObject({
      ok: false,
      diagnostics: [expect.objectContaining({ code: "replay.identity.mismatch" })],
    });

    const crossedSeedRoute = diagnosticRouteApi.createExecutionRouteRequestV1({
      ...diagnosticFixture.requests.frontend,
      route: {
        ...diagnosticFixture.requests.frontend.route,
        caseIdentity: different.sourceCaseDigest,
      },
    });
    expect(crossedSeedRoute).toMatchObject({ ok: false });
    expect(crossedSeedRoute).not.toHaveProperty("value");

    const crossedConfigurationRoute = diagnosticRouteApi.createExecutionRouteRequestV1({
      ...diagnosticFixture.requests.frontend,
      route: {
        ...diagnosticFixture.requests.frontend.route,
        caseIdentity: differentConfiguration.sourceCaseDigest,
      },
    });
    expect(crossedConfigurationRoute).toMatchObject({ ok: false });
    expect(crossedConfigurationRoute).not.toHaveProperty("value");

    expect(Object.keys(diagnosticFixture.ambientMismatchCases).sort()).toEqual([
      "inventory-digest",
      "inventory-version",
      "spec-revision",
      "target",
    ]);
    for (const [axis, mismatch] of Object.entries(diagnosticFixture.ambientMismatchCases)) {
      expect(
        publishedDiagnostic.createPublishedDiagnosticCaseV1(
          diagnosticFixture.context,
          mismatch.campaign,
          mismatch.ordinal,
        ),
        axis,
      ).toMatchObject({ ok: false });
    }
  });

  it("rejects fixed schema, algorithm, handler, contract, and rule-model mutants at campaign preparation", async () => {
    const diagnosticFixture = await requireGenuineDiagnosticFixture();
    expect(Object.keys(diagnosticFixture.constructionGateResults).sort()).toEqual([
      "boundary-contract-version",
      "boundary-handler-id",
      "generator-contract-version",
      "generator-handler-id",
      "inventory-schema-version",
      "prng-algorithm",
      "rule-model-digest",
      "rule-model-version",
    ]);
    for (const [axis, result] of Object.entries(diagnosticFixture.constructionGateResults)) {
      expect(result, axis).toMatchObject({ ok: false });
    }
  });

  it("rejects genuine modeled-case and rendered-source disagreements at the join", async () => {
    const diagnosticFixture = await requireGenuineDiagnosticFixture();
    expect(Object.keys(diagnosticFixture.modeledMismatchCases).sort()).toEqual([
      "bindings",
      "neighbor",
      "rule",
      "transform",
      "validity",
    ]);
    for (const [axis, mismatch] of Object.entries(diagnosticFixture.modeledMismatchCases)) {
      expect(
        publishedDiagnostic.createPublishedDiagnosticCaseV1(
          diagnosticFixture.context,
          mismatch.campaign,
          mismatch.ordinal,
        ),
        axis,
      ).toMatchObject({ ok: false });
    }
    expect(
      publishedDiagnostic.createPublishedDiagnosticCaseV1(
        diagnosticFixture.context,
        diagnosticFixture.sourceMismatchCase.campaign,
        diagnosticFixture.sourceMismatchCase.ordinal,
      ),
    ).toMatchObject({ ok: false });
  });

  it("derives diagnostic authority through the selected runtime-state route", async () => {
    const diagnosticFixture = await requireGenuineDiagnosticFixture();
    expect(diagnosticFixture.runtimeCase.projection).toMatchObject({
      kind: "invalid-source-transform",
      sourceCaseDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      expectedDiagnostic: {
        kind: "diagnostic",
        ruleId: "rule.ch12.3-1-memory-access.poke-addr-val.signature.word-byte",
        severity: "error",
      },
      authority: {
        joinPolicyRevision: "published-diagnostic-case-equivalence-v1",
        selectedCampaignDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
        selectedSourceCaseDigest: expect.stringMatching(/^sha256:[0-9a-f]{64}$/u),
      },
    });
    expect(diagnosticFixture.runtimeCase.projection.authority.selectedCampaignDigest).not.toBe(
      diagnosticFixture.runtimeCase.campaign.summary.campaignDigest,
    );
  });

  it("admits diagnostic requests only at frontend, compiler, and command-line tiers", async () => {
    const diagnosticFixture = await requireGenuineDiagnosticFixture();
    for (const tier of ["frontend", "compiler-api", "cli"] as const) {
      expect(diagnosticFixture.requests[tier]).toMatchObject({
        kind: "invalid-diagnostic",
        route: {
          terminalTier: tier,
          caseIdentity: diagnosticFixture.projection.sourceCaseDigest,
        },
        diagnosticCase: diagnosticFixture.diagnosticCase,
        policy: SPEC_POLICY,
      });
      expect(diagnosticFixture.requests[tier]).not.toHaveProperty("oracle");
      expect(diagnosticFixture.requests[tier]).not.toHaveProperty("executionCase");
    }
    for (const tier of ["emit", "acme", "vice"] as const) {
      const result = diagnosticRouteApi.createExecutionRouteRequestV1({
        ...diagnosticFixture.requests.frontend,
        route: {
          ...diagnosticFixture.requests.frontend.route,
          terminalTier: tier,
          obligation: tier,
        },
      });
      expectFailure(result, "execution.invalid-schema");
    }
  });

  it("sends source identity and case kind to workers without diagnostic truth", async () => {
    const diagnosticFixture = await requireGenuineDiagnosticFixture();
    for (const tier of ["frontend", "compiler-api", "cli"] as const) {
      const probe = createOwnershipProbe();
      const worker = scriptedDiagnosticWorker(diagnosticFixture.projection, probe);
      const supervisor = createSupervisor(SPEC_POLICY, {
        workerExecutor: worker,
        time: immediateDeadline(),
      });
      const result = await createHandlers(worker, supervisor)[tier].execute(
        diagnosticFixture.requests[tier],
        cancellation,
      );
      expect(result).toMatchObject({ status: "pass", tier, code: "pass" });
      expect(worker.requests).toHaveLength(1);
      const request = worker.requests[0];
      expect(request).toMatchObject({
        revision: "execution-worker-request-v1",
        tier,
        caseKind: "invalid-diagnostic",
        caseIdentity: diagnosticFixture.projection.sourceCaseDigest,
        source: {
          revision: "execution-worker-source-v1",
          bytes: diagnosticFixture.projection.sourceBytes,
          digest: diagnosticFixture.projection.authority.sourceContentIdentity,
        },
      });
      expect(Object.keys(request).sort()).toEqual(
        tier === "cli"
          ? [
              "argv",
              "caseIdentity",
              "caseKind",
              "caseRoot",
              "contract",
              "revision",
              "source",
              "tier",
            ]
          : ["caseIdentity", "caseKind", "caseRoot", "contract", "revision", "source", "tier"],
      );
      const serialized = JSON.stringify(request);
      expect(serialized).not.toMatch(
        /expected|oracle|diagnosticTruth|finalSeverity|neighborId|joinPolicy|selectedRelease|selectedCampaign|selectedSourceCase|evaluationIdentity/u,
      );
      await supervisor.cleanup();
      expect(ownsNothing(probe)).toBe(true);
    }
  });

  it("classifies only the exact parent-side diagnostic and rejects every mismatch or artifact", async () => {
    const diagnosticFixture = await requireGenuineDiagnosticFixture();
    const expected = diagnosticFixture.projection.expectedDiagnostic;
    const exact = {
      revision: "direct-diagnostic-evidence-v1",
      sourceCaseDigest: diagnosticFixture.projection.sourceCaseDigest,
      diagnostics: {
        revision: "compiler-diagnostic-evidence-v1",
        entries: [
          {
            acceptedEntryId: "accepted-diagnostic-1",
            code: expected.code,
            phase: expected.phase,
            finalSeverity: expected.severity,
          },
        ],
      },
      emission: { il: false, assembly: false, binary: false },
    } as const;
    expect(
      requireSuccess(
        execution.classifyDiagnosticRouteEvidenceV1(diagnosticFixture.diagnosticCase, exact),
      ),
    ).toEqual({ status: "pass", code: "pass" });

    for (const entries of [
      [],
      [{ ...exact.diagnostics.entries[0], code: `${expected.code}.wrong` }],
      [{ ...exact.diagnostics.entries[0], phase: expected.phase === "lexer" ? "parser" : "lexer" }],
      [{ ...exact.diagnostics.entries[0], finalSeverity: "warning" }],
      [exact.diagnostics.entries[0], exact.diagnostics.entries[0]],
    ]) {
      expect(
        requireSuccess(
          execution.classifyDiagnosticRouteEvidenceV1(diagnosticFixture.diagnosticCase, {
            ...exact,
            diagnostics: { ...exact.diagnostics, entries },
            emission: { il: true, assembly: true, binary: true },
          }),
        ),
      ).toEqual({ status: "failure", code: "diagnostic-mismatch" });
    }

    for (const emission of [
      { il: true, assembly: false, binary: false },
      { il: false, assembly: true, binary: false },
      { il: false, assembly: false, binary: true },
    ]) {
      expect(
        requireSuccess(
          execution.classifyDiagnosticRouteEvidenceV1(diagnosticFixture.diagnosticCase, {
            ...exact,
            emission,
          }),
        ),
      ).toEqual({ status: "failure", code: "unexpected-emission" });
    }
    expect(
      requireSuccess(
        execution.classifyDiagnosticRouteEvidenceV1(diagnosticFixture.diagnosticCase, {
          ...exact,
          sourceCaseDigest: `sha256:${"0".repeat(64)}`,
        }),
      ),
    ).toEqual({ status: "failure", code: "diagnostic-mismatch" });
    for (const malformed of [
      {},
      { ...exact, expectedDiagnostic: expected },
      { ...exact, extra: true },
      { ...exact, emission: { il: false, assembly: false } },
    ]) {
      expectFailure(
        execution.classifyDiagnosticRouteEvidenceV1(diagnosticFixture.diagnosticCase, malformed),
        "invalid-evidence-input",
      );
    }
    for (const forgedAuthority of [
      {},
      { ...diagnosticFixture.diagnosticCase },
      diagnosticFixture.projection,
      new Proxy(diagnosticFixture.diagnosticCase, {}),
    ]) {
      expectFailure(
        execution.classifyDiagnosticRouteEvidenceV1(forgedAuthority, exact),
        "invalid-evidence-input",
      );
    }
  });
});

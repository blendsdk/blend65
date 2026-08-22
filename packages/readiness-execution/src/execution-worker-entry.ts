import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { parentPort } from "node:worker_threads";

import {
  buildWithEvidence,
  compileWithEvidence,
  emitAsmWithEvidence,
  emitIlWithEvidence,
  type CompilerEvidenceFacadeV1,
  type CompilerDiagnosticEvidenceV1,
} from "@blend65/compiler";
import { runCli } from "@blend65/cli";
import { type CompilerHost } from "@blend65/core";
import { deriveOracleSourceContentIdentity } from "@blend65/readiness/published-oracle";

import { isExecutionRelativePathV1 } from "./execution-workspace.js";
import type {
  ExecutionWorkerRequestV1,
  ExecutionWorkerResponseV1,
} from "./execution-worker-protocol.js";

const ENCODER = new TextEncoder();
const DECODER = new TextDecoder("utf-8", { fatal: true });
const MAX_OUTPUT_BYTES = 1_048_576;
const MAX_EVIDENCE_BYTES = 16_777_216;
const JOB_KEYS = ["revision", "request", "outputLimitBytes", "evidenceLimitBytes"] as const;

interface WorkerJobV1 {
  readonly revision: "execution-worker-job-v1";
  readonly request: ExecutionWorkerRequestV1;
  readonly outputLimitBytes: number;
  readonly evidenceLimitBytes: number;
}

/** Checks canonical containment without treating the workspace root itself as an artifact. */
function isContained(root: string, candidate: string): boolean {
  const fromRoot = relative(root, candidate);
  return (
    fromRoot !== "" &&
    !fromRoot.startsWith(`..${sep}`) &&
    fromRoot !== ".." &&
    !isAbsolute(fromRoot)
  );
}

/** Reads one exact ordinary data record without executing accessors. */
function readRecord(
  input: unknown,
  expectedKeys: readonly string[],
): Readonly<Record<string, unknown>> | undefined {
  try {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return undefined;
    if (Object.getPrototypeOf(input) !== Object.prototype) return undefined;
    const keys = Reflect.ownKeys(input);
    if (
      keys.length !== expectedKeys.length ||
      keys.some((key) => typeof key !== "string" || !expectedKeys.includes(key))
    ) {
      return undefined;
    }
    const record: Record<string, unknown> = {};
    for (const key of expectedKeys) {
      const descriptor = Reflect.getOwnPropertyDescriptor(input, key);
      if (descriptor === undefined || !("value" in descriptor) || !descriptor.enumerable) {
        return undefined;
      }
      record[key] = descriptor.value;
    }
    return record;
  } catch {
    return undefined;
  }
}

/** Rejects malformed structured-clone requests before filesystem or compiler use. */
function isWorkerRequest(input: unknown): input is ExecutionWorkerRequestV1 {
  const baseKeys = ["revision", "tier", "contract", "caseIdentity", "caseRoot", "source"];
  const variants = [
    baseKeys,
    [...baseKeys, "caseKind"],
    [...baseKeys, "workspaceIdentity"],
    [...baseKeys, "caseKind", "workspaceIdentity"],
  ];
  let request: Readonly<Record<string, unknown>> | undefined;
  let cli = false;
  for (const keys of variants) {
    request = readRecord(input, keys);
    if (request !== undefined) break;
    request = readRecord(input, [...keys, "argv"]);
    if (request !== undefined) {
      cli = true;
      break;
    }
  }
  if (request === undefined) return false;
  const source = readRecord(request.source, ["revision", "relativePath", "bytes", "digest"]);
  if (source === undefined) return false;
  const workspaceIdentity =
    request.workspaceIdentity === undefined
      ? undefined
      : readRecord(request.workspaceIdentity, ["device", "inode", "uid"]);
  const expectedContract =
    request.tier === "frontend"
      ? "frontend-pipeline-v1"
      : request.tier === "compiler-api"
        ? "compiler-evidence-facade-v1"
        : request.tier === "cli"
          ? "blendc-cli-v1"
          : request.tier === "emit"
            ? "assembly-emitter-v1"
            : undefined;
  const argv = request.argv;
  const validCliArgv =
    request.tier !== "cli" ||
    (Array.isArray(argv) &&
      Object.getPrototypeOf(argv) === Array.prototype &&
      argv.length === 4 &&
      argv[0] === "check" &&
      argv[1] === "main.blend" &&
      argv[2] === "--platform" &&
      argv[3] === "c64");
  return (
    request.revision === "execution-worker-request-v1" &&
    (request.caseKind === undefined ||
      request.caseKind === "valid-envelope" ||
      request.caseKind === "invalid-diagnostic") &&
    (request.caseKind !== "invalid-diagnostic" || request.tier !== "emit") &&
    expectedContract !== undefined &&
    request.contract === expectedContract &&
    typeof request.caseIdentity === "string" &&
    /^sha256:[0-9a-f]{64}$/u.test(request.caseIdentity) &&
    typeof request.caseRoot === "string" &&
    source.revision === "execution-worker-source-v1" &&
    isExecutionRelativePathV1(source.relativePath) &&
    source.bytes instanceof Uint8Array &&
    typeof source.digest === "string" &&
    /^sha256:[0-9a-f]{64}$/u.test(source.digest) &&
    (workspaceIdentity === undefined ||
      (typeof workspaceIdentity.device === "bigint" &&
        workspaceIdentity.device >= 0n &&
        typeof workspaceIdentity.inode === "bigint" &&
        workspaceIdentity.inode > 0n &&
        Number.isSafeInteger(workspaceIdentity.uid) &&
        Number(workspaceIdentity.uid) >= 0)) &&
    ((cli && request.tier === "cli") || (!cli && request.tier !== "cli")) &&
    validCliArgv
  );
}

function isWorkerJob(input: unknown): input is WorkerJobV1 {
  const record = readRecord(input, JOB_KEYS);
  return (
    record?.revision === "execution-worker-job-v1" &&
    isWorkerRequest(record.request) &&
    Number.isSafeInteger(record.outputLimitBytes) &&
    Number(record.outputLimitBytes) > 0 &&
    Number(record.outputLimitBytes) <= MAX_OUTPUT_BYTES &&
    Number.isSafeInteger(record.evidenceLimitBytes) &&
    Number(record.evidenceLimitBytes) > 0 &&
    Number(record.evidenceLimitBytes) <= MAX_EVIDENCE_BYTES &&
    record.request.source.bytes.byteLength <= Number(record.evidenceLimitBytes)
  );
}

function sameIdentity(
  left: { readonly dev: bigint; readonly ino: bigint; readonly uid: bigint },
  right: { readonly dev: bigint; readonly ino: bigint; readonly uid: bigint },
): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.uid === right.uid;
}

interface PreparedSource {
  readonly sourcePath: string;
  readonly host: CompilerHost;
}

/** Verifies the parent-pinned root and exposes only retained source bytes to the compiler. */
async function prepareSource(request: ExecutionWorkerRequestV1): Promise<PreparedSource> {
  if (constants.O_NOFOLLOW === undefined || constants.O_DIRECTORY === undefined) {
    throw new TypeError("No-follow workspace primitives are unavailable.");
  }
  const root = await realpath(request.caseRoot);
  if (root !== request.caseRoot) throw new TypeError("Worker case root is not canonical.");
  const sourcePath = resolve(root, request.source.relativePath);
  if (!isContained(root, sourcePath))
    throw new TypeError("Worker source path escapes its case root.");
  const diagnosticDigest =
    request.caseKind === "invalid-diagnostic"
      ? deriveOracleSourceContentIdentity(request.source.bytes)
      : undefined;
  const digest =
    diagnosticDigest === undefined
      ? `sha256:${createHash("sha256").update(request.source.bytes).digest("hex")}`
      : diagnosticDigest.ok
        ? diagnosticDigest.identity
        : undefined;
  if (digest !== request.source.digest) throw new TypeError("Worker source digest does not match.");

  const rootHandle = await open(
    root,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW,
  );
  try {
    const pinnedRoot = await rootHandle.stat({ bigint: true });
    const rootPathBefore = await lstat(root, { bigint: true });
    if (
      !pinnedRoot.isDirectory() ||
      !sameIdentity(pinnedRoot, rootPathBefore) ||
      Number(pinnedRoot.mode & 0o777n) !== 0o700 ||
      (typeof process.getuid === "function" && Number(pinnedRoot.uid) !== process.getuid())
    ) {
      throw new TypeError("Worker case root identity is unsafe.");
    }
    if (
      request.workspaceIdentity !== undefined &&
      (pinnedRoot.dev !== request.workspaceIdentity.device ||
        pinnedRoot.ino !== request.workspaceIdentity.inode ||
        Number(pinnedRoot.uid) !== request.workspaceIdentity.uid)
    ) {
      throw new TypeError("Worker case root does not match its parent-pinned identity.");
    }
    const rootPathAfter = await lstat(root, { bigint: true });
    if (!sameIdentity(pinnedRoot, rootPathAfter)) {
      throw new TypeError("Worker case root changed during source creation.");
    }
  } finally {
    await rootHandle.close();
  }
  const sourceText = DECODER.decode(request.source.bytes);
  const host: CompilerHost = Object.freeze({
    listSourceFiles: () => [sourcePath],
    readFile: (path: string) => (resolve(path) === sourcePath ? sourceText : undefined),
    resolvePath: (path: string) => resolve(root, path),
  });
  return Object.freeze({ sourcePath, host });
}

class BoundedTextOutput {
  readonly #limit: number;
  #total = 0;
  #exhausted = false;
  readonly #storage: Uint8Array;
  readonly #stdout: Array<readonly [number, number]> = [];
  readonly #stderr: Array<readonly [number, number]> = [];

  constructor(limit: number) {
    this.#limit = limit;
    this.#storage = new Uint8Array(limit);
  }

  append(stream: "stdout" | "stderr", text: string): void {
    if (this.#exhausted) return;
    const length = Buffer.byteLength(text, "utf8");
    if (length > this.#limit - this.#total) {
      this.#exhausted = true;
      return;
    }
    const start = this.#total;
    const encoded = ENCODER.encodeInto(text, this.#storage.subarray(start, start + length));
    if (encoded.read !== text.length || encoded.written !== length) {
      this.#exhausted = true;
      return;
    }
    this.#total += length;
    (stream === "stdout" ? this.#stdout : this.#stderr).push([start, length]);
  }

  finish(): { readonly stdout: Uint8Array; readonly stderr: Uint8Array } {
    if (this.#exhausted) throw new TypeError("output-exhaustion: worker CLI output limit exceeded");
    return {
      stdout: this.#join(this.#stdout),
      stderr: this.#join(this.#stderr),
    };
  }

  #join(chunks: readonly (readonly [number, number])[]): Uint8Array {
    const length = chunks.reduce((total, chunk) => total + chunk[1], 0);
    const result = new Uint8Array(length);
    let offset = 0;
    for (const [start, byteLength] of chunks) {
      result.set(this.#storage.subarray(start, start + byteLength), offset);
      offset += byteLength;
    }
    return result;
  }
}

function encodeAssembly(text: string, limit: number): Uint8Array {
  if (Buffer.byteLength(text, "utf8") > limit) {
    throw new TypeError("output-exhaustion: worker assembly output limit exceeded");
  }
  return ENCODER.encode(text);
}

function enforceEvidenceBound(response: ExecutionWorkerResponseV1, limit: number): void {
  const projection = {
    tier: response.tier,
    diagnostics: response.diagnostics,
    emission: response.emission,
    ...(response.tier === "frontend"
      ? {
          semanticModelPresent: response.semanticModelPresent,
          allocationPlanPresent: response.allocationPlanPresent,
        }
      : response.tier === "compiler-api"
        ? { hasErrors: response.hasErrors }
        : response.tier === "cli"
          ? { exitCode: response.exitCode }
          : {}),
  };
  const metadataBytes = Buffer.byteLength(JSON.stringify(projection), "utf8");
  const outputBytes =
    response.tier === "cli"
      ? response.stdout.byteLength + response.stderr.byteLength
      : response.tier === "emit"
        ? response.assemblyBytes.byteLength
        : 0;
  if (metadataBytes > limit - outputBytes) {
    throw new TypeError("evidence-exhaustion: worker evidence limit exceeded");
  }
}

/** Executes the selected real façade and returns evidence rather than terminal authority. */
async function execute(job: WorkerJobV1): Promise<ExecutionWorkerResponseV1> {
  const { request } = job;
  const prepared = await prepareSource(request);
  const options = {
    platform: "c64",
    cwd: request.caseRoot,
    sourceFiles: [prepared.sourcePath],
  };
  let response: ExecutionWorkerResponseV1;
  if (request.tier === "frontend") {
    const observed = compileWithEvidence(options, prepared.host);
    response = {
      revision: "execution-worker-response-v1",
      tier: "frontend",
      contract: "frontend-pipeline-v1",
      caseIdentity: request.caseIdentity,
      diagnostics: observed.evidence,
      semanticModelPresent: observed.result.semanticModel !== undefined,
      allocationPlanPresent: observed.result.allocationPlan !== undefined,
      emission: { il: false, assembly: false, binary: false },
    };
  } else if (request.tier === "compiler-api") {
    const observed = compileWithEvidence(options, prepared.host);
    response = {
      revision: "execution-worker-response-v1",
      tier: "compiler-api",
      contract: "compiler-evidence-facade-v1",
      caseIdentity: request.caseIdentity,
      hasErrors: observed.result.hasErrors,
      diagnostics: observed.evidence,
      emission: { il: false, assembly: false, binary: false },
    };
  } else if (request.tier === "emit") {
    const observed = emitAsmWithEvidence(options, prepared.host);
    const assemblyBytes = encodeAssembly(observed.result.text ?? "", job.outputLimitBytes);
    response = {
      revision: "execution-worker-response-v1",
      tier: "emit",
      contract: "assembly-emitter-v1",
      caseIdentity: request.caseIdentity,
      assemblyBytes,
      diagnostics: observed.evidence,
      emission: { il: false, assembly: false, binary: false },
    };
  } else {
    const output = new BoundedTextOutput(job.outputLimitBytes);
    let diagnostics: CompilerDiagnosticEvidenceV1 = {
      revision: "compiler-diagnostic-evidence-v1" as const,
      entries: Object.freeze([]),
    };
    const facade: CompilerEvidenceFacadeV1 = Object.freeze({
      compile: (selected: Parameters<CompilerEvidenceFacadeV1["compile"]>[0]) =>
        compileWithEvidence(selected, prepared.host),
      emitIl: (selected: Parameters<CompilerEvidenceFacadeV1["emitIl"]>[0]) =>
        emitIlWithEvidence(selected, prepared.host),
      emitAsm: (selected: Parameters<CompilerEvidenceFacadeV1["emitAsm"]>[0]) =>
        emitAsmWithEvidence(selected, prepared.host),
      build: (
        selected: Parameters<CompilerEvidenceFacadeV1["build"]>[0],
        _host: Parameters<CompilerEvidenceFacadeV1["build"]>[1],
        dependencies: Parameters<CompilerEvidenceFacadeV1["build"]>[2],
      ) => buildWithEvidence(selected, prepared.host, dependencies),
    });
    const exitCode = await runCli(
      [...request.argv],
      {
        writeOut: (text) => output.append("stdout", text),
        writeErr: (text) => output.append("stderr", text),
        isTTY: false,
        env: {},
        cwd: request.caseRoot,
      },
      {
        compilerFacade: facade,
        evidenceObserver: {
          onDiagnosticEvidence: (evidence) => {
            diagnostics = evidence;
          },
        },
      },
    );
    if (exitCode !== 0 && exitCode !== 1 && exitCode !== 2 && exitCode !== 3) {
      throw new TypeError("CLI returned an unsupported exit status.");
    }
    const streams = output.finish();
    response = {
      revision: "execution-worker-response-v1",
      tier: "cli",
      contract: "blendc-cli-v1",
      caseIdentity: request.caseIdentity,
      exitCode,
      stdout: streams.stdout,
      stderr: streams.stderr,
      diagnostics,
      emission: { il: false, assembly: false, binary: false },
    };
  }
  enforceEvidenceBound(response, job.evidenceLimitBytes);
  return response;
}

if (parentPort === null) throw new TypeError("Execution worker requires a parent port.");
const port = parentPort;

let busy = false;
port.on("message", async (input: unknown) => {
  if (busy || !isWorkerJob(input)) throw new TypeError("Execution worker received an invalid job.");
  busy = true;
  try {
    const response = await execute(input);
    const transfers: ArrayBuffer[] = [];
    if (response.tier === "cli") {
      transfers.push(response.stdout.buffer as ArrayBuffer, response.stderr.buffer as ArrayBuffer);
    } else if (response.tier === "emit") {
      transfers.push(response.assemblyBytes.buffer as ArrayBuffer);
    }
    port.postMessage(response, transfers);
  } finally {
    busy = false;
  }
});
port.postMessage({ revision: "execution-worker-ready-v1" });

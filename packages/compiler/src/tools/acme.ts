import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { lstat, mkdir, readFile, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import { verifyAcmeOutput } from "../artifacts/acme-output.js";
import type { CompleteC64Layout } from "../artifacts/acme-validate.js";
import type { AcmeSerializationResult } from "../artifacts/acme-serializer.js";
import { validateProjectName } from "../project/basename.js";
import type { AcmeToolIdentity } from "./discovery.js";

/** Inputs to one exact ACME 0.97 assembly attempt. */
export interface AcmeRunInput {
  /** Canonical version-probed executable identity. */
  readonly tool: AcmeToolIdentity;
  /** Absent unique directory owned by this attempt. */
  readonly stagingDirectory: string;
  /** Validated project basename used only for the primary PRG filename. */
  readonly artifactName: string;
  /** Previously validated terminal source and reconciliation facts. */
  readonly serialization: Extract<AcmeSerializationResult, { readonly kind: "complete" }>;
  /** Final layout used by the output verifier. */
  readonly layout: CompleteC64Layout;
  /** Optional cancellation signal. */
  readonly signal?: AbortSignal;
}

/** One ordinary ACME output retained after successful identity checks. */
export interface AcmeArtifactFile {
  /** Absolute staging path. */
  readonly path: string;
  /** Exact file byte count. */
  readonly bytes: number;
  /** Lowercase SHA-256 of the file bytes. */
  readonly sha256: string;
}

/** Exact verified files plus temporary report text needed by semantic reconciliation. */
export interface AcmeArtifactSet {
  /** Generated terminal source. */
  readonly assembly: AcmeArtifactFile;
  /** Published ACME symbol list. */
  readonly labels: AcmeArtifactFile;
  /** Primary Commodore PRG. */
  readonly prg: AcmeArtifactFile;
  /** Report text captured before its staging-only file was removed. */
  readonly report: string;
  /** Symbol-list text retained for parser reconciliation. */
  readonly labelText: string;
}

/** Exact assembler result or one bounded failure category. */
export type AcmeRunResult =
  | { readonly kind: "complete"; readonly artifacts: AcmeArtifactSet }
  | {
      readonly kind: "error";
      readonly reason:
        | "invalid-staging"
        | "output-conflict"
        | "process"
        | "diagnostic"
        | "output-limit"
        | "cancelled"
        | "invalid-output";
      readonly diagnostic: string;
    };

const PROCESS_OUTPUT_LIMIT = 1_048_576;
const PROCESS_TIMEOUT_MS = 30_000;

/** Build a safe immutable assembler failure. */
function failure(
  reason: Extract<AcmeRunResult, { readonly kind: "error" }>["reason"],
  diagnostic: string,
): AcmeRunResult {
  return Object.freeze({ kind: "error", reason, diagnostic });
}

/** Remove only this attempt's staging directory after a pre-publication failure. */
async function removeOwnedStaging(path: string): Promise<void> {
  try {
    await rm(path, { recursive: true, force: true });
  } catch {
    // Failure remains bounded to private staging; the caller receives the original tool error.
  }
}

/** Run ACME directly while bounding retained output and waiting for complete child exit. */
async function runProcess(
  executable: string,
  args: readonly string[],
  signal?: AbortSignal,
): Promise<
  | { readonly kind: "complete"; readonly stdout: string; readonly stderr: string }
  | { readonly kind: "error"; readonly reason: "process" | "output-limit" | "cancelled" }
> {
  if (signal?.aborted === true) return Object.freeze({ kind: "error", reason: "cancelled" });
  return new Promise((resolve) => {
    const child = spawn(executable, args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let settled = false;
    let limited = false;
    let cancelled = false;
    let timedOut = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = (
      result:
        | { readonly kind: "complete"; readonly stdout: string; readonly stderr: string }
        | { readonly kind: "error"; readonly reason: "process" | "output-limit" | "cancelled" },
    ) => {
      if (settled) return;
      settled = true;
      if (timeout !== undefined) clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      resolve(Object.freeze(result));
    };
    const stop = () => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 500).unref();
    };
    const abort = () => {
      cancelled = true;
      stop();
    };
    const append = (target: "stdout" | "stderr", chunk: Buffer) => {
      const retained = Buffer.byteLength(stdout) + Buffer.byteLength(stderr);
      const remaining = PROCESS_OUTPUT_LIMIT - retained;
      const text = remaining > 0 ? chunk.subarray(0, remaining).toString("utf8") : "";
      if (target === "stdout") stdout += text;
      else stderr += text;
      if (chunk.byteLength > remaining) {
        limited = true;
        stop();
      }
    };
    child.stdout.on("data", (chunk: Buffer) => append("stdout", chunk));
    child.stderr.on("data", (chunk: Buffer) => append("stderr", chunk));
    child.once("error", () =>
      finish({ kind: "error", reason: cancelled ? "cancelled" : "process" }),
    );
    child.once("close", (code) => {
      if (cancelled) finish({ kind: "error", reason: "cancelled" });
      else if (limited) finish({ kind: "error", reason: "output-limit" });
      else if (timedOut || code !== 0) finish({ kind: "error", reason: "process" });
      else finish({ kind: "complete", stdout, stderr });
    });
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted === true) abort();
    timeout = setTimeout(() => {
      timedOut = true;
      stop();
    }, PROCESS_TIMEOUT_MS);
    timeout.unref();
  });
}

/** File metadata retained only long enough to reject hard-link and replacement aliases. */
interface IdentifiedArtifact {
  /** Public byte/hash facts. */
  readonly file: AcmeArtifactFile;
  /** Native device identity. */
  readonly device: bigint;
  /** Native file identity within the device. */
  readonly inode: bigint;
  /** Stable bytes read between the two identity checks. */
  readonly content: Uint8Array;
}

/** Read and identify one expected ordinary output without following symbolic links. */
async function artifact(path: string): Promise<IdentifiedArtifact | null> {
  try {
    const metadata = await lstat(path, { bigint: true });
    if (!metadata.isFile() || metadata.isSymbolicLink()) return null;
    const bytes = await readFile(path);
    const after = await lstat(path, { bigint: true });
    if (
      !after.isFile() ||
      after.dev !== metadata.dev ||
      after.ino !== metadata.ino ||
      after.size !== metadata.size ||
      after.mtimeNs !== metadata.mtimeNs
    ) {
      return null;
    }
    return Object.freeze({
      file: Object.freeze({
        path,
        bytes: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      }),
      device: metadata.dev,
      inode: metadata.ino,
      content: bytes,
    });
  } catch {
    return null;
  }
}

/** Confirm that the version-probed executable still has its accepted content identity. */
async function toolMatches(tool: AcmeToolIdentity): Promise<boolean> {
  try {
    const bytes = await readFile(tool.executable);
    return createHash("sha256").update(bytes).digest("hex") === tool.sha256;
  } catch {
    return false;
  }
}

/**
 * Assemble one terminal source with the exact selected ACME argument vector.
 *
 * The function owns a newly created staging directory, never invokes a shell, rejects every stale
 * or unexpected output, and removes its temporary report only after retaining the text required by
 * the artifact verifier.
 *
 * @param input Version-probed tool, absent staging path, basename, source, layout, and cancellation.
 * @returns Validated ordinary files and report text, or a closed failure with no current record.
 * @example await runAcme({ tool, stagingDirectory, artifactName, serialization, layout })
 */
export async function runAcme(input: AcmeRunInput): Promise<AcmeRunResult> {
  if (
    !isAbsolute(input.stagingDirectory) ||
    basename(input.stagingDirectory).length === 0 ||
    validateProjectName(input.artifactName).kind !== "success"
  ) {
    return failure(
      "invalid-staging",
      "ACME staging requires an absolute path and valid artifact name",
    );
  }
  if (!(await toolMatches(input.tool))) {
    return failure("process", "The selected ACME executable changed after discovery");
  }
  try {
    await mkdir(input.stagingDirectory, { recursive: false });
  } catch {
    return failure("invalid-staging", "The unique ACME staging directory must be absent");
  }
  const assemblyPath = join(input.stagingDirectory, ".asm");
  const labelsPath = join(input.stagingDirectory, ".labels");
  const reportPath = join(input.stagingDirectory, ".acme.report");
  const prgPath = join(input.stagingDirectory, `${input.artifactName}.prg`);
  if (
    [assemblyPath, labelsPath, reportPath, prgPath].some(
      (path) => dirname(path) !== input.stagingDirectory,
    )
  ) {
    await removeOwnedStaging(input.stagingDirectory);
    return failure("output-conflict", "An ACME output escaped its owned staging directory");
  }
  try {
    await writeFile(assemblyPath, input.serialization.source, { encoding: "utf8", flag: "wx" });
  } catch {
    await removeOwnedStaging(input.stagingDirectory);
    return failure("output-conflict", "The terminal source could not be created exclusively");
  }
  const sourceBefore = await artifact(assemblyPath);
  if (sourceBefore === null) {
    await removeOwnedStaging(input.stagingDirectory);
    return failure("invalid-output", "The terminal source is not an owned ordinary file");
  }
  const args = [
    "--cpu",
    "6502",
    "--strict-segments",
    "--format",
    "cbm",
    "--outfile",
    prgPath,
    "--report",
    reportPath,
    "--symbollist",
    labelsPath,
    assemblyPath,
  ] as const;
  const processResult = await runProcess(input.tool.executable, args, input.signal);
  if (processResult.kind === "error") {
    await removeOwnedStaging(input.stagingDirectory);
    return failure(processResult.reason, `ACME execution failed: ${processResult.reason}`);
  }
  if (/\b(?:error|serious)\b/i.test(`${processResult.stdout}\n${processResult.stderr}`)) {
    await removeOwnedStaging(input.stagingDirectory);
    return failure("diagnostic", "ACME reported an error diagnostic despite a zero exit status");
  }
  if (!(await toolMatches(input.tool))) {
    await removeOwnedStaging(input.stagingDirectory);
    return failure("process", "The selected ACME executable changed during execution");
  }
  const names = (await readdir(input.stagingDirectory)).sort();
  const expectedNames = [".acme.report", ".asm", ".labels", `${input.artifactName}.prg`].sort();
  if (names.join("\u0000") !== expectedNames.join("\u0000")) {
    await removeOwnedStaging(input.stagingDirectory);
    return failure("invalid-output", "ACME produced a missing or unexpected staging entry");
  }
  const [assembly, labels, report, prg] = await Promise.all([
    artifact(assemblyPath),
    artifact(labelsPath),
    artifact(reportPath),
    artifact(prgPath),
  ]);
  if (assembly === null || labels === null || report === null || prg === null) {
    await removeOwnedStaging(input.stagingDirectory);
    return failure("invalid-output", "ACME output is not a complete ordinary-file set");
  }
  const identified = [assembly, labels, report, prg];
  const identities = new Set(identified.map(({ device, inode }) => `${device}:${inode}`));
  if (assembly.file.sha256 !== sourceBefore.file.sha256 || identities.size !== identified.length) {
    await removeOwnedStaging(input.stagingDirectory);
    return failure("invalid-output", "ACME changed its source or aliased its output identities");
  }
  const verification = verifyAcmeOutput({
    serialization: input.serialization,
    layout: input.layout,
    report: report.content,
    labels: labels.content,
    prg: prg.content,
  });
  if (verification.kind === "error") {
    await removeOwnedStaging(input.stagingDirectory);
    return failure("invalid-output", verification.diagnostic);
  }
  try {
    await unlink(reportPath);
    return Object.freeze({
      kind: "complete",
      artifacts: Object.freeze({
        assembly: assembly.file,
        labels: labels.file,
        prg: prg.file,
        report: verification.report,
        labelText: verification.labels,
      }),
    });
  } catch {
    await removeOwnedStaging(input.stagingDirectory);
    return failure("invalid-output", "ACME report or symbol output changed during reconciliation");
  }
}

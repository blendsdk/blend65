import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, readFile, realpath, stat } from "node:fs/promises";
import { delimiter, isAbsolute, join, resolve } from "node:path";
import { spawn } from "node:child_process";

/** Canonical identity of the one accepted terminal ACME tool. */
export interface AcmeToolIdentity {
  /** Canonical executable path. */
  readonly executable: string;
  /** Exact accepted release. */
  readonly version: "0.97";
  /** Exact accepted version line without a trailing line break. */
  readonly versionLine: string;
  /** Lowercase SHA-256 of the executable file. */
  readonly sha256: string;
}

/** Explicit discovery inputs; omitted values use the current process environment. */
export interface AcmeDiscoveryInput {
  /** Absolute candidate which takes precedence over PATH. */
  readonly explicitPath?: string;
  /** Ordered PATH spelling; omitted reads process.env.PATH once. */
  readonly path?: string;
  /** Optional working directory used to resolve relative PATH entries. */
  readonly cwd?: string;
  /** Optional cancellation signal. */
  readonly signal?: AbortSignal;
}

/** Exact tool discovery result or one bounded failure category. */
export type AcmeDiscoveryResult =
  | { readonly kind: "complete"; readonly tool: AcmeToolIdentity }
  | {
      readonly kind: "error";
      readonly reason:
        | "invalid-path"
        | "not-found"
        | "version-mismatch"
        | "process"
        | "output-limit"
        | "cancelled";
      readonly diagnostic: string;
    };

const VERSION_OUTPUT_LIMIT = 65_536;
const VERSION_TIMEOUT_MS = 5_000;

/** Build a safe immutable discovery failure. */
function failure(
  reason: Extract<AcmeDiscoveryResult, { readonly kind: "error" }>["reason"],
  diagnostic: string,
): AcmeDiscoveryResult {
  return Object.freeze({ kind: "error", reason, diagnostic });
}

/** Resolve one executable candidate without accepting directories or unreadable files. */
async function resolveExecutable(candidate: string): Promise<string | null> {
  try {
    const canonical = await realpath(candidate);
    const metadata = await stat(canonical);
    if (!metadata.isFile()) return null;
    await access(canonical, constants.X_OK);
    return canonical;
  } catch {
    return null;
  }
}

/** One accepted version line or one bounded probe failure. */
type VersionProbeResult =
  | { readonly kind: "accepted"; readonly line: string }
  | { readonly kind: "version" | "process" | "limit" | "cancelled" };

/** Probe the candidate directly and retain at most the fixed version-output bound. */
async function probeVersion(executable: string, signal?: AbortSignal): Promise<VersionProbeResult> {
  if (signal?.aborted === true) return { kind: "cancelled" };
  return new Promise((resolve) => {
    const child = spawn(executable, ["--version"], {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let settled = false;
    let limited = false;
    let cancelled = false;
    let timedOut = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = (result: VersionProbeResult) => {
      if (settled) return;
      settled = true;
      if (timeout !== undefined) clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      resolve(result);
    };
    const stop = () => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 250).unref();
    };
    const abort = () => {
      cancelled = true;
      stop();
    };
    const append = (chunk: Buffer) => {
      const remaining = VERSION_OUTPUT_LIMIT - Buffer.byteLength(output);
      if (remaining > 0) output += chunk.subarray(0, remaining).toString("utf8");
      if (chunk.byteLength > remaining) {
        limited = true;
        stop();
      }
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.once("error", () => finish({ kind: cancelled ? "cancelled" : "process" }));
    child.once("close", (code) => {
      if (cancelled) finish({ kind: "cancelled" });
      else if (limited) finish({ kind: "limit" });
      else if (timedOut) finish({ kind: "process" });
      else if (code !== 0) finish({ kind: "process" });
      else {
        const accepted = output
          .split(/\r?\n/u)
          .find((line) => /^This is ACME, release 0\.97(?=$|[\s(])/u.test(line));
        finish(accepted === undefined ? { kind: "version" } : { kind: "accepted", line: accepted });
      }
    });
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted === true) abort();
    timeout = setTimeout(() => {
      timedOut = true;
      stop();
    }, VERSION_TIMEOUT_MS);
    timeout.unref();
  });
}

/**
 * Discover and version-probe ACME without a shell, fallback search, or installation behavior.
 *
 * An explicit absolute path wins. Otherwise the first executable named `acme` on Unix or
 * `acme.exe` on Windows in the ordered PATH
 * is authoritative: a wrong version fails discovery rather than silently selecting a later tool.
 *
 * @param input Optional explicit path, PATH snapshot, and cancellation signal.
 * @returns The canonical ACME 0.97 identity or a closed failure.
 * @example await discoverAcme({ explicitPath: "/usr/bin/acme" })
 */
export async function discoverAcme(input: AcmeDiscoveryInput = {}): Promise<AcmeDiscoveryResult> {
  let candidate: string | null = null;
  if (input.explicitPath !== undefined) {
    if (!isAbsolute(input.explicitPath)) {
      return failure("invalid-path", "The explicit ACME path must be absolute");
    }
    candidate = await resolveExecutable(input.explicitPath);
    if (candidate === null) {
      return failure("invalid-path", "The explicit ACME path is not an executable regular file");
    }
  } else {
    const pathValue = input.path ?? process.env.PATH ?? "";
    const cwd = input.cwd ?? process.cwd();
    for (const entry of pathValue.split(delimiter)) {
      if (entry.length === 0) continue;
      const directory = resolve(cwd, entry);
      const found = await resolveExecutable(
        join(directory, process.platform === "win32" ? "acme.exe" : "acme"),
      );
      if (found !== null) {
        candidate = found;
        break;
      }
    }
    if (candidate === null) return failure("not-found", "ACME was not found on the ordered PATH");
  }
  const probe = await probeVersion(candidate, input.signal);
  if (probe.kind !== "accepted") {
    const reason =
      probe.kind === "version"
        ? "version-mismatch"
        : probe.kind === "limit"
          ? "output-limit"
          : probe.kind;
    return failure(reason, `ACME version probe failed: ${reason}`);
  }
  try {
    const bytes = await readFile(candidate);
    return Object.freeze({
      kind: "complete",
      tool: Object.freeze({
        executable: candidate,
        version: "0.97",
        versionLine: probe.line,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      }),
    });
  } catch {
    return failure("process", "The accepted ACME executable changed before identity capture");
  }
}

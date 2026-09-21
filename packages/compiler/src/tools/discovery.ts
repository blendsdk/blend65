import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, readFile, realpath, stat } from "node:fs/promises";
import { delimiter, isAbsolute, join } from "node:path";
import { spawn } from "node:child_process";

/** Canonical identity of the one accepted terminal ACME tool. */
export interface AcmeToolIdentity {
  /** Canonical executable path. */
  readonly executable: string;
  /** Exact accepted release. */
  readonly version: "0.97";
  /** Lowercase SHA-256 of the executable file. */
  readonly sha256: string;
}

/** Explicit discovery inputs; omitted values use the current process environment. */
export interface AcmeDiscoveryInput {
  /** Absolute candidate which takes precedence over PATH. */
  readonly explicitPath?: string;
  /** Ordered PATH spelling; omitted reads process.env.PATH once. */
  readonly path?: string;
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

/** Probe the candidate directly and retain at most the fixed version-output bound. */
async function probeVersion(
  executable: string,
  signal?: AbortSignal,
): Promise<"accepted" | "version" | "process" | "limit" | "cancelled"> {
  if (signal?.aborted === true) return "cancelled";
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
    const finish = (result: "accepted" | "version" | "process" | "limit" | "cancelled") => {
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
    child.once("error", () => finish(cancelled ? "cancelled" : "process"));
    child.once("close", (code) => {
      if (cancelled) finish("cancelled");
      else if (limited) finish("limit");
      else if (timedOut) finish("process");
      else if (code !== 0) finish("process");
      else {
        const accepted = /\brelease\s+0\.97(?=$|[\s(])/iu.test(output);
        finish(accepted ? "accepted" : "version");
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
 * An explicit absolute path wins. Otherwise the first executable named `acme` in the ordered PATH
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
    for (const entry of pathValue.split(delimiter)) {
      if (entry.length === 0 || !isAbsolute(entry)) continue;
      const found = await resolveExecutable(join(entry, "acme"));
      if (found !== null) {
        candidate = found;
        break;
      }
    }
    if (candidate === null) return failure("not-found", "ACME was not found on the ordered PATH");
  }
  const probe = await probeVersion(candidate, input.signal);
  if (probe !== "accepted") {
    const reason =
      probe === "version" ? "version-mismatch" : probe === "limit" ? "output-limit" : probe;
    return failure(reason, `ACME version probe failed: ${reason}`);
  }
  try {
    const bytes = await readFile(candidate);
    return Object.freeze({
      kind: "complete",
      tool: Object.freeze({
        executable: candidate,
        version: "0.97",
        sha256: createHash("sha256").update(bytes).digest("hex"),
      }),
    });
  } catch {
    return failure("process", "The accepted ACME executable changed before identity capture");
  }
}

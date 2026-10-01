import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, readFile, realpath, stat } from "node:fs/promises";
import { basename, delimiter, dirname, isAbsolute, join } from "node:path";
import { selectC64KernalFacts } from "../profile/c64-kernal.js";
import type { C64KernalProfileId } from "../profile/c64-kernal.js";

const VICE_OUTPUT_LIMIT = 65_536;
const VICE_PROBE_TIMEOUT_MS = 5_000;
const PROCESS_STOP_GRACE_MS = 500;
const WINDOWS_TREE_STOP_MS = 3_000;
const WINDOWS_VICE_310_FILES = Object.freeze([
  ["bin/x64sc.exe", "b48f9117916e960ca6a59ca32bc63765f9b30f2b6bb3ef056514c8bcce0a7030"],
  ["bin/c1541.exe", "34d627aa7733d57447bd89d93993c0dbf04054c0fb687ffe7c762bcfa3204aed"],
  ["C64/kernal-901227-03.bin", "83c60d47047d7beab8e5b7bf6f67f80daa088b7a6a27de0d7e016f6484042721"],
  ["C64/basic-901226-01.bin", "89878cea0a268734696de11c4bae593eaaa506465d2029d619c0e0cbccdfa62d"],
  ["C64/chargen-901225-01.bin", "fd0d53b8480e86163ac98998976c72cc58d5dd8eb824ed7b829774e74213b420"],
] as const);

/** Send one signal to the complete owned Linux group or the portable direct child. */
function signalOwnedProcess(
  child: ChildProcess,
  processGroup: boolean,
  signal: NodeJS.Signals,
): void {
  try {
    if (processGroup && child.pid !== undefined) process.kill(-child.pid, signal);
    else child.kill(signal);
  } catch {
    // ESRCH means the owned process set is already gone; cleanup confirmation follows.
  }
}

/** Check whether any process remains in the owned group or direct-child fallback. */
function ownedProcessExists(child: ChildProcess, processGroup: boolean): boolean {
  if (!processGroup) return child.exitCode === null && child.signalCode === null;
  if (child.pid === undefined) return false;
  try {
    process.kill(-child.pid, 0);
    return true;
  } catch (error) {
    return error instanceof Error && "code" in error && error.code === "EPERM";
  }
}

/** Wait briefly for the owned process set to disappear without blocking the event loop. */
async function waitForOwnedExit(child: ChildProcess, processGroup: boolean): Promise<boolean> {
  const deadline = performance.now() + PROCESS_STOP_GRACE_MS;
  while (ownedProcessExists(child, processGroup) && performance.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
  return !ownedProcessExists(child, processGroup);
}

/** Terminate within a fixed bound; uncertain exit releases host handles, not artifact pins. */
async function stopOwnedProcess(
  child: ChildProcess,
  processGroup: boolean,
  requireTreeProof = false,
): Promise<boolean> {
  if (!ownedProcessExists(child, processGroup))
    return !(process.platform === "win32" && requireTreeProof);
  if (process.platform === "win32") {
    const root = process.env.SystemRoot ?? process.env.WINDIR;
    const pid = child.pid;
    let treeStopped = false;
    if (root && isAbsolute(root) && pid !== undefined) {
      treeStopped = await new Promise<boolean>((resolve) => {
        const killer = spawn(
          join(root, "System32", "taskkill.exe"),
          ["/PID", String(pid), "/T", "/F"],
          {
            shell: false,
            stdio: "ignore",
            windowsHide: true,
          },
        );
        let done = false;
        const finish = (result: boolean) => {
          if (done) return;
          done = true;
          clearTimeout(timeout);
          resolve(result);
        };
        killer.once("error", () => finish(false));
        killer.once("close", (code) => finish(code === 0));
        const timeout = setTimeout(() => {
          killer.kill("SIGKILL");
          finish(false);
        }, WINDOWS_TREE_STOP_MS);
        timeout.unref();
      });
    }
    const stopped = await waitForOwnedExit(child, false);
    if (treeStopped && stopped) return true;
    child.stdout?.destroy();
    child.stderr?.destroy();
    child.unref();
    return false;
  }
  signalOwnedProcess(child, processGroup, "SIGTERM");
  if (await waitForOwnedExit(child, processGroup)) return true;
  signalOwnedProcess(child, processGroup, "SIGKILL");
  const stopped = await waitForOwnedExit(child, processGroup);
  if (!stopped) {
    // An un-stoppable child must not keep the caller alive after it reports recovery-required.
    // Closing our pipe ends does not prove child exit; the caller must still retain its pin.
    child.stdout?.destroy();
    child.stderr?.destroy();
    child.unref();
  }
  return stopped;
}

/** Resolve the native executable from the first absolute PATH entry that owns it. */
export async function findVice(): Promise<string | null> {
  for (const entry of (process.env.PATH ?? "").split(delimiter)) {
    if (!isAbsolute(entry) || entry.length === 0) continue;
    try {
      const candidate = await realpath(
        join(entry, process.platform === "win32" ? "x64sc.exe" : "x64sc"),
      );
      const metadata = await stat(candidate);
      if (!metadata.isFile()) continue;
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Continue the fixed ordered PATH scan.
    }
  }
  return null;
}

type VersionProbeResult =
  | { readonly kind: "complete"; readonly output: string }
  | { readonly kind: "failure" | "cancelled" | "cleanup-uncertain" };

/** Run one bounded version probe and confirm its process has stopped. */
async function runVersionProbe(
  executable: string,
  args: readonly string[],
  signal?: AbortSignal,
): Promise<VersionProbeResult> {
  if (signal?.aborted === true) return { kind: "cancelled" };
  return new Promise((resolve) => {
    const processGroup = process.platform !== "win32";
    const child = spawn(executable, args, {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      detached: processGroup,
    });
    let output = "";
    let retainedBytes = 0;
    let settled = false;
    let outcome: "normal" | "limit" | "timeout" | "cancelled" | "process" = "normal";
    let cleanup: Promise<boolean> | null = null;
    const requestStop = (next: Exclude<typeof outcome, "normal">) => {
      if (outcome !== "normal") return;
      outcome = next;
      cleanup = stopOwnedProcess(child, processGroup, true);
      // Failed termination need not produce a close event. Settle after the bounded attempt
      // so the caller can retain its generation pin and report manual recovery.
      void cleanup.then(() => finish(null));
    };
    const finish = async (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      const cleaned = await (cleanup ??
        stopOwnedProcess(child, processGroup, outcome !== "normal"));
      if (!cleaned) resolve({ kind: "cleanup-uncertain" });
      else if (outcome === "cancelled") resolve({ kind: "cancelled" });
      else if (outcome !== "normal" || code !== 0) resolve({ kind: "failure" });
      else resolve({ kind: "complete", output });
    };
    const abort = () => requestStop("cancelled");
    const append = (chunk: Buffer) => {
      const remaining = VICE_OUTPUT_LIMIT - retainedBytes;
      if (remaining > 0) {
        const retained = chunk.subarray(0, remaining);
        output += retained.toString("utf8");
        retainedBytes += retained.byteLength;
      }
      if (chunk.byteLength > remaining) requestStop("limit");
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.once("error", () => {
      if (outcome === "normal") outcome = "process";
      void finish(null);
    });
    child.once("close", (code) => void finish(code));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted === true) abort();
    const timeout = setTimeout(() => requestStop("timeout"), VICE_PROBE_TIMEOUT_MS);
    timeout.unref();
  });
}

/** Verify the exact supplied Windows bundle before using its console companion as version authority. */
async function pinnedWindowsVice(
  executable: string,
  signal?: AbortSignal,
): Promise<boolean | "cancelled" | "cleanup-uncertain"> {
  try {
    const canonical = await realpath(executable);
    if (basename(canonical).toLowerCase() !== "x64sc.exe") return false;
    const bin = dirname(canonical);
    const bundle = dirname(bin);
    for (const [name, expected] of WINDOWS_VICE_310_FILES) {
      signal?.throwIfAborted();
      const candidate = join(bundle, name);
      if ((await realpath(candidate)) !== candidate) return false;
      const actual = createHash("sha256")
        .update(await readFile(candidate))
        .digest("hex");
      if (actual !== expected) return false;
    }
    signal?.throwIfAborted();
    const companion = await runVersionProbe(join(bin, "c1541.exe"), ["-version"], signal);
    if (companion.kind === "cancelled" || companion.kind === "cleanup-uncertain")
      return companion.kind;
    return (
      companion.kind === "complete" &&
      companion.output.split(/\r?\n/u).some((line) => /^c1541 \(VICE 3\.10\)$/u.test(line))
    );
  } catch {
    return signal?.aborted === true ? "cancelled" : false;
  }
}

/** Verify VICE 3.10 directly, or the approved pinned Windows bundle when the GUI emits no banner. */
export async function probeVice(
  executable: string,
  signal?: AbortSignal,
): Promise<boolean | "cancelled" | "cleanup-uncertain"> {
  const direct = await runVersionProbe(executable, ["-version"], signal);
  if (direct.kind !== "complete") return direct.kind === "failure" ? false : direct.kind;
  if (
    direct.output
      .split(/\r?\n/u)
      .some((line) => /^x64sc(?:\.exe)? \(VICE 3\.10(?:\.0)?(?: SVN r[0-9]+)?\)$/u.test(line))
  )
    return true;
  if (process.platform !== "win32" || direct.output.trim() !== "") return false;
  if (signal?.aborted === true) return "cancelled";
  return pinnedWindowsVice(executable, signal);
}

/**
 * Start the generation's exact cooperative profile using fixed arguments and no shell.
 * Unknown identities fail before spawning; uncertain cleanup leaves pin ownership to the caller.
 * @example await launchVice(executable, prg, "c64-ntsc-prg-kernal-8580", signal)
 */
export async function launchVice(
  executable: string,
  prg: string,
  profileId: C64KernalProfileId,
  signal?: AbortSignal,
): Promise<"complete" | "start" | "runtime" | "cancelled" | "cleanup-uncertain"> {
  if (signal?.aborted === true) return "cancelled";
  const profile = selectC64KernalFacts(profileId);
  if (profile === null) return "start";
  const pal = profile.video === "pal";
  return new Promise((resolve) => {
    const processGroup = process.platform !== "win32";
    const child = spawn(
      executable,
      [
        "-default",
        "-model",
        pal ? "c64" : "ntsc",
        pal ? "-pal" : "-ntsc",
        "-VICIImodel",
        pal ? "6569" : "6567",
        "-sidmodel",
        profile.sidModel === 6581 ? "0" : "1",
        "-ciamodel",
        "0",
        "-autostart",
        prg,
      ],
      { shell: false, stdio: "ignore", detached: processGroup },
    );
    let started = false;
    let cancelledRun = false;
    let settled = false;
    let cleanup: Promise<boolean> | null = null;
    const abort = () => {
      if (cancelledRun) return;
      cancelledRun = true;
      cleanup = stopOwnedProcess(child, processGroup, true);
      // Cancellation must finish even when a denied signal leaves the emulator alive.
      void cleanup.then((cleaned) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener("abort", abort);
        resolve(cleaned ? "cancelled" : "cleanup-uncertain");
      });
    };
    child.once("spawn", () => {
      started = true;
    });
    child.once("error", async () => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      const cleaned = await (cleanup ?? stopOwnedProcess(child, processGroup));
      resolve(!cleaned ? "cleanup-uncertain" : cancelledRun ? "cancelled" : "start");
    });
    child.once("close", async (code) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      const cleaned = await (cleanup ?? stopOwnedProcess(child, processGroup));
      resolve(
        !cleaned
          ? "cleanup-uncertain"
          : cancelledRun
            ? "cancelled"
            : started && code === 0
              ? "complete"
              : "runtime",
      );
    });
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted === true) abort();
  });
}

import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { constants } from "node:fs";
import { access, realpath, stat } from "node:fs/promises";
import { delimiter, isAbsolute, join } from "node:path";
import { selectC64KernalFacts } from "../profile/c64-kernal.js";
import type { C64KernalProfileId } from "../profile/c64-kernal.js";

const VICE_OUTPUT_LIMIT = 65_536;
const VICE_PROBE_TIMEOUT_MS = 5_000;
const PROCESS_STOP_GRACE_MS = 500;

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
async function stopOwnedProcess(child: ChildProcess, processGroup: boolean): Promise<boolean> {
  if (!ownedProcessExists(child, processGroup)) return true;
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

/** Resolve one executable from the first absolute PATH entry that owns it. */
export async function findVice(): Promise<string | null> {
  for (const entry of (process.env.PATH ?? "").split(delimiter)) {
    if (!isAbsolute(entry) || entry.length === 0) continue;
    try {
      const candidate = await realpath(join(entry, "x64sc"));
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

/** Run one bounded version probe without invoking a shell. */
export async function probeVice(
  executable: string,
  signal?: AbortSignal,
): Promise<boolean | "cancelled" | "cleanup-uncertain"> {
  if (signal?.aborted === true) return "cancelled";
  return new Promise((resolve) => {
    const processGroup = process.platform !== "win32";
    const child = spawn(executable, ["--version"], {
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
      cleanup = stopOwnedProcess(child, processGroup);
      // Failed termination need not produce a close event. Settle after the bounded attempt
      // so the caller can retain its generation pin and report manual recovery.
      void cleanup.then(() => finish(null));
    };
    const finish = async (code: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      const cleaned = await (cleanup ?? stopOwnedProcess(child, processGroup));
      if (!cleaned) resolve("cleanup-uncertain");
      else if (outcome === "cancelled") resolve("cancelled");
      else if (outcome !== "normal" || code !== 0) resolve(false);
      else {
        const exactBanner = output
          .split(/\r?\n/u)
          .some(
            (line) => /(?:VICE|x64sc)/iu.test(line) && /(?:^|[\s(])3\.10(?=$|[\s)])/u.test(line),
          );
        resolve(exactBanner);
      }
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
      cleanup = stopOwnedProcess(child, processGroup);
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

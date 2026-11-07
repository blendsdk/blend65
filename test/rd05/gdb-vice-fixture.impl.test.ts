import { spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { stopGdbVice, type OwnedProcess } from "./gdb-vice-fixture.js";

/** Read the kernel start time that distinguishes a live process from a reused pid. */
async function startTime(processId: number): Promise<string> {
  const stat = await readFile(`/proc/${processId}/stat`, "utf8");
  const close = stat.lastIndexOf(")");
  if (close < 0) throw new Error("Missing process stat terminator");
  const value = stat.slice(close + 2).split(" ")[19];
  if (value === undefined) throw new Error("Missing process start time");
  return value;
}

/** Spawn one long-lived shell that optionally ignores the polite termination signal. */
function spawnSleeper(ignoreTerm: boolean): ChildProcess {
  const command = ignoreTerm ? "trap '' TERM; sleep 30" : "sleep 30";
  return spawn("bash", ["-c", command], { detached: true, stdio: "ignore" });
}

/** Wait for a child exit without leaking a listener or timer. */
function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      child.off("exit", onExit);
      resolve(false);
    }, timeoutMs);
    const onExit = (): void => {
      clearTimeout(timer);
      resolve(true);
    };
    child.once("exit", onExit);
  });
}

/** Report whether the exact process is still alive. */
function alive(processId: number): boolean {
  try {
    process.kill(processId, 0);
    return true;
  } catch {
    return false;
  }
}

/** Ensure a failed assertion cannot leave an owned test process behind. */
async function forceKill(child: ChildProcess): Promise<void> {
  const pid = child.pid;
  if (pid === undefined) return;
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    // The process already exited.
  }
  await waitForExit(child, 2_000);
}

describe("debugger-owned process cleanup", () => {
  it("should escalate a TERM-ignoring inferior instead of treating the first poll as exit", async () => {
    const gdb = spawnSleeper(false);
    const inferior = spawnSleeper(true);
    try {
      const inferiorPid = inferior.pid;
      if (inferiorPid === undefined) throw new Error("Inferior has no pid");
      const owned: OwnedProcess = { pid: inferiorPid, startTime: await startTime(inferiorPid) };
      await stopGdbVice({ gdb, inferior: owned });
      expect(await waitForExit(inferior, 1_000)).toBe(true);
      expect(alive(inferiorPid)).toBe(false);
      expect(await waitForExit(gdb, 1_000)).toBe(true);
    } finally {
      await forceKill(inferior);
      await forceKill(gdb);
    }
  }, 15_000);

  it("should reject a reused pid whose start time no longer matches discovery", async () => {
    const gdb = spawnSleeper(false);
    const replacement = spawnSleeper(false);
    try {
      const replacementPid = replacement.pid;
      if (replacementPid === undefined) throw new Error("Replacement has no pid");
      // The recorded identity belongs to a process that is already gone; the
      // live process at the same pid is not the one that was attested.
      const stale: OwnedProcess = { pid: replacementPid, startTime: "0" };
      await stopGdbVice({ gdb, inferior: stale });
      expect(await waitForExit(gdb, 1_000)).toBe(true);
      expect(alive(replacementPid)).toBe(true);
    } finally {
      await forceKill(replacement);
      await forceKill(gdb);
    }
  }, 15_000);
});

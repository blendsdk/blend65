import { spawn, type ChildProcess } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { readFile, readlink, realpath, writeFile } from "node:fs/promises";
import type { TypedProgram } from "@blend65/compiler/frontend";
import { openViceMonitor, type ViceMonitor } from "../m1/vice-monitor.js";
import {
  viceLaunchArguments,
  viceLoopbackPort,
  viceRuntimeIdentity,
  type ViceRuntimeIdentity,
} from "../m1/vice-runtime.js";

/** Reuse the compiler's exact profile identity through its existing public frontend type. */
export type GdbProfileId = NonNullable<TypedProgram["profile"]>["id"];

/** Held matrix state and optional RESTORE pulse applied on the emulation thread. */
export interface GdbInjection {
  /** VICE keyboard matrix entries indexed by PA line; each entry is a PB bit mask. */
  readonly matrix: readonly number[];
  /** Assert the RESTORE NMI source when present; VICE raises and releases the pulse. */
  readonly restore?: 0 | 1;
}

/** Files owned by one debugger-wrapped native qualification run. */
export interface GdbVicePaths {
  /** JSON file read by the debugger at every injection breakpoint. */
  readonly injection: string;
  /** Generated debugger command file. */
  readonly script: string;
  /** Debugger transcript for failure diagnosis. */
  readonly log: string;
}

/** Live debugger, emulator monitor and exact runtime identity for one native run. */
export interface StartedGdbVice {
  /** Debugger process whose detached group owns the emulator. */
  readonly gdb: ChildProcess;
  /** Attested binary-monitor connection to the emulator. */
  readonly monitor: ViceMonitor;
  /** Exact executable and ROM identity used by the emulator. */
  readonly identity: ViceRuntimeIdentity;
  /** Attested VICE inferior process, which GDB may place in its own process group. */
  readonly inferiorPid: number;
  /** Paths used by this run. */
  readonly paths: GdbVicePaths;
}

/**
 * Build the debugger script that injects a real VICE keyboard matrix and RESTORE edge.
 *
 * GDB breaks at the emulation-thread keyboard-feed entry, reads the JSON description,
 * calls the unmodified VICE input functions, then continues. The breakpoint condition
 * excludes KERNAL/ROM addresses so ordinary startup activity cannot receive an
 * unintended injection.
 */
function gdbCommandFile(): string {
  return `set pagination off
set confirm off
set breakpoint pending on
set debuginfod enabled off
break kbdbuf_feed if reg_pc < 0xC000
commands
  silent
  python
import gdb, json, os
spec = json.load(open(os.environ["B65_INJECT"]))
matrix = ", ".join(str(int(v)) for v in spec["matrix"])
gdb.execute("set $matrix = {int[16]} {%s}" % matrix)
gdb.execute("call keyboard_event_playback(0, $matrix)")
if "restore" in spec:
    gdb.execute("call machine_set_restore_key(%d)" % int(spec["restore"]))
end
  continue
end
run
`;
}

/** Wait for one child exit without leaking a timer or listener. */
function waitForExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true);
  return new Promise<boolean>((resolveExit) => {
    const onExit = (): void => {
      clearTimeout(timer);
      resolveExit(true);
    };
    const timer = setTimeout(() => {
      child.off("exit", onExit);
      resolveExit(false);
    }, timeoutMs);
    child.once("exit", onExit);
  });
}

/** One process identity that cannot be confused with a later reuse of the same pid. */
interface OwnedProcess {
  /** Linux process identity. */
  readonly pid: number;
  /** Kernel start time, which changes when the pid is reused. */
  readonly startTime: string;
}

/** Read the kernel start time that distinguishes this pid from a later reuse. */
async function processStartTime(processId: number): Promise<string | null> {
  try {
    const stat = await readFile(`/proc/${processId}/stat`, "utf8");
    const close = stat.lastIndexOf(")");
    if (close < 0) return null;
    const fields = stat.slice(close + 2).split(" ");
    // Field 3 is state; the kernel start time is field 22.
    return fields[19] ?? null;
  } catch {
    return null;
  }
}

/** Return the direct children of one Linux process from procfs. */
async function childPids(processId: number): Promise<readonly number[]> {
  try {
    const text = await readFile(`/proc/${processId}/task/${processId}/children`, "utf8");
    return text
      .trim()
      .split(/\s+/u)
      .flatMap((token) => {
        const pid = Number.parseInt(token, 10);
        return Number.isInteger(pid) && pid > 0 ? [pid] : [];
      });
  } catch {
    return [];
  }
}

/** Resolve one process executable without following an exited pid into a reused identity. */
async function processExecutable(processId: number): Promise<string | null> {
  try {
    return await realpath(await readlink(`/proc/${processId}/exe`));
  } catch {
    return null;
  }
}

/** Find the attested emulator descendant of the debugger process. */
async function findInferior(processId: number, executable: string): Promise<number | undefined> {
  for (const child of await childPids(processId)) {
    if ((await processExecutable(child)) === executable) return child;
    const found = await findInferior(child, executable);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** Collect one process subtree with identities before any signal is sent. */
async function collectOwned(processId: number, result: Map<number, OwnedProcess>): Promise<void> {
  if (result.has(processId)) return;
  const startTime = await processStartTime(processId);
  if (startTime === null) return;
  result.set(processId, { pid: processId, startTime });
  for (const child of await childPids(processId)) await collectOwned(child, result);
}

/** Treat a zombie as terminated, since its pid can no longer execute or own the monitor. */
async function processTerminated(process: OwnedProcess): Promise<boolean> {
  const startTime = await processStartTime(process.pid);
  return startTime === null || startTime !== process.startTime || (await isZombie(process.pid));
}

/** Report whether the current process at this pid is a zombie. */
async function isZombie(processId: number): Promise<boolean> {
  try {
    const stat = await readFile(`/proc/${processId}/stat`, "utf8");
    const close = stat.lastIndexOf(")");
    return close >= 0 && stat.slice(close + 2).split(" ", 1)[0] === "Z";
  } catch {
    return true;
  }
}

/** Signal one process only while its recorded identity still matches. */
async function signalOwned(process: OwnedProcess, signal: NodeJS.Signals): Promise<void> {
  const current = await processStartTime(process.pid);
  if (current === null || current !== process.startTime) return;
  try {
    process.kill(process.pid, signal);
  } catch {
    // A concurrently exited owned process needs no signal.
  }
}

/** Poll every owned process for termination for a bounded interval. */
async function waitForOwnedExit(
  processes: Iterable<OwnedProcess>,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const states = await Promise.all([...processes].map(processTerminated));
    if (states.every(Boolean)) return true;
    await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }
  const states = await Promise.all([...processes].map(processTerminated));
  return states.every(Boolean);
}

/**
 * Start the pinned VICE 3.10 under GDB with the same machine arguments as an ordinary run.
 *
 * The debugger only acts when the test sends an explicit keyboard-feed trigger. The
 * emulator remains the sole owner of its process group, so cleanup cannot signal an
 * unrelated process.
 * @param prgPath Exact published program to autoload.
 * @param profileId Exact cooperative machine identity.
 * @param paths Injection, script and transcript files owned by the caller.
 * @param enableJoysticks Select both joystick simulators when true.
 * @param maximumCycles Bounded emulator run.
 * @returns The live debugger, monitor and runtime identity.
 */
export async function startGdbVice(
  prgPath: string,
  profileId: GdbProfileId,
  paths: GdbVicePaths,
  enableJoysticks: boolean,
  maximumCycles = 100_000_000,
): Promise<StartedGdbVice> {
  const identity = await viceRuntimeIdentity();
  if (identity === null) throw new Error("The pinned VICE 3.10 runtime is unavailable");
  await writeFile(paths.script, gdbCommandFile());
  const port = await viceLoopbackPort();
  const arguments_ = viceLaunchArguments(identity, prgPath, {
    profileId,
    maximumCycles,
    monitorPort: port,
    enableJoystick1: enableJoysticks,
    enableJoystick2: enableJoysticks,
  });
  const logDescriptor = openSync(paths.log, "w");
  let child: ChildProcess;
  try {
    child = spawn(
      "gdb",
      ["-q", "-nx", "-batch", "-x", paths.script, "--args", identity.executable, ...arguments_],
      {
        detached: true,
        stdio: ["ignore", logDescriptor, logDescriptor],
        env: { ...process.env, B65_INJECT: paths.injection },
        shell: false,
      },
    );
  } finally {
    closeSync(logDescriptor);
  }
  await new Promise<void>((resolveSpawn, reject) => {
    child.once("spawn", resolveSpawn);
    child.once("error", reject);
  });
  let monitor: ViceMonitor | undefined;
  let inferiorPid: number | undefined;
  try {
    const processId = child.pid;
    if (processId === undefined) throw new Error("Spawned debugger has no process identity");
    monitor = await openViceMonitor(port, processId);
    const version = await monitor.viceInfo();
    if (version[0] !== 3 || version[1] !== 10 || version.slice(2).some((part) => part !== 0))
      throw new Error(`VICE ${version.join(".")} is not VICE 3.10`);
    inferiorPid = await findInferior(processId, identity.executable);
    if (inferiorPid === undefined)
      throw new Error("The debugger did not expose its attested VICE inferior");
    return Object.freeze({ gdb: child, monitor, identity, inferiorPid, paths });
  } catch (error) {
    try {
      await stopGdbVice({
        gdb: child,
        monitor,
        inferiorPid,
        executable: identity.executable,
      });
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "Debugger-wrapped VICE setup and owned-process cleanup failed",
      );
    }
    throw error;
  }
}

/**
 * Publish the next matrix/RESTORE description before triggering the debugger.
 * @param session Active debugger-wrapped emulator.
 * @param injection Exact 16-entry matrix and optional RESTORE pulse.
 */
export async function prepareGdbInjection(
  session: StartedGdbVice,
  injection: GdbInjection,
): Promise<void> {
  if (injection.matrix.length !== 16)
    throw new RangeError("VICE keyboard matrix requires exactly 16 entries");
  if (injection.matrix.some((value) => !Number.isInteger(value) || value < 0 || value > 0xff))
    throw new RangeError("VICE keyboard matrix entries must be bytes");
  await writeFile(session.paths.injection, JSON.stringify(injection));
}

/**
 * Ask VICE to feed empty text, which stops the emulation thread so the debugger
 * can apply the prepared matrix without patching ROM, CPU frames or CIA pins.
 * @param session Active debugger-wrapped emulator.
 */
export async function applyGdbInjection(session: StartedGdbVice): Promise<void> {
  await session.monitor.feedKeyboard(new Uint8Array(0));
}

/**
 * Close the monitor and terminate the debugger's owned processes.
 *
 * The attested emulator is found through procfs even when monitor setup failed,
 * every signal is guarded by the recorded kernel start time so a reused pid is
 * never adopted, and termination is verified for the whole owned subtree rather
 * than only its root. Debugger cleanup is always attempted.
 * @param session Active or partially started debugger-wrapped emulator.
 */
export async function stopGdbVice(session: {
  readonly gdb: ChildProcess;
  readonly monitor?: ViceMonitor | undefined;
  readonly inferiorPid?: number | undefined;
  readonly executable?: string | undefined;
}): Promise<void> {
  session.monitor?.close();
  const errors: unknown[] = [];
  const gdbPid = session.gdb.pid;
  const gdbStart = gdbPid === undefined ? null : await processStartTime(gdbPid);
  const gdbIdentity: OwnedProcess | undefined =
    gdbPid !== undefined && gdbStart !== null ? { pid: gdbPid, startTime: gdbStart } : undefined;

  // The inferior identity is normally recorded at startup, but a failed monitor
  // connection must still find the emulator that the debugger already launched.
  let inferiorPid = session.inferiorPid;
  if (inferiorPid === undefined && session.executable !== undefined && gdbPid !== undefined) {
    inferiorPid = await findInferior(gdbPid, session.executable);
  }

  const owned = new Map<number, OwnedProcess>();
  try {
    if (inferiorPid !== undefined) {
      await collectOwned(inferiorPid, owned);
    } else if (gdbPid !== undefined) {
      // Without an attested inferior, still own every debugger descendant.
      for (const child of await childPids(gdbPid)) await collectOwned(child, owned);
    }
    if (owned.size > 0) {
      for (const process of [...owned.values()].reverse()) await signalOwned(process, "SIGTERM");
      if (!(await waitForOwnedExit(owned.values(), 2_000))) {
        // Re-collect surviving subtrees so children spawned before a parent exits
        // are included; every signal still requires the recorded identity.
        const survivors = new Map<number, OwnedProcess>();
        for (const process of owned.values()) {
          if (await processTerminated(process)) continue;
          survivors.set(process.pid, process);
          for (const child of await childPids(process.pid)) await collectOwned(child, survivors);
        }
        for (const process of [...survivors.values()].reverse())
          await signalOwned(process, "SIGKILL");
        if (!(await waitForOwnedExit([...owned.values(), ...survivors.values()], 2_000)))
          throw new Error("Debugger-wrapped VICE inferior subtree did not terminate");
      }
    }
  } catch (error) {
    errors.push(error);
  }

  try {
    if (gdbPid !== undefined && !(await waitForExit(session.gdb, 100))) {
      if (gdbIdentity !== undefined) await signalOwned(gdbIdentity, "SIGTERM");
      if (!(await waitForExit(session.gdb, 2_000))) {
        // A process-group signal is safe only while the debugger identity is current.
        const current = await processStartTime(gdbPid);
        if (gdbIdentity !== undefined && current === gdbIdentity.startTime) {
          try {
            process.kill(-gdbPid, "SIGTERM");
          } catch {
            // A concurrently exited process group needs no signal.
          }
        }
        if (!(await waitForExit(session.gdb, 2_000))) {
          if (gdbIdentity !== undefined) await signalOwned(gdbIdentity, "SIGKILL");
          if (!(await waitForExit(session.gdb, 2_000)))
            throw new Error("Debugger process did not terminate");
        }
      }
    }
  } catch (error) {
    errors.push(error);
  }

  if (errors.length === 1) throw errors[0];
  if (errors.length > 1)
    throw new AggregateError(errors, "Owned native qualification processes did not terminate");
}

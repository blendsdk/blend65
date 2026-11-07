import { spawn, type ChildProcess } from "node:child_process";
import { closeSync, openSync } from "node:fs";
import { writeFile } from "node:fs/promises";
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
  try {
    const processId = child.pid;
    if (processId === undefined) throw new Error("Spawned debugger has no process identity");
    monitor = await openViceMonitor(port, processId);
    const version = await monitor.viceInfo();
    if (version[0] !== 3 || version[1] !== 10 || version.slice(2).some((part) => part !== 0))
      throw new Error(`VICE ${version.join(".")} is not VICE 3.10`);
    return Object.freeze({ gdb: child, monitor, identity, paths });
  } catch (error) {
    try {
      await stopGdbVice({ gdb: child, monitor });
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
 * Close the monitor and terminate only the debugger's owned detached process group.
 * @param session Active debugger-wrapped emulator.
 */
export async function stopGdbVice(session: {
  readonly gdb: ChildProcess;
  readonly monitor?: ViceMonitor | undefined;
}): Promise<void> {
  session.monitor?.close();
  const processId = session.gdb.pid;
  if (processId === undefined) {
    await waitForExit(session.gdb, 100);
    return;
  }
  if (await waitForExit(session.gdb, 100)) return;
  try {
    process.kill(-processId, "SIGTERM");
  } catch {
    // A concurrently exited process group needs no signal.
  }
  if (await waitForExit(session.gdb, 2_000)) return;
  try {
    process.kill(-processId, "SIGKILL");
  } catch {
    // A concurrently exited process group needs no signal.
  }
  if (!(await waitForExit(session.gdb, 2_000)))
    throw new Error("Debugger process group did not terminate");
}

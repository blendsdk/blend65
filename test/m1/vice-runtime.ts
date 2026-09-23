import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { access, lstat, readFile, readlink, realpath } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { openViceMonitor, type ViceMonitor } from "./vice-monitor.js";

const VICE_SHA256 = "f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74";
const ROMS = Object.freeze([
  Object.freeze({
    option: "-kernal",
    name: "kernal-901227-03.bin",
    bytes: 8192,
    sha256: "83c60d47047d7beab8e5b7bf6f67f80daa088b7a6a27de0d7e016f6484042721",
  }),
  Object.freeze({
    option: "-basic",
    name: "basic-901226-01.bin",
    bytes: 8192,
    sha256: "89878cea0a268734696de11c4bae593eaaa506465d2029d619c0e0cbccdfa62d",
  }),
  Object.freeze({
    option: "-chargen",
    name: "chargen-901225-01.bin",
    bytes: 4096,
    sha256: "fd0d53b8480e86163ac98998976c72cc58d5dd8eb824ed7b829774e74213b420",
  }),
]);

/** Exact executable and ROM identity used by one M1 qualification run. */
export interface ViceRuntimeIdentity {
  /** Canonical VICE executable path. */
  readonly executable: string;
  /** SHA-256 of the canonical VICE executable. */
  readonly executableSha256: string;
  /** Validated ROM paths and identities in command-line order. */
  readonly roms: readonly {
    readonly name: string;
    readonly path: string;
    readonly bytes: number;
    readonly sha256: string;
  }[];
}

/** Live process and monitor owned by one qualification run. */
export interface StartedVice {
  /** Spawned detached VICE child. */
  readonly child: ChildProcess;
  /** Attested binary-monitor connection. */
  readonly monitor: ViceMonitor;
  /** Exact executable and ROM identity. */
  readonly identity: ViceRuntimeIdentity;
}

/** Installed M1 device tracepoints keyed by their VICE checkpoint identities. */
export interface M1DeviceTracepoints {
  /** Exact ordered event spelling for every installed checkpoint. */
  readonly eventsByCheckpoint: ReadonlyMap<number, string>;
  /** Checkpoints to delete before monitor shutdown. */
  readonly checkpoints: readonly number[];
}

const M1_DEVICE_ADDRESSES = Object.freeze([
  ...Array.from({ length: 8 }, (_, index) => 0x07f8 + index),
  ...Array.from({ length: 16 }, (_, index) => 0xd000 + index),
  0xd010,
  0xd015,
  0xd017,
  0xd018,
  0xd01b,
  0xd01c,
  0xd01d,
  0xd020,
  0xd021,
  ...Array.from({ length: 8 }, (_, index) => 0xd027 + index),
  0xdd00,
  0xdd02,
]);

/** Host-owned display state changed only to make rendered evidence independent of loader text. */
export interface NormalizedDisplayBaseline {
  /** Previous BASIC cursor-blink control byte. */
  readonly cursorBlink: number;
}

/** Normalize only the unowned text screen and cursor before the program starts. */
export async function normalizeDisplayBaseline(
  monitor: ViceMonitor,
): Promise<NormalizedDisplayBaseline> {
  const cursorBlink = (await monitor.readMemory(0x00cc, 0x00cc))[0]!;
  await monitor.writeMemory(0x0400, new Uint8Array(1000).fill(0x20));
  await monitor.writeIo(0xd800, new Uint8Array(1000).fill(0));
  await monitor.writeMemory(0x00cc, new Uint8Array([1]));
  return Object.freeze({ cursorBlink });
}

/** Restore the host-owned cursor setting before continuing into BASIC. */
export async function restoreDisplayBaseline(
  monitor: ViceMonitor,
  baseline: NormalizedDisplayBaseline,
): Promise<void> {
  await monitor.writeMemory(0x00cc, new Uint8Array([baseline.cursorBlink]));
}

/** Install exact non-stopping tracepoints for every M1-owned device access. */
export async function installM1DeviceTracepoints(
  monitor: ViceMonitor,
): Promise<M1DeviceTracepoints> {
  const eventsByCheckpoint = new Map<number, string>();
  for (const address of M1_DEVICE_ADDRESSES) {
    for (const operation of ["load", "store"] as const) {
      const checkpoint = await monitor.setAccessTracepoint(address, operation);
      eventsByCheckpoint.set(checkpoint, `${operation}:$${address.toString(16).padStart(4, "0")}`);
    }
  }
  monitor.takeCheckpointHits();
  return Object.freeze({
    eventsByCheckpoint,
    checkpoints: Object.freeze([...eventsByCheckpoint.keys()]),
  });
}

/** Convert and clear raw VICE hits into the exact ordered M1 device-access trace. */
export function takeM1DeviceTrace(
  monitor: ViceMonitor,
  tracepoints: M1DeviceTracepoints,
): readonly string[] {
  return Object.freeze(
    monitor.takeCheckpointHits().flatMap((checkpoint) => {
      const event = tracepoints.eventsByCheckpoint.get(checkpoint);
      return event === undefined ? [] : [event];
    }),
  );
}

/** Hash exact bytes from one file. */
async function fileSha256(path: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

/** Require a canonical executable or ROM to be an ordinary regular file. */
async function regularFile(path: string): Promise<boolean> {
  try {
    const metadata = await lstat(path);
    return metadata.isFile() && !metadata.isSymbolicLink();
  } catch {
    return false;
  }
}

/** Find the canonical pinned x64sc executable from the explicit PATH search order. */
async function viceExecutable(): Promise<string | null> {
  const path = process.env.PATH;
  if (path === undefined) return null;
  for (const directory of path.split(":")) {
    if (directory === "") continue;
    const candidate = resolve(directory, "x64sc");
    try {
      const canonical = await realpath(candidate);
      await access(canonical, constants.X_OK);
      if ((await regularFile(canonical)) && (await fileSha256(canonical)) === VICE_SHA256) {
        return canonical;
      }
    } catch {
      // Search continues until the exact admitted executable is found.
    }
  }
  return null;
}

/** Resolve and validate the exact ROM set shipped beside the admitted executable. */
async function runtimeIdentity(): Promise<ViceRuntimeIdentity | null> {
  const executable = await viceExecutable();
  if (executable === null) return null;
  const romDirectory = join(dirname(dirname(executable)), "share", "vice", "C64");
  const roms = [];
  for (const expected of ROMS) {
    const path = await realpath(join(romDirectory, expected.name)).catch(() => null);
    if (path === null || !(await regularFile(path))) return null;
    const bytes = (await lstat(path)).size;
    const sha256 = await fileSha256(path);
    if (bytes !== expected.bytes || sha256 !== expected.sha256) return null;
    roms.push(Object.freeze({ name: expected.name, path, bytes, sha256 }));
  }
  return Object.freeze({
    executable,
    executableSha256: VICE_SHA256,
    roms: Object.freeze(roms),
  });
}

/** Reserve and immediately release one loopback port for the owned monitor. */
async function freshLoopbackPort(): Promise<number> {
  const net = await import("node:net");
  const server = net.createServer();
  await new Promise<void>((resolveListen, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, resolveListen);
  });
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : null;
  await new Promise<void>((resolveClose, reject) =>
    server.close((error) => (error ? reject(error) : resolveClose())),
  );
  if (port === null) throw new Error("Could not reserve a loopback port for VICE");
  return port;
}

/** Wait for one child exit without leaking a timer or listener. */
async function childExited(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return true;
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

/** Start an exact VICE 3.10 process and attest its executable, ROMs, version and socket. */
export async function startVice(
  prgPath: string,
): Promise<StartedVice | { readonly kind: "unknown"; readonly reason: string }> {
  const identity = await runtimeIdentity();
  if (identity === null) {
    return Object.freeze({
      kind: "unknown",
      reason: "the pinned VICE 3.10 runtime is unavailable",
    });
  }
  const port = await freshLoopbackPort();
  const romArguments = ROMS.flatMap((rom, index) => [rom.option, identity.roms[index]!.path]);
  const arguments_ = [
    "-default",
    ...romArguments,
    "-model",
    "c64",
    "-pal",
    "-sidmodel",
    "0",
    "-console",
    "+sound",
    "+warp",
    "-binarymonitor",
    "-binarymonitoraddress",
    `127.0.0.1:${port}`,
    "-controlport2device",
    "37",
    "-limitcycles",
    "100000000",
    "-autostart",
    prgPath,
  ];
  const child = spawn(identity.executable, arguments_, {
    detached: true,
    stdio: "ignore",
    shell: false,
  });
  await new Promise<void>((resolveSpawn, reject) => {
    child.once("spawn", resolveSpawn);
    child.once("error", reject);
  });
  let monitor: ViceMonitor | undefined;
  try {
    const processId = child.pid;
    if (processId === undefined) throw new Error("Spawned VICE process has no process identity");
    const processExecutable = await realpath(await readlink(`/proc/${processId}/exe`));
    if (processExecutable !== identity.executable) {
      throw new Error("Spawned VICE executable differs from the attested executable");
    }
    monitor = await openViceMonitor(port, processId);
    const version = await monitor.viceInfo();
    if (version[0] !== 3 || version[1] !== 10 || version.slice(2).some((part) => part !== 0)) {
      await stopVice({ child, monitor });
      return Object.freeze({
        kind: "unknown",
        reason: `VICE ${version.join(".")} is not VICE 3.10`,
      });
    }
    return Object.freeze({ child, monitor, identity });
  } catch (error) {
    try {
      await stopVice({ child, monitor });
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        "VICE setup and owned-process cleanup failed",
      );
    }
    throw error;
  }
}

/** Close the monitor and terminate only its owned detached VICE process group. */
export async function stopVice(input: {
  readonly child: ChildProcess;
  readonly monitor: ViceMonitor | undefined;
}): Promise<void> {
  input.monitor?.close();
  if (await childExited(input.child, 100)) return;
  const processId = input.child.pid;
  if (processId === undefined) throw new Error("VICE process has no process identity");
  try {
    process.kill(-processId, "SIGTERM");
  } catch {
    // A concurrently exited process needs no signal.
  }
  if (await childExited(input.child, 2_000)) return;
  try {
    process.kill(-processId, "SIGKILL");
  } catch {
    // A concurrently exited process needs no signal.
  }
  if (!(await childExited(input.child, 2_000)))
    throw new Error("VICE process group did not terminate");
}

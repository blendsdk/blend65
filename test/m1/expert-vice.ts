import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { access, lstat, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import type { OracleFrame, OracleRun } from "../../examples/m1/qualification/oracle.js";
import type { M1ViceFrameObservation, M1ViceSpriteObservation } from "./vice-driver.js";
import type { ViceMonitor } from "./vice-monitor.js";
import {
  normalizeDisplayBaseline,
  restoreDisplayBaseline,
  installM1DeviceTracepoints,
  startVice,
  stopVice,
  takeM1DeviceTrace,
  type ViceRuntimeIdentity,
} from "./vice-runtime.js";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const BASIC_READY = 0xa474;
const SPRITE_ADDRESS = 0x2000;
const SPRITE_BYTES = 512;
const ACME_VERSION_TIMEOUT_MS = 5_000;
const ACME_RUN_TIMEOUT_MS = 30_000;
const ACME_OUTPUT_LIMIT = 1_048_576;

/** Runtime proof produced directly from the independently authored expert twin. */
export interface ExpertViceQualification {
  /** Exact frame observations in fixed-trace order. */
  readonly frames: readonly M1ViceFrameObservation[];
  /** Exact VICE executable and ROM identities. */
  readonly runtime: ViceRuntimeIdentity;
  /** Source identity of the expert assembly. */
  readonly sourceSha256: string;
  /** Assembled expert PRG identity. */
  readonly prgSha256: string;
  /** Caller CPU state was restored before the expert RTS returned. */
  readonly restoredCpu: true;
  /** Profile-owned machine state was restored before the expert RTS returned. */
  readonly restoredState: true;
  /** Execution continued to the pinned BASIC ready address. */
  readonly returnedToBasic: true;
  /** Exact ordered M1 device-access events from entry through restored RTS. */
  readonly deviceTrace: readonly string[];
}

interface ExpertAddresses {
  readonly stateStart: number;
  readonly stateEnd: number;
  readonly enemyXLo: number;
  readonly enemyXHi: number;
  readonly enemyY: number;
  readonly enemyAlive: number;
  readonly enemyDesign: number;
  readonly playerXLo: number;
  readonly playerXHi: number;
  readonly formationRight: number;
  readonly animationPhase: number;
  readonly slotState: number;
  readonly slotXLo: number;
  readonly slotXHi: number;
  readonly slotY: number;
  readonly slotFrame: number;
  readonly outcome: number;
  readonly exitRequested: number;
}

/** Hash exact bytes without text conversion. */
function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Run the admitted ACME child with fixed output, time and termination bounds. */
async function runBoundedAcme(
  executable: string,
  arguments_: readonly string[],
  timeoutMs: number,
): Promise<string> {
  return new Promise<string>((resolveRun, reject) => {
    const child = spawn(executable, arguments_, {
      cwd: repository,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let retainedBytes = 0;
    let settled = false;
    let limited = false;
    let timedOut = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (error?: Error): void => {
      if (settled) return;
      settled = true;
      if (timeout !== undefined) clearTimeout(timeout);
      if (killTimer !== undefined) clearTimeout(killTimer);
      if (error === undefined) resolveRun(output);
      else reject(error);
    };
    const stop = (): void => {
      child.kill("SIGTERM");
      killTimer = setTimeout(() => child.kill("SIGKILL"), 500);
      killTimer.unref();
    };
    const append = (chunk: Buffer): void => {
      const remaining = ACME_OUTPUT_LIMIT - retainedBytes;
      if (remaining > 0) {
        const retained = chunk.subarray(0, remaining);
        output += retained.toString("utf8");
        retainedBytes += retained.byteLength;
      }
      if (!limited && chunk.byteLength > remaining) {
        limited = true;
        stop();
      }
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.once("error", (error) => finish(error));
    child.once("close", (code, signal) => {
      if (limited) finish(new Error("Expert ACME output exceeded its fixed limit"));
      else if (timedOut) finish(new Error("Expert ACME execution exceeded its fixed deadline"));
      else if (code !== 0 || signal !== null) {
        finish(new Error(`Expert ACME failed: code=${String(code)} signal=${String(signal)}`));
      } else finish();
    });
    timeout = setTimeout(() => {
      timedOut = true;
      stop();
    }, timeoutMs);
    timeout.unref();
  });
}

/** Resolve and version-probe the canonical ACME 0.97 executable. */
async function admittedAcme(): Promise<{ readonly executable: string; readonly sha256: string }> {
  let executable: string | undefined;
  for (const directory of (process.env.PATH ?? "").split(delimiter)) {
    if (directory.length === 0) continue;
    try {
      const candidate = await realpath(resolve(directory, "acme"));
      const metadata = await lstat(candidate);
      await access(candidate, constants.X_OK);
      if (metadata.isFile() && !metadata.isSymbolicLink()) {
        executable = candidate;
        break;
      }
    } catch {
      // Continue through the explicit PATH order until one executable is found.
    }
  }
  if (executable === undefined) throw new Error("ACME is unavailable for expert qualification");
  const version = await runBoundedAcme(executable, ["--version"], ACME_VERSION_TIMEOUT_MS);
  if (!/\brelease\s+0\.97(?=$|[\s(])/iu.test(version)) {
    throw new Error("Expert qualification requires exact ACME release 0.97");
  }
  return Object.freeze({ executable, sha256: sha256(await readFile(executable)) });
}

/** Execute canonical ACME 0.97 once and require its identity to remain stable. */
async function assembleExpert(directory: string): Promise<{
  readonly prgPath: string;
  readonly labels: ReadonlyMap<string, number>;
  readonly sourceSha256: string;
  readonly prgSha256: string;
}> {
  const sourcePath = join(repository, "examples/m1/qualification/expert-m1.asm");
  const prgPath = join(directory, "m1.prg");
  const labelsPath = join(directory, "expert.labels");
  const tool = await admittedAcme();
  const arguments_ = [
    "--cpu",
    "6502",
    "--strict-segments",
    "--format",
    "cbm",
    "--outfile",
    prgPath,
    "--report",
    join(directory, "expert.report"),
    "--symbollist",
    labelsPath,
    sourcePath,
  ];
  await runBoundedAcme(tool.executable, arguments_, ACME_RUN_TIMEOUT_MS);
  if (sha256(await readFile(tool.executable)) !== tool.sha256) {
    throw new Error("The admitted ACME executable changed during expert assembly");
  }
  const labels = new Map<string, number>();
  for (const line of (await readFile(labelsPath, "utf8")).split("\n")) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*\$([0-9a-f]+)/iu.exec(line);
    if (match === null) continue;
    if (labels.has(match[1]!)) throw new Error(`Expert label is duplicated: ${match[1]}`);
    labels.set(match[1]!, Number.parseInt(match[2]!, 16));
  }
  return Object.freeze({
    prgPath,
    labels,
    sourceSha256: sha256(await readFile(sourcePath)),
    prgSha256: sha256(await readFile(prgPath)),
  });
}

/** Require one named expert label. */
function label(labels: ReadonlyMap<string, number>, name: string): number {
  const value = labels.get(name);
  if (value === undefined) throw new Error(`Expert assembly did not publish label '${name}'`);
  return value;
}

/** Resolve the exact expert state layout from its ACME symbol list. */
function expertAddresses(labels: ReadonlyMap<string, number>): ExpertAddresses {
  return Object.freeze({
    stateStart: label(labels, "expert_state_start"),
    stateEnd: label(labels, "expert_state_end") - 1,
    enemyXLo: label(labels, "enemy_x_lo"),
    enemyXHi: label(labels, "enemy_x_hi"),
    enemyY: label(labels, "enemy_y"),
    enemyAlive: label(labels, "enemy_alive"),
    enemyDesign: label(labels, "enemy_design"),
    playerXLo: label(labels, "player_x_lo"),
    playerXHi: label(labels, "player_x_hi"),
    formationRight: label(labels, "formation_right"),
    animationPhase: label(labels, "animation_phase"),
    slotState: label(labels, "slot_state"),
    slotXLo: label(labels, "slot_x_lo"),
    slotXHi: label(labels, "slot_x_hi"),
    slotY: label(labels, "slot_y"),
    slotFrame: label(labels, "slot_frame"),
    outcome: label(labels, "outcome"),
    exitRequested: label(labels, "exit_after_publish"),
  });
}

/** Read one byte from an expert state capture. */
function stateByte(bytes: Uint8Array, addresses: ExpertAddresses, address: number): number {
  const offset = address - addresses.stateStart;
  if (offset < 0 || offset >= bytes.length)
    throw new Error("Expert state address is outside its capture");
  return bytes[offset]!;
}

/** Read one expert boolean and require its canonical representation. */
function stateBoolean(bytes: Uint8Array, addresses: ExpertAddresses, address: number): boolean {
  const value = stateByte(bytes, addresses, address);
  if (value !== 0 && value !== 1) throw new Error("Expert state contains a non-canonical Boolean");
  return value === 1;
}

/** Reconstruct the oracle-shaped state from the expert twin's independent layout. */
function observedState(
  bytes: Uint8Array,
  addresses: ExpertAddresses,
  border: number,
): OracleFrame["state"] {
  const outcome = stateByte(bytes, addresses, addresses.outcome);
  const exited = stateBoolean(bytes, addresses, addresses.exitRequested);
  const phase: OracleFrame["state"]["phase"] = exited
    ? "exited"
    : outcome === 1
      ? "won"
      : outcome === 2
        ? "lost"
        : outcome === 0
          ? "playing"
          : (() => {
              throw new Error("Expert outcome byte is invalid");
            })();
  const frozen = outcome !== 0;
  const animationFrame = stateByte(bytes, addresses, addresses.animationPhase) + 1;
  if (animationFrame !== 1 && animationFrame !== 2)
    throw new Error("Expert animation phase is invalid");
  const invaders = Array.from({ length: 6 }, (_, index) => {
    const design = stateByte(bytes, addresses, addresses.enemyDesign + index);
    if (design !== 0 && design !== 1) throw new Error("Expert enemy design is invalid");
    return Object.freeze({
      index: index + 1,
      x:
        stateByte(bytes, addresses, addresses.enemyXLo + index) |
        (stateByte(bytes, addresses, addresses.enemyXHi + index) << 8),
      y: stateByte(bytes, addresses, addresses.enemyY + index),
      alive: stateBoolean(bytes, addresses, addresses.enemyAlive + index),
      color: 5 as const,
      art: `invader-${design === 0 ? "a" : "b"}-frame-${animationFrame}`,
    });
  });
  const slotState = stateByte(bytes, addresses, addresses.slotState);
  const slotX =
    stateByte(bytes, addresses, addresses.slotXLo) |
    (stateByte(bytes, addresses, addresses.slotXHi) << 8);
  const slotY = stateByte(bytes, addresses, addresses.slotY);
  const slotFrame = stateByte(bytes, addresses, addresses.slotFrame);
  const slot7: OracleFrame["state"]["slot7"] =
    slotState === 0
      ? Object.freeze({ kind: "idle" as const })
      : slotState === 1
        ? Object.freeze({ kind: "projectile" as const, x: slotX, y: slotY, color: 1 as const })
        : slotState === 2 && (slotFrame === 1 || slotFrame === 2)
          ? Object.freeze({
              kind: "explosion" as const,
              x: slotX,
              y: slotY,
              frame: slotFrame,
              color: 8 as const,
            })
          : (() => {
              throw new Error("Expert slot-seven state is invalid");
            })();
  return Object.freeze({
    phase,
    player: Object.freeze({
      x:
        stateByte(bytes, addresses, addresses.playerXLo) |
        (stateByte(bytes, addresses, addresses.playerXHi) << 8),
      y: 220 as const,
      color: 3 as const,
      frozen,
    }),
    formation: Object.freeze({
      direction: stateBoolean(bytes, addresses, addresses.formationRight) ? "right" : "left",
      frozen,
    }),
    invaders: Object.freeze(invaders),
    slot7,
    background: 0 as const,
    border:
      border === 0 || border === 2 || border === 5
        ? border
        : (() => {
            throw new Error(`Expert border color is invalid: ${border}`);
          })(),
  });
}

/** Read all eight expert hardware sprite publications. */
async function observedSprites(monitor: ViceMonitor): Promise<readonly M1ViceSpriteObservation[]> {
  const vic = await monitor.readIo(0xd000, 0xd02e);
  const pointers = await monitor.readMemory(0x07f8, 0x07ff);
  return Object.freeze(
    Array.from({ length: 8 }, (_, index) =>
      Object.freeze({
        index,
        enabled: (vic[0x15]! & (1 << index)) !== 0,
        x: vic[index * 2]! | (((vic[0x10]! >> index) & 1) << 8),
        y: vic[index * 2 + 1]!,
        pointer: pointers[index]!,
        color: vic[0x27 + index]! & 0x0f,
      }),
    ),
  );
}

/** Convert one independent oracle frame into its expected slot publication. */
function expectedSprites(frame: OracleFrame): readonly M1ViceSpriteObservation[] {
  const publications = frame.deviceIntents.filter((intent) => intent.kind === "publish-sprite");
  const pointers = frame.deviceIntents.filter((intent) => intent.kind === "set-sprite-pointer");
  if (publications.length !== 8 || pointers.length !== 8)
    throw new Error("Oracle sprite publication is incomplete");
  return Object.freeze(
    publications.map((sprite, index) =>
      Object.freeze({
        index: sprite.index,
        enabled: sprite.enabled,
        x: sprite.x,
        y: sprite.y,
        pointer: SPRITE_ADDRESS / 64 + pointers[index]!.block,
        color: sprite.color,
      }),
    ),
  );
}

/** Capture one expert frame and prove it against the independent behavior oracle. */
async function observeFrame(
  monitor: ViceMonitor,
  index: number,
  sample: number,
  expected: OracleFrame,
  addresses: ExpertAddresses,
): Promise<M1ViceFrameObservation> {
  const stateBytes = await monitor.readMemory(addresses.stateStart, addresses.stateEnd);
  const border = (await monitor.readIo(0xd020, 0xd020))[0]! & 0x0f;
  const state = observedState(stateBytes, addresses, border);
  const sprites = await observedSprites(monitor);
  if (
    !isDeepStrictEqual(state, expected.state) ||
    !isDeepStrictEqual(sprites, expectedSprites(expected))
  ) {
    throw new Error(`Expert VICE frame ${index} differs from the independent oracle`);
  }
  const vicDisplay = await monitor.readIo(0xd011, 0xd018);
  const cia2Port = (await monitor.readIo(0xdd00, 0xdd00))[0]!;
  const cia2Direction = (await monitor.readIo(0xdd02, 0xdd02))[0]!;
  const display = await monitor.readDisplay();
  return Object.freeze({
    index,
    sample,
    state,
    sprites,
    border,
    display: Object.freeze({
      vicControl1: vicDisplay[0]!,
      vicControl2: vicDisplay[5]!,
      vicMemory: vicDisplay[7]!,
      cia2Port,
      cia2Direction,
    }),
    displaySha256: sha256(display.evidence),
  });
}

/** Read every profile-owned device or memory field which the expert twin must restore. */
async function ownedMachineState(monitor: ViceMonitor): Promise<ReadonlyMap<number, number>> {
  const addresses = [
    0x0000,
    0x0001,
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
  ];
  const result = new Map<number, number>();
  for (const address of addresses) {
    const value =
      address >= 0xd000
        ? (await monitor.readIo(address, address))[0]!
        : (await monitor.readMemory(address, address))[0]!;
    result.set(address, value);
  }
  return result;
}

/** Resume and require the exact next execute checkpoint. */
async function resumeTo(monitor: ViceMonitor, expectedAddress: number): Promise<void> {
  const stopped = monitor.waitForStop();
  await monitor.resume();
  const actual = await stopped;
  if (actual !== expectedAddress) throw new Error(`Expert VICE stopped at $${actual.toString(16)}`);
}

/** Assemble and execute the expert twin through the same fixed M1 trace and machine oracle. */
export async function qualifyExpertM1WithVice(
  trace: readonly number[],
  oracle: OracleRun,
): Promise<ExpertViceQualification | { readonly kind: "unknown"; readonly reason: string }> {
  const directory = await mkdtemp(join(tmpdir(), "blend65-m1-expert-"));
  try {
    const assembly = await assembleExpert(directory);
    const addresses = expertAddresses(assembly.labels);
    const started = await startVice(assembly.prgPath);
    if ("kind" in started) return started;
    let monitor: ViceMonitor | undefined = started.monitor;
    const checkpoints: number[] = [];
    try {
      const entry = label(assembly.labels, "expert_entry");
      const frameCheckpoint = label(assembly.labels, "expert_frame_checkpoint");
      const restore = label(assembly.labels, "expert_restore_and_return");
      checkpoints.push(
        await monitor.setExecuteCheckpoint(entry),
        await monitor.setExecuteCheckpoint(frameCheckpoint),
        await monitor.setExecuteCheckpoint(restore),
      );
      await resumeTo(monitor, entry);
      const displayBaseline = await normalizeDisplayBaseline(monitor);
      const before = await ownedMachineState(monitor);
      const beforeCpu = await monitor.readCpuRegisters();
      const returnLow = (
        await monitor.readMemory(
          0x0100 + ((beforeCpu.sp + 1) & 0xff),
          0x0100 + ((beforeCpu.sp + 1) & 0xff),
        )
      )[0]!;
      const returnHigh = (
        await monitor.readMemory(
          0x0100 + ((beforeCpu.sp + 2) & 0xff),
          0x0100 + ((beforeCpu.sp + 2) & 0xff),
        )
      )[0]!;
      const callerReturn = ((returnLow | (returnHigh << 8)) + 1) & 0xffff;
      checkpoints.push(await monitor.setExecuteCheckpoint(callerReturn));
      const spriteSha256 = sha256(
        await monitor.readMemory(SPRITE_ADDRESS, SPRITE_ADDRESS + SPRITE_BYTES - 1),
      );
      if (spriteSha256 !== "c590c49d0e0aae8a20b39e2f6246c530bb7f52fe8b4c21131ec09a442509f68a") {
        throw new Error("Expert resident sprite bytes differ from the frozen raw asset");
      }
      await resumeTo(monitor, frameCheckpoint);
      const deviceTracepoints = await installM1DeviceTracepoints(monitor);
      checkpoints.push(...deviceTracepoints.checkpoints);
      const frames: M1ViceFrameObservation[] = [];
      const deviceTrace: string[] = [];
      for (let index = 0; index < trace.length; index += 1) {
        const expected = oracle.frames[index];
        if (expected === undefined || expected.sample !== trace[index])
          throw new Error("Expert oracle trace is inconsistent");
        await monitor.setJoystick2(trace[index]!);
        await resumeTo(monitor, index === trace.length - 1 ? restore : frameCheckpoint);
        frames.push(await observeFrame(monitor, index, trace[index]!, expected, addresses));
        deviceTrace.push(...takeM1DeviceTrace(monitor, deviceTracepoints));
      }
      await monitor.viceInfo();
      deviceTrace.push(...takeM1DeviceTrace(monitor, deviceTracepoints));
      await resumeTo(monitor, callerReturn);
      const after = await ownedMachineState(monitor);
      const afterCpu = await monitor.readCpuRegisters();
      if (
        !isDeepStrictEqual(after, before) ||
        afterCpu.a !== beforeCpu.a ||
        afterCpu.x !== beforeCpu.x ||
        afterCpu.y !== beforeCpu.y ||
        (afterCpu.p & 0xcf) !== (beforeCpu.p & 0xcf) ||
        afterCpu.sp !== ((beforeCpu.sp + 2) & 0xff)
      ) {
        throw new Error("Expert twin did not restore its exact caller and machine state");
      }
      await restoreDisplayBaseline(monitor, displayBaseline);
      checkpoints.push(await monitor.setExecuteCheckpoint(BASIC_READY));
      await resumeTo(monitor, BASIC_READY);
      for (const checkpoint of checkpoints) await monitor.deleteCheckpoint(checkpoint);
      await monitor.quit();
      monitor = undefined;
      return Object.freeze({
        frames: Object.freeze(frames),
        runtime: started.identity,
        sourceSha256: assembly.sourceSha256,
        prgSha256: assembly.prgSha256,
        restoredCpu: true,
        restoredState: true,
        returnedToBasic: true,
        deviceTrace: Object.freeze(deviceTrace),
      });
    } finally {
      await stopVice({ child: started.child, monitor });
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile } from "node:fs/promises";
import net from "node:net";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { fileURLToPath } from "node:url";
import type { PublishedGeneration } from "@blend65/compiler";
import type { OracleFrame, OracleRun } from "../../examples/m1/qualification/oracle.js";
import { openViceMonitor, type ViceMonitor } from "./vice-monitor.js";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const BASIC_READY = 0xa474;
const SPRITE_BYTES = 512;

/** One hardware sprite publication observed after an emulated frame. */
export interface M1ViceSpriteObservation {
  /** Hardware sprite slot. */
  readonly index: number;
  /** Whether the slot is enabled. */
  readonly enabled: boolean;
  /** Nine-bit horizontal position. */
  readonly x: number;
  /** Eight-bit vertical position. */
  readonly y: number;
  /** VIC-bank-relative sprite block. */
  readonly pointer: number;
  /** Sprite color register value. */
  readonly color: number;
}

/** Exact state and visible hardware publication observed for one M1 frame. */
export interface M1ViceFrameObservation {
  /** Zero-based fixed-trace frame index. */
  readonly index: number;
  /** Active-low joystick sample supplied at the frame checkpoint. */
  readonly sample: number;
  /** Game state reconstructed only from emulated program memory. */
  readonly state: OracleFrame["state"];
  /** All eight slot-ordered VIC publications. */
  readonly sprites: readonly M1ViceSpriteObservation[];
  /** Observed border color. */
  readonly border: number;
  /** SHA-256 over dimensions, offsets, and indexed VIC-II pixels. */
  readonly displaySha256: string;
}

/** Result of the one M1-specific VICE qualification journey. */
export type M1ViceQualificationResult =
  | {
      readonly kind: "verified";
      readonly status: "VICE-verified / hardware-unverified";
      readonly frames: readonly M1ViceFrameObservation[];
      readonly residentSpriteSha256: string;
      readonly restoredState: true;
      readonly returnedToBasic: true;
    }
  | { readonly kind: "unknown"; readonly reason: string };

/** Inputs to the one M1-specific VICE qualification journey. */
export interface M1ViceQualificationInput {
  /** Exact immutable generation returned by the public build. */
  readonly generation: PublishedGeneration;
  /** Frozen active-low joystick samples. */
  readonly trace: readonly number[];
  /** Independent expected state and device intent for every sample. */
  readonly oracle: OracleRun;
}

interface DebugSymbol {
  readonly kind: string;
  readonly byteWidth: number;
  readonly origin: { readonly kind: string; readonly span?: { readonly startByte: number } };
}

interface DebugLocation {
  readonly symbolIndex: number;
  readonly availability: {
    readonly kind: string;
    readonly pieces?: readonly {
      readonly kind: string;
      readonly byteLength: number;
      readonly machine?: { readonly start: number; readonly end: number };
    }[];
  };
}

interface M1Addresses {
  readonly enemies: number;
  readonly playerX: number;
  readonly formationRight: number;
  readonly animationPhase: number;
  readonly slotState: number;
  readonly slotX: number;
  readonly slotY: number;
  readonly slotFrame: number;
  readonly outcome: number;
  readonly exitRequested: number;
  readonly stateStart: number;
  readonly stateEnd: number;
}

/** Hash exact bytes without text conversion. */
function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Narrow an untrusted JSON value to one ordinary record. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Narrow an untrusted JSON value to one ordinary record. */
function record(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object`);
  return value;
}

/** Read one JSON file as untrusted evidence. */
async function jsonFile(path: string, label: string): Promise<Record<string, unknown>> {
  const value: unknown = JSON.parse(await readFile(path, "utf8"));
  return record(value, label);
}

/** Require one published path to remain an ordinary regular file. */
async function requireRegularFile(path: string): Promise<void> {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink()) {
    throw new Error(`Published qualification input is not an ordinary file: ${path}`);
  }
}

/** Find a fresh loopback port, releasing it immediately for VICE. */
async function freshLoopbackPort(): Promise<number> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen({ host: "127.0.0.1", port: 0, exclusive: true }, resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : null;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  if (port === null) throw new Error("Could not reserve a loopback port for VICE");
  return port;
}

/** Wait for one child exit without leaving a timer or listener behind. */
async function childExited(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return new Promise<boolean>((resolve) => {
    const onExit = (): void => {
      clearTimeout(timer);
      resolve(true);
    };
    const timer = setTimeout(() => {
      child.off("exit", onExit);
      resolve(false);
    }, timeoutMs);
    child.once("exit", onExit);
  });
}

/** Stop only the detached VICE process group owned by this qualification run. */
async function terminateVice(child: ChildProcess): Promise<void> {
  if (await childExited(child, 100)) return;
  const processId = child.pid;
  if (processId === undefined) throw new Error("VICE process has no process identity");
  try {
    process.kill(-processId, "SIGTERM");
  } catch {
    // A concurrently exited process needs no signal.
  }
  if (await childExited(child, 2_000)) return;
  try {
    process.kill(-processId, "SIGKILL");
  } catch {
    // A concurrently exited process needs no signal.
  }
  if (!(await childExited(child, 2_000))) throw new Error("VICE process group did not terminate");
}

/** Spawn VICE or return the sole allowed unavailable-tool result. */
async function spawnVice(
  arguments_: readonly string[],
): Promise<
  { readonly child: ChildProcess; readonly unavailable: false } | { readonly unavailable: true }
> {
  const child = spawn("x64sc", arguments_, {
    detached: true,
    stdio: "ignore",
    shell: false,
  });
  return new Promise((resolve, reject) => {
    child.once("spawn", () => resolve({ child, unavailable: false }));
    child.once("error", (error) => {
      if ("code" in error && error.code === "ENOENT") resolve({ unavailable: true });
      else reject(error);
    });
  });
}

/** Parse compiler labels while retaining their decoded stable identities. */
function decodedLabels(text: string): ReadonlyMap<string, number> {
  const labels = new Map<string, number>();
  for (const line of text.split("\n")) {
    const match = /^\s*b65_([0-9a-f]+)\s*=\s*\$([0-9a-f]+)/iu.exec(line);
    if (match === null) continue;
    const decoded = Buffer.from(match[1]!, "hex").toString("utf8");
    const address = Number.parseInt(match[2]!, 16);
    if (labels.has(decoded)) throw new Error(`Generated label identity is duplicated: ${decoded}`);
    labels.set(decoded, address);
  }
  return labels;
}

/** Find one and only one decoded label matching a qualification boundary. */
function matchingLabel(
  labels: ReadonlyMap<string, number>,
  predicate: (label: string) => boolean,
): number {
  const matches = [...labels].filter(([label]) => predicate(label));
  if (matches.length !== 1) throw new Error("Generated output has no unique qualification label");
  return matches[0]![1];
}

/** Parse the direct debug fields needed to locate M1 globals. */
function debugRecords(debug: Record<string, unknown>): {
  readonly symbols: readonly DebugSymbol[];
  readonly locations: readonly DebugLocation[];
} {
  const symbols = debug.symbols;
  const locations = debug.locations;
  const isSymbol = (value: unknown): value is DebugSymbol => {
    if (!isRecord(value) || typeof value.kind !== "string" || typeof value.byteWidth !== "number")
      return false;
    const origin = value.origin;
    if (!isRecord(origin) || typeof origin.kind !== "string") return false;
    return (
      origin.span === undefined ||
      (isRecord(origin.span) && typeof origin.span.startByte === "number")
    );
  };
  const isLocation = (value: unknown): value is DebugLocation => {
    if (!isRecord(value) || typeof value.symbolIndex !== "number") return false;
    const availability = value.availability;
    if (!isRecord(availability) || typeof availability.kind !== "string") return false;
    if (availability.pieces === undefined) return true;
    return (
      Array.isArray(availability.pieces) &&
      availability.pieces.every(
        (piece) =>
          isRecord(piece) &&
          typeof piece.kind === "string" &&
          typeof piece.byteLength === "number" &&
          (piece.machine === undefined ||
            (isRecord(piece.machine) &&
              typeof piece.machine.start === "number" &&
              typeof piece.machine.end === "number")),
      )
    );
  };
  if (
    !Array.isArray(symbols) ||
    !symbols.every(isSymbol) ||
    !Array.isArray(locations) ||
    !locations.every(isLocation)
  ) {
    throw new TypeError("Debug evidence must contain symbols and locations");
  }
  return { symbols, locations };
}

/** Resolve one source global through its declaration span and debug memory location. */
function globalAddress(
  name: string,
  expectedBytes: number,
  source: string,
  debug: ReturnType<typeof debugRecords>,
): number {
  const characterOffset = source.indexOf(`let ${name}`);
  if (characterOffset < 0) throw new Error(`M1 source does not declare '${name}'`);
  const startByte = Buffer.byteLength(source.slice(0, characterOffset), "utf8");
  const symbolIndex = debug.symbols.findIndex(
    (symbol) =>
      symbol.kind === "global" &&
      symbol.byteWidth === expectedBytes &&
      symbol.origin.kind === "source" &&
      symbol.origin.span?.startByte === startByte,
  );
  if (symbolIndex < 0) throw new Error(`Debug evidence does not locate M1 global '${name}'`);
  const location = debug.locations.find((candidate) => candidate.symbolIndex === symbolIndex);
  const pieces =
    location?.availability.kind === "available" ? location.availability.pieces : undefined;
  const piece = pieces?.length === 1 ? pieces[0] : undefined;
  if (
    piece?.kind !== "memory" ||
    piece.machine === undefined ||
    piece.byteLength !== expectedBytes ||
    piece.machine.end - piece.machine.start !== expectedBytes
  ) {
    throw new Error(`M1 global '${name}' has no exact debug memory location`);
  }
  return piece.machine.start;
}

/** Resolve every M1 state address from checked-in source and generated debug evidence. */
function m1Addresses(source: string, debug: ReturnType<typeof debugRecords>): M1Addresses {
  const addresses = {
    enemies: globalAddress("enemies", 30, source, debug),
    playerX: globalAddress("playerX", 2, source, debug),
    formationRight: globalAddress("formationRight", 1, source, debug),
    animationPhase: globalAddress("animationPhase", 1, source, debug),
    slotState: globalAddress("slotState", 1, source, debug),
    slotX: globalAddress("slotX", 2, source, debug),
    slotY: globalAddress("slotY", 1, source, debug),
    slotFrame: globalAddress("slotFrame", 1, source, debug),
    outcome: globalAddress("outcome", 1, source, debug),
    exitRequested: globalAddress("exitRequested", 1, source, debug),
  };
  return Object.freeze({
    ...addresses,
    stateStart: Math.min(...Object.values(addresses)),
    stateEnd: Math.max(
      ...Object.entries(addresses).map(
        ([name, address]) =>
          address + (name === "enemies" ? 30 : name === "playerX" || name === "slotX" ? 2 : 1) - 1,
      ),
    ),
  });
}

/** Read one byte at an absolute address from a previously captured state window. */
function stateByte(bytes: Uint8Array, addresses: M1Addresses, address: number): number {
  const offset = address - addresses.stateStart;
  if (offset < 0 || offset >= bytes.length)
    throw new Error("M1 state address is outside its capture");
  return bytes[offset]!;
}

/** Read one little-endian word from a previously captured state window. */
function stateWord(bytes: Uint8Array, addresses: M1Addresses, address: number): number {
  return stateByte(bytes, addresses, address) | (stateByte(bytes, addresses, address + 1) << 8);
}

/** Require a stored Blend65 boolean to retain its canonical representation. */
function stateBoolean(bytes: Uint8Array, addresses: M1Addresses, address: number): boolean {
  const value = stateByte(bytes, addresses, address);
  if (value !== 0 && value !== 1) throw new Error("M1 state contains a non-canonical boolean");
  return value === 1;
}

/** Reconstruct one complete oracle-shaped state from emulated M1 memory. */
function observedState(
  bytes: Uint8Array,
  addresses: M1Addresses,
  border: number,
): OracleFrame["state"] {
  const outcome = stateByte(bytes, addresses, addresses.outcome);
  const exited = stateBoolean(bytes, addresses, addresses.exitRequested);
  if (outcome > 2) throw new Error("M1 outcome byte is invalid");
  const phase: OracleFrame["state"]["phase"] = exited
    ? "exited"
    : outcome === 1
      ? "won"
      : outcome === 2
        ? "lost"
        : "playing";
  const frozen = outcome !== 0;
  const animationFrame = stateByte(bytes, addresses, addresses.animationPhase) + 1;
  if (animationFrame !== 1 && animationFrame !== 2)
    throw new Error("M1 animation phase is invalid");
  const invaders = Array.from({ length: 6 }, (_, arrayIndex) => {
    const start = addresses.enemies + arrayIndex * 5;
    const design = stateByte(bytes, addresses, start + 4);
    if (design !== 0 && design !== 1) throw new Error("M1 enemy design is invalid");
    return Object.freeze({
      index: arrayIndex + 1,
      x: stateWord(bytes, addresses, start),
      y: stateByte(bytes, addresses, start + 2),
      alive: stateBoolean(bytes, addresses, start + 3),
      color: 5 as const,
      art: `invader-${design === 0 ? "a" : "b"}-frame-${animationFrame}`,
    });
  });
  const slotState = stateByte(bytes, addresses, addresses.slotState);
  const slotX = stateWord(bytes, addresses, addresses.slotX);
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
              throw new Error("M1 slot-seven state is invalid");
            })();
  return Object.freeze({
    phase,
    player: Object.freeze({
      x: stateWord(bytes, addresses, addresses.playerX),
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
            throw new Error(`M1 border color is invalid: ${border}`);
          })(),
  });
}

/** Read the exact eight slot publications from VIC and screen-pointer registers. */
async function observedSprites(monitor: ViceMonitor): Promise<readonly M1ViceSpriteObservation[]> {
  const vic = await monitor.readIo(0xd000, 0xd02e);
  const pointers = await monitor.readMemory(0x07f8, 0x07ff);
  const enabled = vic[0x15]!;
  const highBits = vic[0x10]!;
  return Object.freeze(
    Array.from({ length: 8 }, (_, index) =>
      Object.freeze({
        index,
        enabled: (enabled & (1 << index)) !== 0,
        x: vic[index * 2]! | (((highBits >> index) & 1) << 8),
        y: vic[index * 2 + 1]!,
        pointer: pointers[index]!,
        color: vic[0x27 + index]! & 0x0f,
      }),
    ),
  );
}

/** Convert one independent oracle frame into its exact expected hardware publication. */
function expectedSprites(
  frame: OracleFrame,
  baseBlock: number,
): readonly M1ViceSpriteObservation[] {
  const publications = frame.deviceIntents.filter((intent) => intent.kind === "publish-sprite");
  const pointers = frame.deviceIntents.filter((intent) => intent.kind === "set-sprite-pointer");
  if (publications.length !== 8 || pointers.length !== 8) {
    throw new Error(`Oracle frame ${frame.index} has an incomplete sprite publication`);
  }
  return Object.freeze(
    publications.map((sprite, index) =>
      Object.freeze({
        index: sprite.index,
        enabled: sprite.enabled,
        x: sprite.x,
        y: sprite.y,
        pointer: baseBlock + pointers[index]!.block,
        color: sprite.color,
      }),
    ),
  );
}

/** Capture and independently compare one completed emulated frame. */
async function observeFrame(
  monitor: ViceMonitor,
  index: number,
  sample: number,
  expected: OracleFrame,
  addresses: M1Addresses,
  baseBlock: number,
): Promise<M1ViceFrameObservation> {
  const observedSample = (await monitor.readIo(0xdc00, 0xdc00))[0]! & 0x1f;
  if (observedSample !== sample) {
    throw new Error(
      `VICE frame ${index} joyport sample differs: observed=${observedSample} expected=${sample}`,
    );
  }
  const stateBytes = await monitor.readMemory(addresses.stateStart, addresses.stateEnd);
  const border = (await monitor.readIo(0xd020, 0xd020))[0]! & 0x0f;
  const state = observedState(stateBytes, addresses, border);
  const sprites = await observedSprites(monitor);
  const display = await monitor.readDisplay();
  if (!isDeepStrictEqual(state, expected.state)) {
    throw new Error(
      `VICE frame ${index} game state differs from the independent oracle: observed=${JSON.stringify(state)} expected=${JSON.stringify(expected.state)}`,
    );
  }
  if (!isDeepStrictEqual(sprites, expectedSprites(expected, baseBlock))) {
    throw new Error(`VICE frame ${index} sprite publication differs from the independent oracle`);
  }
  return Object.freeze({
    index,
    sample,
    state,
    sprites,
    border,
    displaySha256: sha256(display.evidence),
  });
}

/** Read only the profile-owned machine fields which M1 may change and must restore. */
async function ownedMachineState(monitor: ViceMonitor): Promise<ReadonlyMap<number, number>> {
  const ranges = [
    [0x0000, 0x0001],
    [0x07f8, 0x07ff],
    [0xd000, 0xd01d],
    [0xd020, 0xd021],
    [0xd027, 0xd02e],
    [0xdd00, 0xdd00],
    [0xdd02, 0xdd02],
  ] as const;
  const selected = new Set([
    0x0000,
    0x0001,
    ...Array.from({ length: 8 }, (_, index) => 0x07f8 + index),
    ...Array.from({ length: 17 }, (_, index) => 0xd000 + index),
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
  const state = new Map<number, number>();
  for (const [start, end] of ranges) {
    const bytes =
      start >= 0xd000 ? await monitor.readIo(start, end) : await monitor.readMemory(start, end);
    bytes.forEach((value, offset) => {
      const address = start + offset;
      if (selected.has(address)) state.set(address, value);
    });
  }
  return state;
}

/** Resume once and require the exact next checkpoint address. */
async function resumeTo(monitor: ViceMonitor, expectedAddress: number): Promise<void> {
  const stopped = monitor.waitForStop();
  await monitor.resume();
  const actual = await stopped;
  if (actual !== expectedAddress) {
    throw new Error(
      `VICE stopped at $${actual.toString(16)} instead of $${expectedAddress.toString(16)}`,
    );
  }
}

/**
 * Build-independent real VICE qualification for the checked-in M1 program.
 * Missing VICE is `Unknown`; all ownership, protocol, timeout, behavior, restoration, or return
 * failures reject and therefore fail the specification test.
 */
export async function qualifyM1WithVice(
  input: M1ViceQualificationInput,
): Promise<M1ViceQualificationResult> {
  if (input.trace.length === 0 || input.oracle.frames.length !== input.trace.length) {
    throw new Error("M1 trace and independent oracle must contain the same nonzero frame count");
  }
  const generation = input.generation;
  const prgPath = join(generation.directory, generation.primaryArtifact);
  const labelsPath = join(generation.directory, ".labels");
  const debugPath = join(generation.directory, ".debug.json");
  const assetsPath = join(generation.directory, ".assets.json");
  for (const path of [prgPath, labelsPath, debugPath, assetsPath]) await requireRegularFile(path);

  const labels = decodedLabels(await readFile(labelsPath, "utf8"));
  const entry = matchingLabel(labels, (label) => label === "startup.entry");
  const restore = matchingLabel(labels, (label) => label === "startup.restore");
  const frameCheckpoint = matchingLabel(labels, (label) => label.endsWith(".wait.0.continue"));
  const source = await readFile(join(repository, "examples/m1/src/game.blend"), "utf8");
  const debug = debugRecords(await jsonFile(debugPath, "debug evidence"));
  const addresses = m1Addresses(source, debug);
  const assets = await jsonFile(assetsPath, "asset evidence");
  if (!Array.isArray(assets.assets) || assets.assets.length !== 1) {
    throw new Error("M1 qualification requires exactly one resident asset");
  }
  const asset = record(assets.assets[0], "M1 asset");
  const placement = record(asset.placement, "M1 asset placement");
  const range = record(placement.range, "M1 asset range");
  if (typeof range.start !== "number" || range.start % 64 !== 0) {
    throw new Error("M1 sprite asset has no aligned final address");
  }
  const spriteAddress = range.start;
  const baseBlock = (spriteAddress & 0x3fff) / 64;

  const port = await freshLoopbackPort();
  const arguments_ = [
    "-default",
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
  ] as const;
  const spawned = await spawnVice(arguments_);
  if (spawned.unavailable)
    return Object.freeze({ kind: "unknown", reason: "x64sc is unavailable" });
  const child = spawned.child;
  const processId = child.pid;
  if (processId === undefined) {
    await terminateVice(child);
    throw new Error("Spawned VICE process has no process identity");
  }

  let monitor: ViceMonitor | undefined;
  const checkpoints: number[] = [];
  try {
    monitor = await openViceMonitor(port, processId);
    const version = await monitor.viceInfo();
    if (version[0] !== 3 || version[1] !== 10 || version.slice(2).some((part) => part !== 0)) {
      return Object.freeze({
        kind: "unknown",
        reason: `VICE ${version.join(".")} is not VICE 3.10`,
      });
    }
    checkpoints.push(
      await monitor.setExecuteCheckpoint(entry),
      await monitor.setExecuteCheckpoint(frameCheckpoint),
      await monitor.setExecuteCheckpoint(restore),
    );

    await resumeTo(monitor, entry);
    const before = await ownedMachineState(monitor);
    const residentSprite = await monitor.readMemory(
      spriteAddress,
      spriteAddress + SPRITE_BYTES - 1,
    );
    const residentSpriteSha256 = sha256(residentSprite);
    if (
      residentSpriteSha256 !== "c590c49d0e0aae8a20b39e2f6246c530bb7f52fe8b4c21131ec09a442509f68a"
    ) {
      throw new Error("VICE resident sprite bytes differ from the frozen raw asset");
    }

    await resumeTo(monitor, frameCheckpoint);
    const frames: M1ViceFrameObservation[] = [];
    for (let index = 0; index < input.trace.length; index += 1) {
      const sample = input.trace[index]!;
      const expected = input.oracle.frames[index];
      if (expected === undefined || expected.sample !== sample) {
        throw new Error(`M1 oracle frame ${index} does not match the fixed input trace`);
      }
      await monitor.setJoystick2(sample);
      await resumeTo(monitor, index === input.trace.length - 1 ? restore : frameCheckpoint);
      frames.push(await observeFrame(monitor, index, sample, expected, addresses, baseBlock));
    }

    checkpoints.push(await monitor.setExecuteCheckpoint(BASIC_READY));
    await resumeTo(monitor, BASIC_READY);
    const after = await ownedMachineState(monitor);
    if (!isDeepStrictEqual(after, before)) {
      throw new Error("M1 did not restore every profile-owned machine field before BASIC return");
    }
    for (const checkpoint of checkpoints) await monitor.deleteCheckpoint(checkpoint);
    await monitor.quit();
    monitor = undefined;
    return Object.freeze({
      kind: "verified",
      status: "VICE-verified / hardware-unverified",
      frames: Object.freeze(frames),
      residentSpriteSha256,
      restoredState: true,
      returnedToBasic: true,
    });
  } finally {
    monitor?.close();
    await terminateVice(child);
  }
}

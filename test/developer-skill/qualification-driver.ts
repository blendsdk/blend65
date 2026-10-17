import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { buildProject, checkProject } from "@blend65/compiler";
import { startVice, stopVice } from "../m1/vice-runtime.js";
import type { ViceMonitor } from "../m1/vice-monitor.js";
import type { ViceRuntimeIdentity } from "../m1/vice-runtime.js";

/** These fixtures deliberately exercise one exact cooperative machine and mode. */
const PROFILE = "c64-pal-prg-kernal-6581";
const HASH = /^[0-9a-f]{64}$/;
const GENERATION = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const MARKER = "c64.vic.setBorderColor(13);";
const SIDECAR_LIMIT = 16 * 1024 * 1024;
/** Termination guards include loading; they are not measured execution costs. */
const MAXIMUM_CYCLES = 100_000_000;
const CHECKPOINT_TIMEOUT_MS = 60_000;
/** This pilot pins the one installed source as data, not an unchecked host path. */
const LIBRARY_INPUT = {
  path: "@blend65/stdlib/c64/input.blend",
  bytes: 16118,
  sha256: "d5c3129c80fea3cdc13e08edc22b53241b10f4a86cde9ef4524306baa23e29c7",
};

/** Only the two approved source-writing exercises use this observation helper. */
type Exercise = "score" | "patrol";

/** Exact generation and runtime identities accompany values, never stand in for them. */
interface ObservationIdentity {
  /** Publication identity returned by this invocation's public build. */
  readonly generationId: string;
  /** Digest of the exact loaded PRG bytes, including their load-address header. */
  readonly prgSha256: string;
  /** Digest of the exact build sidecar returned by the public build. */
  readonly buildJsonSha256: string;
  /** Existing attestation of the actual VICE executable and ROMs. */
  readonly runtime: ViceRuntimeIdentity;
}

/** Missing or invalid observations cannot be mistaken for successful zero values. */
type ExerciseObservation =
  | (ObservationIdentity & {
      /** Actual machine values were read after the completion checkpoint. */
      readonly kind: "observed";
      /** Identifies the fixed score wrapper. */
      readonly exercise: "score";
      /** Six unsigned words read from the wrapper's result array. */
      readonly scores: readonly number[];
    })
  | (ObservationIdentity & {
      /** Actual machine values were read after the completion checkpoint. */
      readonly kind: "observed";
      /** Identifies the fixed patrol wrapper. */
      readonly exercise: "patrol";
      /** Ten unsigned positions read from the wrapper's result array. */
      readonly positions: readonly number[];
      /** Ten canonical Boolean direction bytes read from the wrapper. */
      readonly directions: readonly boolean[];
    })
  | {
      /** No behavior conclusion is available for the requested identity. */
      readonly kind: "unknown";
      /** Safe explanation of the failed observation boundary. */
      readonly reason: string;
    };

/** One CPU-RAM piece places a consecutive part of a source value. */
interface MemoryPiece {
  /** Inclusive CPU start address of this piece. */
  readonly start: number;
  /** Half-open CPU end address of this piece. */
  readonly end: number;
  /** Byte offset within the complete source value. */
  readonly offset: number;
}

/** Preparation finishes identity and location checks before any emulator launch. */
interface PreparedExercise {
  /** Exact PRG path in the returned, fixture-owned generation. */
  readonly prg: string;
  /** Exact immutable generation identity. */
  readonly generationId: string;
  /** Hash of the exact primary artifact. */
  readonly prgSha256: string;
  /** Hash of the verified build sidecar. */
  readonly buildJsonSha256: string;
  /** CPU address immediately before the wrapper's completion operation. */
  readonly checkpoint: number;
  /** Pieces for the score or patrol-position array. */
  readonly words: readonly MemoryPiece[];
  /** Pieces for patrol directions; absent for the score exercise. */
  readonly directions: readonly MemoryPiece[];
}

/** Only this observer's fixed messages are safe to include in Unknown evidence. */
class ObservationError extends Error {}

/** Fail closed at a named boundary without printing source text or native errors. */
function demand(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new ObservationError(reason);
}

/** Narrow object fields without inventing an index signature through a cast. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Narrow only the direct public sidecar fields this fixed observer consumes. */
function record(value: unknown): Record<string, unknown> {
  demand(isRecord(value), "Expected an evidence object");
  return value;
}

/** Every selected array entry must be a record before its fields are consulted. */
function records(value: unknown): Record<string, unknown>[] {
  demand(Array.isArray(value), "Expected an evidence record array");
  return value.map(record);
}

/** Machine addresses, array extents and offsets are nonnegative safe integers. */
function integer(value: unknown): number {
  demand(
    typeof value === "number" && Number.isSafeInteger(value) && value >= 0,
    "Invalid evidence integer",
  );
  return value;
}

/** Hashes are validated before they are used as artifact or input identities. */
function hash(value: unknown): string {
  demand(typeof value === "string" && HASH.test(value), "Invalid SHA-256 identity");
  return value;
}

/** Hash the actual bounded bytes, rather than trusting a recorded digest alone. */
function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Reject foreign, hidden or parent-relative names before a filesystem probe. */
function contained(parent: string, child: string): void {
  const tail = relative(parent, child);
  demand(
    tail !== "" && tail !== ".." && !tail.startsWith(`..${sep}`) && !isAbsolute(tail),
    "Path is outside the owned fixture",
  );
}

/** Walk only an admitted path, rejecting symlinked components before file access. */
async function ordinaryPath(path: string, directory = false): Promise<void> {
  let current: string = sep;
  const parts = path.slice(sep.length).split(sep);
  for (const [index, part] of parts.entries()) {
    current = join(current, part);
    const info = await lstat(current);
    demand(!info.isSymbolicLink(), "Symlinked fixture paths are not admitted");
    demand(
      index < parts.length - 1 || directory ? info.isDirectory() : info.isFile(),
      "Unexpected fixture entry type",
    );
  }
}

/** Bounded no-follow reads inspect one regular file through the same open handle. */
async function bytes(path: string, maximum: number): Promise<Buffer> {
  await ordinaryPath(path);
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await handle.stat();
    demand(before.isFile() && before.size <= maximum, "Fixture file exceeds its admitted bound");
    const value = await handle.readFile();
    const after = await handle.stat();
    demand(
      value.length === before.size &&
        value.length <= maximum &&
        after.size === before.size &&
        after.mtimeMs === before.mtimeMs &&
        after.ctimeMs === before.ctimeMs,
      "Fixture file changed during observation",
    );
    return value;
  } finally {
    await handle.close();
  }
}

/** Read an owned JSON sidecar without accepting scalar or array roots. */
function json(value: Buffer): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value.toString("utf8"));
  return record(parsed);
}

/** Inputs and outputs must remain in a caller-created, non-hidden scratch project. */
async function fixtureRoot(project: string): Promise<string> {
  const parent = process.env.CODEOPS_TMPDIR ?? "/tmp/opencode";
  demand(
    isAbsolute(parent) && !parent.split(sep).some((part) => part.startsWith(".")),
    "Invalid scratch parent",
  );
  demand(
    parent === "/tmp/opencode" || parent.startsWith(`/tmp/opencode${sep}`),
    "Scratch parent is not the approved temporary root",
  );
  demand(
    isAbsolute(project) && project === resolve(project),
    "Fixture path must be canonical and absolute",
  );
  contained(parent, project);
  demand(
    !relative(parent, project)
      .split(sep)
      .some((part) => part.startsWith(".")),
    "Hidden fixture paths are not admitted",
  );
  await ordinaryPath(project, true);
  return project;
}

/** Selection is checked in the manifest and again in both independent sidecars. */
function selection(value: Record<string, unknown>, manifest: boolean): void {
  const safety = manifest ? value : record(value.safety);
  demand(
    value[manifest ? "target" : "profileId"] === PROFILE &&
      value.optimization === "none" &&
      safety.boundsCheck === false &&
      safety.divisionZeroCheck === false,
    "Exercise machine or build options differ from the requested selection",
  );
}

/** Match the complete verified source span, not merely a nearby instruction. */
function fromSpan(origin: unknown, sourceIndex: number, start: number, end: number): boolean {
  const value = record(origin);
  demand(value.kind === "source" || value.kind === "generated", "Invalid source origin");
  const candidate = value.kind === "source" ? value.span : value.sourceSpan;
  if (candidate === undefined) return false;
  const span = record(candidate);
  return span.sourceIndex === sourceIndex && span.startByte === start && span.endByte === end;
}

/** The selected profile's observation locations must be unbanked CPU addresses. */
function cpuRange(
  value: unknown,
  spaces: readonly Record<string, unknown>[],
): { start: number; end: number } {
  const range = record(value);
  const space = spaces[integer(range.addressSpaceIndex)];
  demand(
    space !== undefined &&
      space.kind === "cpu" &&
      integer(space.sizeBytes) === 65536 &&
      Array.isArray(space.banks) &&
      space.banks.length === 0 &&
      range.bankIndex === undefined &&
      range.loadUnitIndex === undefined,
    "Observation needs an unbanked CPU memory range",
  );
  const start = integer(range.start);
  const end = integer(range.end);
  demand(start < end && end <= 65536, "Observation memory range is outside the CPU address space");
  return { start, end };
}

/** A complete resident source global may use multiple non-overlapping RAM pieces. */
function globalPieces(
  debug: Record<string, unknown>,
  sourceIndex: number,
  source: string,
  name: string,
  width: number,
): readonly MemoryPiece[] {
  const declaration = new RegExp(`\\blet ${name}: [a-z]+\\[[0-9]+\\];`, "g");
  const matches = [...source.matchAll(declaration)];
  demand(matches.length === 1, "Wrapper result declaration is missing or ambiguous");
  const match = matches[0]!;
  const start = Buffer.byteLength(source.slice(0, match.index));
  const end = start + Buffer.byteLength(match[0]);
  const symbols = records(debug.symbols);
  const candidates = symbols
    .map((symbol, index) => ({ symbol, index }))
    .filter(
      ({ symbol }) => symbol.kind === "global" && fromSpan(symbol.origin, sourceIndex, start, end),
    );
  demand(candidates.length === 1, "Wrapper result has no unique source-bound symbol");
  const { symbol, index } = candidates[0]!;
  demand(
    integer(symbol.byteWidth) === width &&
      symbol.type === (name === "directions" ? `boolean[${width}]` : `word[${width / 2}]`) &&
      Array.isArray(symbol.locationIndexes) &&
      symbol.locationIndexes.length === 1,
    "Wrapper result has the wrong width or location count",
  );
  const locations = records(debug.locations);
  const location = locations[integer(symbol.locationIndexes[0])];
  demand(
    location !== undefined &&
      location.symbolIndex === index &&
      location.contextIndex === undefined &&
      Array.isArray(location.liveRangeIndexes) &&
      location.liveRangeIndexes.length === 0,
    "Wrapper result is not resident for the complete observation",
  );
  demand(
    locations.filter((item) => item.symbolIndex === index).length === 1,
    "Wrapper result has conflicting locations",
  );
  const available = record(location.availability);
  demand(
    available.kind === "available" || available.kind === "split",
    "Wrapper result is not available in memory",
  );
  const spaces = records(debug.addressSpaces);
  const pieces = records(available.pieces)
    .map((piece) => {
      demand(piece.kind === "memory", "Wrapper result is not wholly memory-resident");
      const range = cpuRange(piece.machine, spaces);
      demand(range.start >= 0x0801 && range.end <= 0xd000, "Result piece is outside resident RAM");
      const offset = integer(piece.valueOffset);
      demand(
        integer(piece.byteLength) === range.end - range.start,
        "Wrapper result piece has an inconsistent extent",
      );
      return { ...range, offset };
    })
    .sort((left, right) => left.offset - right.offset);
  let offset = 0;
  for (const piece of pieces) {
    demand(piece.offset === offset, "Wrapper result pieces have gaps or overlapping values");
    offset += piece.end - piece.start;
  }
  demand(
    offset === width && pieces.length > 0,
    "Wrapper result pieces do not cover its complete value",
  );
  const byAddress = [...pieces].sort((left, right) => left.start - right.start);
  demand(
    byAddress.every((piece, i) => i === 0 || piece.start >= byAddress[i - 1]!.end),
    "Wrapper result memory pieces overlap",
  );
  return pieces;
}

/** Validate the complete operation interval; its actual entry also needs artifact proof. */
function completion(
  debug: Record<string, unknown>,
  sourceIndex: number,
  source: string,
  prg: Buffer,
): number {
  const offset = source.indexOf(MARKER);
  demand(
    offset >= 0 && source.indexOf(MARKER, offset + 1) < 0,
    "Wrapper completion marker is missing or ambiguous",
  );
  const start = Buffer.byteLength(source.slice(0, offset));
  const end = start + Buffer.byteLength(MARKER.slice(0, -1));
  const ranges = records(debug.ranges);
  const matching = ranges
    .map((range, index) => ({ range, index }))
    .filter(({ range }) => fromSpan(range.origin, sourceIndex, start, end));
  demand(matching.length > 0, "Missing completion mapping");
  const first = matching[0]!.range;
  const owner = record(first.owner);
  demand(owner.kind === "function", "Completion needs a function owner");
  const functionIndex = integer(owner.functionIndex);
  const fn = records(debug.functions)[functionIndex];
  const contextIndex = integer(first.contextIndex);
  const context = records(debug.contexts)[contextIndex];
  demand(
    fn !== undefined &&
      context !== undefined &&
      fn.kind === "ordinary" &&
      context.kind === "entry" &&
      context.functionIndex === functionIndex,
    "Invalid completion owner/context",
  );
  const declaration = record(fn.declaration);
  demand(
    declaration.sourceIndex === sourceIndex &&
      integer(declaration.startByte) <= start &&
      integer(declaration.endByte) >= end,
    "Completion owner is not the wrapper function",
  );
  const variant = records(fn.entryVariants)[integer(context.entryVariantIndex)];
  const [fnRanges, entryRanges] = [fn.rangeIndexes, variant?.rangeIndexes];
  demand(
    Array.isArray(fnRanges) && Array.isArray(entryRanges),
    "Invalid completion variant references",
  );
  const spaces = records(debug.addressSpaces);
  const spaceIndex = integer(record(first.machine).addressSpaceIndex);
  const intervals = matching
    .map(({ range, index }) => {
      const candidate = record(range.owner);
      demand(
        candidate.kind === "function" &&
          candidate.functionIndex === functionIndex &&
          range.contextIndex === contextIndex &&
          record(range.machine).addressSpaceIndex === spaceIndex &&
          fnRanges.includes(index) &&
          entryRanges.includes(index),
        "Conflicting completion references",
      );
      return cpuRange(range.machine, spaces);
    })
    .sort((left, right) => left.start - right.start);
  demand(
    intervals.every((item, index) => index === 0 || intervals[index - 1]!.end === item.start),
    "Disconnected or overlapping completion mappings",
  );
  demand(prg.length >= 3, "Primary artifact has no loaded program bytes");
  const load = prg.readUInt16LE(0);
  const entry = intervals[0]!.start;
  const finish = intervals.at(-1)!.end;
  demand(
    entry >= load && finish <= load + prg.length - 2 && load + prg.length - 2 <= 65536,
    "Completion operation is outside the bound PRG",
  );
  return entry;
}

/** Validate source identity against both sidecars before mapping any observations. */
async function sourcesBound(
  project: string,
  exercise: Exercise,
  build: Record<string, unknown>,
  debug: Record<string, unknown>,
): Promise<{ source: string; index: number }> {
  const names =
    exercise === "score"
      ? ["src/award-math.blend", "src/game.blend", "src/score.blend", LIBRARY_INPUT.path]
      : ["src/game.blend", "src/patrol.blend", LIBRARY_INPUT.path];
  const inventory = records(build.sources);
  const debugSources = records(debug.sources);
  demand(
    inventory.length === names.length && debugSources.length === names.length,
    "Exercise source inventory is incomplete or unexpected",
  );
  let source = "";
  for (const name of names) {
    const value =
      name === LIBRARY_INPUT.path ? undefined : await bytes(join(project, name), 1024 * 1024);
    const digest = value === undefined ? LIBRARY_INPUT.sha256 : sha256(value);
    const size = value === undefined ? LIBRARY_INPUT.bytes : value.length;
    const entries = inventory.filter((entry) => entry.path === name);
    const entriesDebug = debugSources.filter((entry) => entry.path === name);
    demand(
      entries.length === 1 &&
        entriesDebug.length === 1 &&
        hash(entries[0]!.sha256) === digest &&
        integer(entries[0]!.bytes) === size &&
        hash(entriesDebug[0]!.sha256) === digest &&
        integer(entriesDebug[0]!.byteLength) === size,
      "Exercise source identity differs from the published artifacts",
    );
    if (name === "src/game.blend" && value !== undefined) source = value.toString("utf8");
  }
  return { source, index: debugSources.findIndex((entry) => entry.path === "src/game.blend") };
}

/** Read only the returned generation's explicit primary/debug files, never current output. */
async function prepareExercise(projectPath: string, exercise: Exercise): Promise<PreparedExercise> {
  const project = await fixtureRoot(projectPath);
  const manifestBytes = await bytes(join(project, "blend65.json"), 1024 * 1024);
  const manifest = json(manifestBytes);
  selection(manifest, true);
  demand(
    manifest.sourceRoot === "src" &&
      manifest.entry === "Game" &&
      manifest.outDir === "out" &&
      Array.isArray(manifest.assetPaths) &&
      manifest.assetPaths.length === 0,
    "Exercise project layout differs from the fixed fixture",
  );
  const checked = await checkProject({ project: join(project, "blend65.json") });
  demand(checked.kind === "success", "Public source check failed");
  demand(checked.profileId === PROFILE, "Public source check selected a different machine");
  const built = await buildProject({ project: join(project, "blend65.json") });
  demand(built.kind === "success", "Public artifact build failed");
  const generation = built.generation;
  demand(GENERATION.test(generation.generationId), "Invalid publication generation identity");
  const directory = resolve(generation.directory);
  contained(join(project, "out"), directory);
  demand(
    !relative(join(project, "out"), directory)
      .split(sep)
      .some((part) => part.startsWith(".")),
    "Unexpected hidden generation path",
  );
  await ordinaryPath(directory, true);
  const buildBytes = await bytes(join(directory, ".build.json"), SIDECAR_LIMIT);
  demand(
    sha256(buildBytes) === hash(generation.buildJsonSha256),
    "Build sidecar differs from the returned generation",
  );
  const build = json(buildBytes);
  demand(
    build.kind === "blend65.build" &&
      build.schemaVersion === 1 &&
      build.generationId === generation.generationId,
    "Build sidecar has a different generation or schema",
  );
  const inputs = record(build.semanticInputs);
  const options = record(inputs.options);
  demand(
    record(inputs.target).profileId === PROFILE &&
      options.optimization === "none" &&
      options.boundsCheck === false &&
      options.divisionZeroCheck === false,
    "Build sidecar selects different machine options",
  );
  const manifestIdentity = record(inputs.manifest);
  demand(
    hash(manifestIdentity.sha256) === sha256(manifestBytes) &&
      integer(manifestIdentity.bytes) === manifestBytes.length,
    "Build sidecar is bound to a different manifest",
  );
  const artifacts = records(build.artifacts);
  const primary = artifacts.filter((entry) => entry.kind === "primary");
  const debugEntries = artifacts.filter((entry) => entry.kind === "debug");
  demand(
    primary.length === 1 && debugEntries.length === 1 && debugEntries[0]!.path === ".debug.json",
    "Primary/debug artifact inventory is ambiguous",
  );
  const name = generation.primaryArtifact;
  demand(
    /^[A-Za-z0-9][A-Za-z0-9_-]*\.prg$/.test(name) && primary[0]!.path === name,
    "Primary artifact path is not the selected owned PRG",
  );
  const prgPath = join(directory, name);
  const prg = await bytes(prgPath, 65538);
  const debugBytes = await bytes(join(directory, ".debug.json"), SIDECAR_LIMIT);
  demand(
    sha256(prg) === hash(primary[0]!.sha256) &&
      prg.length === integer(primary[0]!.bytes) &&
      sha256(debugBytes) === hash(debugEntries[0]!.sha256) &&
      debugBytes.length === integer(debugEntries[0]!.bytes),
    "Primary/debug bytes differ from their build identities",
  );
  const debug = json(debugBytes);
  demand(
    debug.kind === "blend65.debug" && debug.schemaVersion === 1,
    "Unsupported debug evidence schema",
  );
  selection(debug, false);
  const primaryDebug = record(debug.primaryArtifact);
  demand(
    primaryDebug.path === name && hash(primaryDebug.sha256) === sha256(prg),
    "Debug evidence is bound to another primary artifact",
  );
  for (const key of ["compiler", "specification", "expertSkill"]) {
    const left = record(inputs[key]);
    const right = record(debug[key]);
    demand(
      typeof left.name === "string" &&
        left.name.length > 0 &&
        typeof left.version === "string" &&
        left.version.length > 0 &&
        hash(left.sha256) === hash(right.sha256) &&
        left.name === right.name &&
        left.version === right.version,
      "Build/debug authority identities differ",
    );
  }
  const wrapper = await sourcesBound(project, exercise, inputs, debug);
  const words = globalPieces(
    debug,
    wrapper.index,
    wrapper.source,
    exercise === "score" ? "scores" : "positions",
    exercise === "score" ? 12 : 20,
  );
  const directions =
    exercise === "patrol"
      ? globalPieces(debug, wrapper.index, wrapper.source, "directions", 10)
      : [];
  demand(
    words.every((word) =>
      directions.every((direction) => word.end <= direction.start || direction.end <= word.start),
    ),
    "Distinct wrapper arrays have overlapping memory locations",
  );
  return {
    prg: prgPath,
    generationId: generation.generationId,
    prgSha256: sha256(prg),
    buildJsonSha256: generation.buildJsonSha256,
    checkpoint: completion(debug, wrapper.index, wrapper.source, prg),
    words,
    directions,
  };
}

/** Read each checked piece into its source-value offset, without CPU side effects. */
async function readPieces(
  monitor: ViceMonitor,
  pieces: readonly MemoryPiece[],
  width: number,
): Promise<Uint8Array> {
  const value = new Uint8Array(width);
  for (const piece of pieces) {
    const read = await monitor.readMemory(piece.start, piece.end - 1);
    demand(read.length === piece.end - piece.start, "Runtime returned an incomplete memory piece");
    value.set(read, piece.offset);
  }
  return value;
}

/** Observe only the two fixed wrappers; no expected answer enters this function.
 *
 * The caller must own an agreed exclusive VICE window before invoking this helper.
 * Invalid preparation returns Unknown before launch. Startup and cleanup errors
 * propagate so an unconfirmed owned-process exit cannot be reported as success.
 * @param project Absolute caller-owned temporary project directory.
 * @param exercise Selects only the wrapper layout, never its expected values.
 * @returns Actual RAM values with generation/runtime identities, or a bounded Unknown.
 * @throws When the existing runtime cannot start safely or confirm owned cleanup.
 * @example const result = await observeExercise(project, "score");
 */
export async function observeExercise(
  project: string,
  exercise: Exercise,
): Promise<ExerciseObservation> {
  let prepared: PreparedExercise;
  try {
    demand(exercise === "score" || exercise === "patrol", "Unknown exercise layout");
    prepared = await prepareExercise(project, exercise);
  } catch (error) {
    return {
      kind: "unknown",
      reason:
        error instanceof ObservationError
          ? error.message
          : "Exercise preparation could not be verified",
    };
  }
  const runtime = await startVice(prepared.prg, MAXIMUM_CYCLES, PROFILE, false, false);
  if ("kind" in runtime) return runtime;
  try {
    for (const resource of ["VICIIModel", "SidModel", "CIA1Model", "CIA2Model"] as const) {
      demand(
        (await runtime.monitor.readIntegerResource(resource)) === 0,
        "VICE selected a different machine/chip model",
      );
    }
    const checkpoint = await runtime.monitor.setExecuteCheckpoint(prepared.checkpoint);
    runtime.monitor.takeCheckpointHits();
    const [address] = await Promise.all([
      runtime.monitor.waitForStop(CHECKPOINT_TIMEOUT_MS),
      runtime.monitor.resume(),
    ]);
    demand(
      address === prepared.checkpoint && runtime.monitor.takeCheckpointHits().includes(checkpoint),
      "Runtime did not stop at the owned completion checkpoint",
    );
    const port = await runtime.monitor.readMemory(0, 1);
    demand(
      port.length === 2 && (port[0]! & 7) === 7 && (port[1]! & 7) === 6,
      "Result RAM is not CPU-visible under the selected banking",
    );
    const width = exercise === "score" ? 12 : 20;
    const wordBytes = await readPieces(runtime.monitor, prepared.words, width);
    const words = Object.freeze(
      Array.from({ length: width / 2 }, (_, i) => wordBytes[i * 2]! | (wordBytes[i * 2 + 1]! << 8)),
    );
    const identity: ObservationIdentity = {
      generationId: prepared.generationId,
      prgSha256: prepared.prgSha256,
      buildJsonSha256: prepared.buildJsonSha256,
      runtime: runtime.identity,
    };
    if (exercise === "score") return { kind: "observed", exercise, scores: words, ...identity };
    const directionBytes = await readPieces(runtime.monitor, prepared.directions, 10);
    demand(
      directionBytes.every((value) => value === 0 || value === 1),
      "Runtime returned a noncanonical Boolean direction",
    );
    return {
      kind: "observed",
      exercise,
      positions: words,
      directions: Object.freeze(Array.from(directionBytes, (value) => value === 1)),
      ...identity,
    };
  } catch (error) {
    return {
      kind: "unknown",
      reason:
        error instanceof ObservationError
          ? error.message
          : "VICE checkpoint or memory observation did not complete",
    };
  } finally {
    await stopVice(runtime);
  }
}

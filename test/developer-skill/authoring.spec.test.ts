import { createHash, randomUUID } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { basename, isAbsolute, join, parse, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { BuildSuccess } from "@blend65/compiler";
import { describe, expect, it, vi } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const DRIVER = join(ROOT, "test/developer-skill/qualification-driver.ts");
const APPLICATIONS = join(ROOT, "examples/developer-skill-qualification");
const SOURCES = {
  score: ["score/src/award-math.blend", "score/src/score.blend"],
  patrol: ["patrol/src/patrol.blend"],
} as const;

/** Host watchdog only; this is not a measured machine-cycle or frame deadline. */
const OBSERVATION_TIMEOUT_MS = 120_000;

/** Independent unsigned-word sums include byte carries and 16-bit wrapping. */
const SCORE_INPUTS = [
  { initial: 0, awards: [0, 0, 0, 0] },
  { initial: 0, awards: [1, 2, 3, 4] },
  { initial: 255, awards: [1, 0, 0, 0] },
  { initial: 65535, awards: [1, 0, 0, 0] },
  { initial: 65530, awards: [10, 0, 0, 0] },
  { initial: 0, awards: [255, 255, 1, 1] },
] as const;
const EXPECTED_SCORES = [0, 10, 256, 0, 4, 512];

/** Zero moves preserve direction; positive endpoint arrivals reverse direction. */
const PATROL_INPUTS = [
  { x: 255, right: true, amount: 1 },
  { x: 318, right: true, amount: 2 },
  { x: 1, right: false, amount: 2 },
  { x: 0, right: false, amount: 0 },
  { x: 319, right: true, amount: 0 },
  { x: 319, right: true, amount: 1 },
  { x: 0, right: false, amount: 1 },
  { x: 318, right: true, amount: 1 },
  { x: 1, right: false, amount: 1 },
  { x: 256, right: false, amount: 1 },
] as const;
const EXPECTED_POSITIONS = [256, 319, 0, 0, 319, 319, 0, 319, 0, 255];
const EXPECTED_DIRECTIONS = [true, false, true, false, true, false, true, false, true, false];

/** Runtime identity binds these observations to the selected emulator and ROMs. */
const EXECUTABLE_SHA256 = "f148b33869c634964a75bcf3055f7415a6e87ef5984b66ecd486541a51c3fd74";
const ROMS = [
  {
    name: "kernal-901227-03.bin",
    bytes: 8192,
    sha256: "83c60d47047d7beab8e5b7bf6f67f80daa088b7a6a27de0d7e016f6484042721",
  },
  {
    name: "basic-901226-01.bin",
    bytes: 8192,
    sha256: "89878cea0a268734696de11c4bae593eaaa506465d2029d619c0e0cbccdfa62d",
  },
  {
    name: "chargen-901225-01.bin",
    bytes: 4096,
    sha256: "fd0d53b8480e86163ac98998976c72cc58d5dd8eb824ed7b829774e74213b420",
  },
] as const;

/**
 * The wrapper supplies inputs, never answers. Each call consumes a real const
 * array; application traversal and const preservation also need source review.
 */
function scoreWrapper(): string {
  const arrays = SCORE_INPUTS.map(
    ({ awards }, index) => `const awards${index}: byte[4] = [${awards.join(", ")}];`,
  );
  const calls = SCORE_INPUTS.map(
    ({ initial }, index) => `    scores[${index}] = addAwards(${initial}, awards${index});`,
  );
  return [
    "module Game;",
    "import { addAwards } from Score;",
    "let scores: word[6];",
    ...arrays,
    "function main(): void {",
    ...calls,
    "    c64.vic.setBorderColor(13);",
    "}",
    "",
  ].join("\n");
}

/** Observe an ordinary struct return once per input, before the completion marker. */
function patrolWrapper(): string {
  const calls = PATROL_INPUTS.flatMap(({ x, right, amount }, index) => [
    `    state = step(${x}, ${right}, ${amount});`,
    `    positions[${index}] = state.x;`,
    `    directions[${index}] = state.right;`,
  ]);
  return [
    "module Game;",
    "import { step, PatrolState } from Patrol;",
    "let positions: word[10];",
    "let directions: boolean[10];",
    "function main(): void {",
    "    let state: PatrolState;",
    ...calls,
    "    c64.vic.setBorderColor(13);",
    "}",
    "",
  ].join("\n");
}

/**
 * Inspect fixed inputs and the selected scratch directory without following
 * symlinks. Missing inputs become assertion evidence, not import or read crashes.
 */
async function pathIssue(
  absolute: string,
  leaf: "file" | "directory",
): Promise<string | undefined> {
  let current = parse(absolute).root;
  const parts = absolute.slice(current.length).split(sep).filter(Boolean);
  for (const [index, part] of parts.entries()) {
    current = join(current, part);
    try {
      const entry = await lstat(current);
      if (entry.isSymbolicLink()) return `Symlink rejected: ${absolute}`;
      const needsDirectory = index < parts.length - 1 || leaf === "directory";
      if (needsDirectory ? !entry.isDirectory() : !entry.isFile()) {
        return `Wrong entry type: ${absolute}`;
      }
    } catch (error) {
      const missing = error instanceof Error && "code" in error && error.code === "ENOENT";
      return `${missing ? "Missing" : "Cannot inspect"}: ${absolute}`;
    }
  }
  return undefined;
}

/** Fail before probing a hidden or relative scratch path; create only an owned child. */
async function createProject(exercise: "score" | "patrol"): Promise<string> {
  const parent = process.env.CODEOPS_TMPDIR ?? "/tmp/opencode";
  expect(isAbsolute(parent), "Scratch parent must be absolute").toBe(true);
  expect(
    parent.split(sep).every((part) => !part.startsWith(".")),
    "Scratch parent must not traverse hidden or parent-relative paths",
  ).toBe(true);
  expect(
    await pathIssue(parent, "directory"),
    "Scratch parent must be an existing directory without symlinks",
  ).toBeUndefined();
  return mkdtemp(join(parent, `developer-skill-${exercise}-`));
}

/** A plain object can be inspected field by field without unsafe type assertions. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Narrow externally supplied observations without trusting a cast or driver types. */
function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    expect.fail("Expected an observation object, not absent or scalar evidence");
  }
  return value;
}

/** Paths are reported identity fields, not requests to inspect runtime binaries. */
function expectNonemptyPath(value: unknown): void {
  expect(typeof value, "Runtime path must be a string").toBe("string");
  if (typeof value === "string") {
    expect(value.trim(), "Runtime path must not be empty").not.toBe("");
  }
}

/**
 * Validate the public observation's identity fields, not private artifact layout.
 * Hash syntax alone does not prove provenance; the observer must bind the actual
 * public build generation and memory read under independent implementation review.
 */
function expectEvidence(observation: Record<string, unknown>): void {
  expect(observation.generationId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  expect(observation.prgSha256).toMatch(/^[0-9a-f]{64}$/);
  expect(observation.buildJsonSha256).toMatch(/^[0-9a-f]{64}$/);
  const runtime = record(observation.runtime);
  expectNonemptyPath(runtime.executable);
  expect(runtime.executableSha256).toBe(EXECUTABLE_SHA256);
  if (!Array.isArray(runtime.roms)) {
    expect.fail("Observed runtime must identify its three ROMs");
  }
  const roms: readonly unknown[] = runtime.roms;
  expect(roms).toHaveLength(3);
  for (const expected of ROMS) {
    const matching = roms.filter((rom) => record(rom).name === expected.name);
    expect(matching, `Unique runtime ROM: ${expected.name}`).toHaveLength(1);
    const rom = record(matching[0]);
    expectNonemptyPath(rom.path);
    expect(rom.bytes).toBe(expected.bytes);
    expect(rom.sha256).toBe(expected.sha256);
  }
}

/** The same fixed manifest and wrapper layout serve real authors and owned controls. */
async function writeFixture(
  project: string,
  exercise: "score" | "patrol",
  wrapper: string,
): Promise<void> {
  await mkdir(join(project, "src"));
  await writeFile(join(project, "src/game.blend"), wrapper, "utf8");
  await writeFile(
    join(project, "blend65.json"),
    JSON.stringify({
      schemaVersion: 1,
      name: `developer-skill-${exercise}`,
      sourceRoot: "src",
      entry: "Game",
      target: "c64-pal-prg-kernal-6581",
      assetPaths: [],
      outDir: "out",
      optimization: "none",
      boundsCheck: false,
      divisionZeroCheck: false,
    }),
    "utf8",
  );
}

/** A missing observer must fail before loading any compiler code or creating fixtures. */
async function requireObserver(): Promise<void> {
  expect(
    await pathIssue(DRIVER, "file"),
    "Required observer must exist before control execution",
  ).toBeUndefined();
}

/** Delay the observer import until its explicit existence assertion has succeeded. */
async function loadObserver(): Promise<
  (project: string, exercise: "score" | "patrol") => Promise<unknown>
> {
  await requireObserver();
  const loaded = record(await import(pathToFileURL(DRIVER).href));
  const observe = loaded.observeExercise;
  if (typeof observe !== "function") {
    expect.fail("Observer must export observeExercise(project, exercise)");
  }
  return async (project, exercise): Promise<unknown> => observe(project, exercise);
}

/** Only genuinely observed values may reach either the positive or semantic control oracle. */
function expectObserved(value: unknown, exercise: "score" | "patrol"): Record<string, unknown> {
  const observation = record(value);
  expect(observation.kind, "Build failure, unavailable runtime/window or Unknown cannot pass").toBe(
    "observed",
  );
  expect(observation.exercise).toBe(exercise);
  expectEvidence(observation);
  return observation;
}

/**
 * Missing authors or observer stop before importing or starting any runtime.
 * All outputs belong to a newly created scratch project, removed even on failure.
 * The observer accepts only project and exercise, never these tests' answers.
 */
async function observeAuthored(exercise: "score" | "patrol"): Promise<Record<string, unknown>> {
  const sources = SOURCES[exercise].map((file) => join(APPLICATIONS, file));
  const issues: string[] = [];
  for (const file of [DRIVER, ...sources]) {
    const issue = await pathIssue(file, "file");
    if (issue) issues.push(issue);
  }
  expect(issues, "Required authored modules and observer must exist").toEqual([]);

  const observe = await loadObserver();
  const project = await createProject(exercise);
  try {
    await writeFixture(project, exercise, exercise === "score" ? scoreWrapper() : patrolWrapper());
    for (const source of sources) {
      await copyFile(source, join(project, "src", basename(source)));
    }
    return expectObserved(await observe(project, exercise), exercise);
  } finally {
    await rm(project, { recursive: true, force: true });
  }
}

/** Only these finite fixture faults belong to the observation controls. */
const FAULTS = [
  "missing-global",
  "wrong-width",
  "missing-marker",
  "ambiguous-marker",
  "invalid-location",
  "wrong-generation",
  "wrong-artifact",
  "stale-source",
  "wrong-profile",
  "wrong-mode",
] as const;
/** Closed fault names keep all corruption local to these two exercise fixtures. */
type Fault = (typeof FAULTS)[number];

/** Keep corruption results aligned with the existing public generation contract. */
type Generation = BuildSuccess["generation"];

/** These intentionally wrong modules are controls, never replacements for authors. */
const WRONG_MODULES = {
  score: {
    "award-math.blend":
      "module AwardMath; export function addAward(total: word, award: byte): word { return 0; }",
    "score.blend":
      "module Score; export function addAwards(initial: word, awards: const byte[4]): word { return 0; }",
  },
  patrol: {
    "patrol.blend":
      "module Patrol; export struct PatrolState { x: word; right: boolean; } export function step(x: word, right: boolean, amount: byte): PatrolState { return { x: 0, right: false }; }",
  },
};

/** Hash owned fixture bytes without reading the emulator executable or ROMs. */
function sha256(bytes: string | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** JSON arrays remain untrusted until each selected record is checked. */
function array(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) expect.fail("Control setup requires a public JSON array");
  return value;
}

/** Inspect only the published record fields needed by a finite control. */
function records(value: unknown): Record<string, unknown>[] {
  return array(value).map(record);
}

/** A recorded path or field must be text before it can select owned fixture bytes. */
function text(value: unknown): string {
  if (typeof value !== "string" || !value) expect.fail("Control setup requires nonempty text");
  return value;
}

/** Reject foreign paths before probing; cleanup and corruption stay in one fixture. */
function expectContained(parent: string, child: string): void {
  const tail = relative(parent, child);
  expect(
    tail !== "" && tail !== ".." && !tail.startsWith(`..${sep}`) && !isAbsolute(tail),
    "Control path must be strictly inside its owned parent",
  ).toBe(true);
}

/** Only contained public sidecars and PRGs can be read or changed by a control. */
async function ownedFile(directory: string, name: unknown): Promise<string> {
  const entry = text(name);
  expect(
    !isAbsolute(entry) &&
      !entry.includes("\\") &&
      /(?:\.build\.json|\.debug\.json|\.prg)$/.test(entry),
    "Control must select an approved generation-relative artifact",
  ).toBe(true);
  expect(
    entry
      .split("/")
      .every(
        (part, index, parts) =>
          !part.startsWith(".") ||
          (index === parts.length - 1 && [".build.json", ".debug.json"].includes(part)),
      ),
    "Only the explicitly approved sidecar names may be hidden",
  ).toBe(true);
  const file = resolve(directory, entry);
  expectContained(directory, file);
  expect(relative(directory, file).split(sep).join("/")).toBe(entry);
  expect(
    await pathIssue(file, "file"),
    "Control artifact must exist without symlinks",
  ).toBeUndefined();
  return file;
}
type Fields = Record<string, unknown>;
/** Resolve nonnegative public indices before consuming a selected record. */
function indexed(values: unknown, index: unknown): Fields {
  expect(Number.isSafeInteger(index) && Number(index) >= 0).toBe(true);
  return record(array(values)[Number(index)]);
}
/** Match the complete declaration or operation span, not a contained instruction span. */
function exactSpan(origin: unknown, sourceIndex: number, start: number, end: number): boolean {
  const value = record(origin);
  const span = value.kind === "source" ? value.span : value.sourceSpan;
  if (!isRecord(span)) return false;
  return span.sourceIndex === sourceIndex && span.startByte === start && span.endByte === end;
}
/** Change one binding, preserving unrelated evidence; broken setup must fail the control. */
function mutateDebug(debug: Fields, build: Fields, fault: Fault, wrapper: string): void {
  const sources = records(debug.sources);
  expect(sources.filter((source) => source.path === "src/game.blend")).toHaveLength(1);
  const sourceIndex = sources.findIndex((source) => source.path === "src/game.blend");
  const source = record(sources[sourceIndex]);
  expect(source.byteLength).toBe(Buffer.byteLength(wrapper));
  expect(source.sha256).toBe(sha256(wrapper));
  if (fault === "stale-source") {
    source.sha256 = "0".repeat(64);
    expect(source.sha256).not.toBe(sha256(wrapper));
  } else if (fault === "wrong-profile") {
    expect(record(record(build.semanticInputs).target).profileId).toBe("c64-pal-prg-kernal-6581");
    expect(debug.profileId).toBe("c64-pal-prg-kernal-6581");
    record(record(build.semanticInputs).target).profileId = "control-unselected-profile";
    debug.profileId = "control-unselected-profile";
  } else if (fault === "wrong-mode") {
    expect(record(record(build.semanticInputs).options).optimization).toBe("none");
    expect(debug.optimization).toBe("none");
    record(record(build.semanticInputs).options).optimization = "speed";
    debug.optimization = "speed";
  } else if (fault === "ambiguous-marker") {
    const marker = "c64.vic.setBorderColor(13)";
    const offset = wrapper.indexOf(marker);
    expect(offset).toBeGreaterThanOrEqual(0);
    const start = Buffer.byteLength(wrapper.slice(0, offset));
    const end = start + Buffer.byteLength(marker);
    const ranges = records(debug.ranges);
    /** Group this fixture's marker records by owner, context and address space. */
    const domain = (range: Fields) =>
      JSON.stringify([range.owner, range.contextIndex, record(range.machine).addressSpaceIndex]);
    /** Validate the full operation's entry and every consumed ownership reference. */
    const interval = (range: Fields) => {
      const [machine, owner] = [record(range.machine), record(range.owner)] as const;
      expect(owner.kind).toBe("function");
      const fn = indexed(debug.functions, owner.functionIndex);
      expect(array(fn.rangeIndexes)).toContain(ranges.indexOf(range));
      expect(indexed(debug.contexts, range.contextIndex).functionIndex).toBe(owner.functionIndex);
      const size = indexed(debug.addressSpaces, machine.addressSpaceIndex).sizeBytes;
      expect([machine.start, machine.end, size].every(Number.isSafeInteger)).toBe(true);
      const [left, right] = [Number(machine.start), Number(machine.end)] as const;
      expect(left >= 0 && right > left && right <= Number(size)).toBe(true);
      return { range, start: left, end: right, domain: domain(range) };
    };
    const matches = (range: Fields) => exactSpan(range.origin, sourceIndex, start, end);
    const byStart = (a: { start: number }, b: { start: number }) => a.start - b.start;
    /** Include every exact-span instruction before identifying the operation's entry. */
    const matching = () => ranges.filter(matches).map(interval).sort(byStart);
    const baseline = matching();
    const [first, last] = [baseline[0], baseline.at(-1)] as const;
    if (!first || !last) expect.fail("Missing marker operation");
    baseline.forEach((item, index) => {
      expect(item.domain).toBe(first.domain);
      if (index) expect(item.start).toBe(baseline[index - 1]?.end);
    });
    const unchanged = JSON.stringify(baseline);
    const donor = ranges
      .filter((range) => domain(range) === first.domain)
      .map(interval)
      .find((item) => item.end < first.start || item.start > last.end);
    if (!donor) expect.fail("Missing positively separated donor");
    const origin = record(donor.range.origin);
    const operationSpan = { sourceIndex, startByte: start, endByte: end };
    origin[origin.kind === "source" ? "span" : "sourceSpan"] = operationSpan;
    expect(JSON.stringify(baseline)).toBe(unchanged);
    const ambiguous = matching();
    expect(ambiguous).toHaveLength(baseline.length + 1);
    expect(
      ambiguous.filter((item, i) => !i || item.start > (ambiguous[i - 1]?.end ?? Infinity)),
    ).toHaveLength(2);
  } else if (fault === "invalid-location") {
    const declaration = "let scores: word[6];";
    const offset = wrapper.indexOf(declaration);
    expect(offset).toBeGreaterThanOrEqual(0);
    const start = Buffer.byteLength(wrapper.slice(0, offset));
    const symbols = records(debug.symbols).filter(
      (symbol) =>
        symbol.kind === "global" &&
        exactSpan(symbol.origin, sourceIndex, start, start + Buffer.byteLength(declaration)),
    );
    expect(symbols, "Control needs the exact wrapper global").toHaveLength(1);
    expect(record(symbols[0])).toMatchObject({ type: "word[6]", byteWidth: 12 });
    const pieces = array(record(symbols[0]).locationIndexes).flatMap((index) => {
      const location = indexed(records(debug.locations), index);
      expect([location.contextIndex, location.liveRangeIndexes]).toEqual([undefined, []]);
      const availability = record(location.availability);
      const resident = ["available", "split"].includes(text(availability.kind));
      return resident ? records(availability.pieces) : [];
    });
    const piece = pieces.find((candidate) => candidate.kind === "memory");
    if (!piece) expect.fail("Control needs a resident memory piece");
    const machine = record(piece.machine);
    const size = indexed(debug.addressSpaces, machine.addressSpaceIndex).sizeBytes;
    const width = piece.byteLength;
    if (typeof size !== "number" || typeof width !== "number" || width <= 0)
      expect.fail("Invalid setup memory extent");
    expect(machine.start).toBeGreaterThanOrEqual(0);
    expect(machine.end).toBeLessThanOrEqual(size);
    machine.start = size;
    machine.end = size + width;
    expect(machine.end).toBeGreaterThan(size);
  } else {
    expect.fail("Control did not select a debug mutation");
  }
}
/**
 * Corrupt only a real successful fixture generation. Debug controls rebind both
 * sidecar digests, so stale container hashes cannot substitute for semantic checks.
 */
async function corruptGeneration(
  project: string,
  generation: Generation,
  fault: Fault,
  wrapper: string,
): Promise<Generation> {
  if (["missing-global", "wrong-width", "missing-marker"].includes(fault)) return generation;
  if (fault === "wrong-generation") {
    const generationId = randomUUID();
    expect(generationId).not.toBe(generation.generationId);
    return { ...generation, generationId };
  }
  const directory = resolve(generation.directory);
  expectContained(project, directory);
  expect(await pathIssue(directory, "directory")).toBeUndefined();
  const builds = (await readdir(directory)).filter((name) => name.endsWith(".build.json"));
  expect(builds).toHaveLength(1);
  const buildPath = await ownedFile(directory, builds[0]);
  const buildBytes = await readFile(buildPath);
  expect(sha256(buildBytes)).toBe(generation.buildJsonSha256);
  const parsedBuild: unknown = JSON.parse(buildBytes.toString("utf8"));
  const build = record(parsedBuild);
  expect(build.kind).toBe("blend65.build");
  expect(build.generationId).toBe(generation.generationId);
  const artifacts = records(build.artifacts);
  if (fault === "wrong-artifact") {
    const primary = artifacts.filter((artifact) => artifact.kind === "primary");
    expect(primary).toHaveLength(1);
    const path = await ownedFile(directory, record(primary[0]).path);
    const bytes = await readFile(path);
    expect(sha256(bytes)).toBe(record(primary[0]).sha256);
    const last = bytes.at(-1);
    if (last === undefined) expect.fail("Control needs a nonempty PRG");
    bytes[bytes.length - 1] = last ^ 1;
    await writeFile(path, bytes);
    expect(sha256(bytes)).not.toBe(record(primary[0]).sha256);
    return generation;
  }
  const entries = artifacts.filter((artifact) => artifact.kind === "debug");
  expect(entries).toHaveLength(1);
  const entry = record(entries[0]);
  const debugPath = await ownedFile(directory, entry.path);
  const debugBytes = await readFile(debugPath);
  expect(sha256(debugBytes)).toBe(entry.sha256);
  expect(debugBytes.length).toBe(entry.bytes);
  const parsedDebug: unknown = JSON.parse(debugBytes.toString("utf8"));
  const debug = record(parsedDebug);
  expect(debug.kind).toBe("blend65.debug");
  mutateDebug(debug, build, fault, wrapper);
  const encodedDebug = `${JSON.stringify(debug)}\n`;
  entry.bytes = Buffer.byteLength(encodedDebug);
  entry.sha256 = sha256(encodedDebug);
  await writeFile(debugPath, encodedDebug, "utf8");
  const encodedBuild = `${JSON.stringify(build)}\n`;
  await writeFile(buildPath, encodedBuild, "utf8");
  return { ...generation, buildJsonSha256: sha256(encodedBuild) };
}

/**
 * Interpose only at the public build boundary, retaining its real artifacts.
 * Source faults are compiled independently so valid early rejection is allowed.
 * Evidence faults must reach the real build and complete their chosen corruption;
 * an earlier build or mutation failure is setup failure, never a passing control.
 */
async function observeControl(
  exercise: "score" | "patrol",
  fault?: Fault,
): Promise<Record<string, unknown>> {
  await requireObserver();
  const project = await createProject(exercise);
  let restore = (): void => {};
  try {
    let wrapper = exercise === "score" ? scoreWrapper() : patrolWrapper();
    if (fault === "missing-global") wrapper = wrapper.replaceAll("scores", "controlScores");
    if (fault === "wrong-width")
      wrapper = wrapper
        .replace("scores: word[6]", "scores: byte[6]")
        .replace(/= addAwards\(([^;]+)\);/g, "= byte(addAwards($1));");
    if (fault === "missing-marker")
      wrapper = wrapper.replace("    c64.vic.setBorderColor(13);", "");
    const sourceFault =
      fault !== undefined && ["missing-global", "wrong-width", "missing-marker"].includes(fault);
    if (sourceFault) expect(wrapper).not.toBe(scoreWrapper());
    await writeFixture(project, exercise, wrapper);
    for (const [name, source] of Object.entries(WRONG_MODULES[exercise])) {
      await writeFile(join(project, "src", name), source, "utf8");
    }
    vi.resetModules();
    const compiler = await import("@blend65/compiler");
    const build = compiler.buildProject;
    let completedBuild = false;
    let setupFailed = false;
    if (sourceFault) {
      const result = await build({ project: join(project, "blend65.json") });
      expect(result.kind, "Malformed observation wrapper must still compile").toBe("success");
      completedBuild = true;
    }
    const spy = vi.spyOn(compiler, "buildProject").mockImplementation(async (...args) => {
      try {
        const result = await build(...args);
        expect(result.kind, "Control requires a successful real public build").toBe("success");
        if (result.kind !== "success") expect.fail("Control fixture did not compile");
        expectContained(project, resolve(result.generation.directory));
        const generation = fault
          ? await corruptGeneration(project, result.generation, fault, wrapper)
          : result.generation;
        completedBuild = true;
        return { ...result, generation };
      } catch (error) {
        setupFailed = true;
        throw error;
      }
    });
    restore = () => spy.mockRestore();
    const observe = await loadObserver();
    const value = await observe(project, exercise);
    expect(setupFailed, "Observer must not hide a failed control setup").toBe(false);
    expect(completedBuild, "Control must complete its successful build and selected fault").toBe(
      true,
    );
    return record(value);
  } finally {
    restore();
    vi.resetModules();
    await rm(project, { recursive: true, force: true });
  }
}

/**
 * Execute only in an exclusive emulator window. Native discovery, fresh-context
 * independence, const-source review, expert costs and physical hardware proof
 * are separate gates; these tests compare observed memory with fixed answers.
 */
describe.sequential("developer skill authored application observations", () => {
  it(
    "should retain carries and wrap word sums when all six score inputs execute",
    async () => {
      const observation = await observeAuthored("score");
      expect(observation.scores).toEqual(EXPECTED_SCORES);
    },
    OBSERVATION_TIMEOUT_MS,
  );

  it(
    "should clamp, reverse and preserve zero moves when all ten patrol inputs execute",
    async () => {
      const observation = await observeAuthored("patrol");
      expect(observation.positions).toEqual(EXPECTED_POSITIONS);
      expect(observation.directions).toEqual(EXPECTED_DIRECTIONS);
    },
    OBSERVATION_TIMEOUT_MS,
  );

  it(
    "should expose a score mismatch when a compiled control always returns zero",
    async () => {
      const observation = expectObserved(await observeControl("score"), "score");
      expect(observation.scores).toEqual([0, 0, 0, 0, 0, 0]);
      expect(observation.scores).not.toEqual(EXPECTED_SCORES);
    },
    OBSERVATION_TIMEOUT_MS,
  );

  it(
    "should expose patrol mismatches when a compiled control always returns zero and false",
    async () => {
      const observation = expectObserved(await observeControl("patrol"), "patrol");
      expect(observation.positions).toEqual(new Array<number>(10).fill(0));
      expect(observation.directions).toEqual(new Array<boolean>(10).fill(false));
      expect(observation.positions).not.toEqual(EXPECTED_POSITIONS);
      expect(observation.directions).not.toEqual(EXPECTED_DIRECTIONS);
    },
    OBSERVATION_TIMEOUT_MS,
  );

  it.each(FAULTS)(
    "should reject untrustworthy evidence when the owned fixture has %s",
    async (fault) => {
      const observation = await observeControl("score", fault);
      expect(observation.kind, "Corrupted evidence must not become observed answers").toBe(
        "unknown",
      );
      expect(typeof observation.reason).toBe("string");
      if (typeof observation.reason === "string") expect(observation.reason.trim()).not.toBe("");
    },
    OBSERVATION_TIMEOUT_MS,
  );
});

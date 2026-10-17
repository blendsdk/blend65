import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import * as compiler from "@blend65/compiler";
import type { BuildSuccess } from "@blend65/compiler";
import { describe, expect, it, vi } from "vitest";
import * as runtime from "../m1/vice-runtime.js";
import { observeExercise } from "./qualification-driver.js";

/** These are deliberately wrong computations, not fresh-author implementations. */
const GAME = [
  "module Game;",
  "import { addAwards } from Score;",
  "let scores: word[6];",
  "const awards: byte[4] = [1, 2, 3, 4];",
  "function main(): void {",
  "  for (let i: byte = 0; i < 6; i += 1) { scores[i] = addAwards(0, awards); }",
  "  c64.vic.setBorderColor(13);",
  "}",
].join("\n");

/** Narrow only the small published record fragments used by owned corruptions. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Fixture setup rejects malformed data instead of bypassing type checks. */
function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new TypeError("Expected an owned evidence object");
  }
  return value;
}

/** Reject malformed fixture setup instead of crediting it as consumer rejection. */
function records(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new TypeError("Expected owned evidence records");
  return value.map(record);
}

/** Use exact bytes to rebind both containing sidecar identities after corruption. */
function hash(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Each fixture has its own source, publication generations and cleanup lifetime. */
async function withProject(inspect: (project: string) => Promise<void>): Promise<void> {
  const project = await mkdtemp(
    join(process.env.CODEOPS_TMPDIR ?? "/tmp/opencode", "observer-hardening-"),
  );
  try {
    await mkdir(join(project, "src"));
    await writeFile(join(project, "src/game.blend"), GAME);
    await writeFile(
      join(project, "src/award-math.blend"),
      "module AwardMath; export function addAward(total: word, award: byte): word { return 0; }",
    );
    await writeFile(
      join(project, "src/score.blend"),
      "module Score; export function addAwards(initial: word, awards: const byte[4]): word { return 0; }",
    );
    await writeFile(
      join(project, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "observer-hardening",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        assetPaths: [],
        outDir: "out",
        optimization: "none",
        boundsCheck: false,
        divisionZeroCheck: false,
      }),
    );
    await inspect(project);
  } finally {
    vi.restoreAllMocks();
    await rm(project, { recursive: true, force: true });
  }
}

/** Keep all malformed inputs local to one real successful fixture generation. */
type Fault =
  | "rom"
  | "mmio"
  | "piece-width-type"
  | "library-digest"
  | "extra-source"
  | "missing-library";

/** Rehashing removes stale-container rejection as an alternative explanation. */
async function corrupt(built: BuildSuccess, fault: Fault): Promise<BuildSuccess> {
  const directory = built.generation.directory;
  const buildPath = join(directory, ".build.json");
  const debugPath = join(directory, ".debug.json");
  const buildBytes = await readFile(buildPath);
  expect(hash(buildBytes)).toBe(built.generation.buildJsonSha256);
  const buildValue: unknown = JSON.parse(buildBytes.toString("utf8"));
  const build = record(buildValue);
  const entry = records(build.artifacts).find((item) => item.kind === "debug");
  expect(entry?.path).toBe(".debug.json");
  if (entry === undefined) throw new Error("Missing fixture debug digest");
  const debugBytes = await readFile(debugPath);
  expect(hash(debugBytes)).toBe(entry.sha256);
  const debugValue: unknown = JSON.parse(debugBytes.toString("utf8"));
  const debug = record(debugValue);
  if (fault === "rom" || fault === "mmio" || fault === "piece-width-type") {
    const sourceIndex = records(debug.sources).findIndex((item) => item.path === "src/game.blend");
    const symbol = records(debug.symbols).find((item) => {
      if (item.kind !== "global" || item.type !== "word[6]") return false;
      const origin = record(item.origin);
      if (origin.kind !== "source") return false;
      const span = record(origin.span);
      return span.sourceIndex === sourceIndex && span.startByte === GAME.indexOf("let scores");
    });
    if (symbol === undefined || !Array.isArray(symbol.locationIndexes))
      throw new Error("Missing fixture global");
    const index: unknown = symbol.locationIndexes[0];
    if (typeof index !== "number") throw new TypeError("Invalid fixture location index");
    const location = records(debug.locations)[index];
    if (location === undefined) throw new Error("Missing fixture location");
    const pieces = records(record(location.availability).pieces);
    expect(pieces).toHaveLength(1);
    const piece = pieces[0]!;
    expect(piece.kind).toBe("memory");
    expect(piece.byteLength).toBe(12);
    const machine = record(piece.machine);
    if (fault === "piece-width-type") {
      piece.byteLength = "12";
    } else {
      const start = fault === "rom" ? 0xe000 : 0xd000;
      machine.start = start;
      machine.end = start + 12;
    }
  } else {
    const sources = records(record(build.semanticInputs).sources);
    const debugSources = records(debug.sources);
    const library = "@blend65/stdlib/c64/input.blend";
    const left = sources.find((item) => item.path === library);
    const right = debugSources.find((item) => item.path === library);
    if (left === undefined || right === undefined)
      throw new Error("Missing fixture installed source");
    if (fault === "library-digest") {
      left.sha256 = "0".repeat(64);
      right.sha256 = left.sha256;
    } else if (fault === "missing-library") {
      record(build.semanticInputs).sources = sources.filter((item) => item !== left);
      debug.sources = debugSources.filter((item) => item !== right);
    } else {
      sources.push({ path: "src/unexpected.blend", bytes: 1, sha256: "0".repeat(64) });
      debugSources.push({ path: "src/unexpected.blend", byteLength: 1, sha256: "0".repeat(64) });
      record(build.semanticInputs).sources = sources;
      debug.sources = debugSources;
    }
  }
  const encodedDebug = JSON.stringify(debug) + "\n";
  entry.bytes = Buffer.byteLength(encodedDebug);
  entry.sha256 = hash(encodedDebug);
  await writeFile(debugPath, encodedDebug);
  const encodedBuild = JSON.stringify(build) + "\n";
  await writeFile(buildPath, encodedBuild);
  return { ...built, generation: { ...built.generation, buildJsonSha256: hash(encodedBuild) } };
}

describe.sequential("fixed observer hardening", () => {
  it.each(["relative-project", "unsupported-layout"])(
    "should reject an invalid invocation before runtime when input is %s",
    async (input) => {
      const start = vi
        .spyOn(runtime, "startVice")
        .mockRejectedValue(new Error("Unexpected runtime launch"));
      try {
        const result: unknown =
          input === "relative-project"
            ? await observeExercise("relative-project", "score")
            : await Reflect.apply(observeExercise, undefined, [
                "/tmp/opencode/unused-project",
                "unsupported",
              ]);
        expect(record(result).kind).toBe("unknown");
        expect(start).not.toHaveBeenCalled();
      } finally {
        start.mockRestore();
      }
    },
  );

  it("should reject an owned source symlink without starting a runtime", async () => {
    await withProject(async (project) => {
      await rename(join(project, "src/game.blend"), join(project, "src/notes.txt"));
      await symlink("notes.txt", join(project, "src/game.blend"));
      const start = vi
        .spyOn(runtime, "startVice")
        .mockRejectedValue(new Error("Unexpected runtime launch"));
      const result = await observeExercise(project, "score");
      expect(result.kind).toBe("unknown");
      expect(start).not.toHaveBeenCalled();
    });
  }, 120_000);

  it.each([
    "rom",
    "mmio",
    "piece-width-type",
    "library-digest",
    "extra-source",
    "missing-library",
  ] as const)(
    "should reject rehashed evidence before runtime when its fault is %s",
    async (fault) => {
      await withProject(async (project) => {
        const realBuild = compiler.buildProject;
        let changed = false;
        vi.spyOn(compiler, "buildProject").mockImplementation(async (...args) => {
          const result = await realBuild(...args);
          if (result.kind !== "success") throw new Error("Hardening fixture did not build");
          const altered = await corrupt(result, fault);
          changed = true;
          return altered;
        });
        const start = vi
          .spyOn(runtime, "startVice")
          .mockRejectedValue(new Error("Unexpected runtime launch"));
        const result = await observeExercise(project, "score");
        expect(changed, "Mutation must actually finish").toBe(true);
        expect(result.kind).toBe("unknown");
        if (result.kind === "unknown")
          expect(result.reason).toContain(
            fault === "rom" || fault === "mmio"
              ? "resident RAM"
              : fault === "piece-width-type"
                ? "integer"
                : "source",
          );
        expect(start).not.toHaveBeenCalled();
      });
    },
    120_000,
  );

  it.each([
    [0x2e, 0x36],
    [0x2f, 0x37],
  ])(
    "should reject a bad port response before result reads when DDR/port are %j/%j",
    async (ddr, port) => {
      await withProject(async (project) => {
        const realStart = runtime.startVice;
        let injected = false;
        let resultReads = 0;
        vi.spyOn(runtime, "startVice").mockImplementation(async (...args) => {
          const started = await realStart(...args);
          if ("kind" in started) return started;
          // Alter only the external response; checkpoint execution and cleanup remain real.
          return {
            ...started,
            monitor: {
              ...started.monitor,
              readMemory: async (start: number, end: number): Promise<Uint8Array> => {
                if (start === 0 && end === 1) {
                  injected = true;
                  return Uint8Array.of(ddr, port);
                }
                resultReads += 1;
                return started.monitor.readMemory(start, end);
              },
            },
          };
        });
        const result = await observeExercise(project, "score");
        expect(injected, "A real runtime must reach the port read").toBe(true);
        expect(resultReads).toBe(0);
        expect(result.kind).toBe("unknown");
        if (result.kind === "unknown") expect(result.reason).toContain("CPU-visible");
      });
    },
    120_000,
  );

  it("should propagate cleanup failure rather than returning observed success", async () => {
    await withProject(async (project) => {
      const realStop = runtime.stopVice;
      let stopped = false;
      vi.spyOn(runtime, "stopVice").mockImplementation(async (owned) => {
        await realStop(owned);
        stopped = true;
        throw new Error("Owned cleanup confirmation fixture failure");
      });
      await expect(observeExercise(project, "score")).rejects.toThrow(
        "Owned cleanup confirmation fixture failure",
      );
      expect(stopped).toBe(true);
    });
  }, 120_000);
});

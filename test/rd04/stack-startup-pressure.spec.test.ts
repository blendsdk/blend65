import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { readProfileArtifacts } from "../rd05/profile-fixture.js";
import {
  libraryEntry,
  libraryGlobalAddress,
  libraryStartup,
  withLibraryVice,
} from "../rd05/source-library-fixture.js";

/** A successful public build exposes the selected generation and diagnostics. */
type SuccessfulBuild = Extract<Awaited<ReturnType<typeof buildProject>>, { kind: "success" }>;

/** Narrow decoded reports before reading their public fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Read an actual generated report, rejecting a malformed top-level value. */
async function readReport(path: string): Promise<Record<string, unknown>> {
  const value: unknown = JSON.parse(await readFile(path, "utf8"));
  if (!isRecord(value)) {
    throw new Error("The generated report must be a JSON object.");
  }
  return value;
}

/**
 * Keep each real project isolated and remove only its owned directory, including
 * when building or inspecting an artifact fails.
 */
async function withBuiltProject(
  source: string,
  inspect: (result: SuccessfulBuild) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(
    join(process.env.CODEOPS_TMPDIR ?? tmpdir(), "blend65-stack-startup-pressure-"),
  );
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src", "game.blend"), source);
    const project = join(root, "blend65.json");
    await writeFile(
      project,
      JSON.stringify({
        schemaVersion: 1,
        name: "stack-startup-pressure",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
      }),
    );
    const result = await buildProject({ project, optimization: "none" });
    expect(result.kind, JSON.stringify(result.diagnostics)).toBe("success");
    if (result.kind !== "success") {
      throw new Error("The lawful source must produce a successful build.");
    }
    expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
    await inspect(result);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/**
 * Nest all pushes before the matching pulls so the source really reaches the
 * requested depth. A contained runtime index keeps the uninitialized resident
 * buffer reachable.
 */
function program(depth: number, includeData = false): string {
  return [
    "module Game;",
    ...(includeData ? ["let DATA: byte[50690];", "let answer: byte;"] : []),
    "function main(): void {",
    ...Array.from({ length: depth }, () => "  asm_php();"),
    ...Array.from({ length: depth }, () => "  asm_plp();"),
    ...(includeData ? ["  answer = DATA[peek($C110) & $7F];"] : []),
    "}",
  ].join("\n");
}

/** Check the actual bounded program-and-interrupt domain, not an unrelated row. */
async function expectBoundedStack(
  directory: string,
  peakBytes: number,
  headroomBytes: number,
): Promise<void> {
  const memory = await readReport(join(directory, ".memory.json"));
  const domains = memory.stackDomains;
  expect(Array.isArray(domains)).toBe(true);
  if (!Array.isArray(domains)) {
    throw new Error("The memory report must contain stack domains.");
  }
  const bounded = domains.filter(isRecord).filter(({ id }) => id === "bounded-component-capacity");
  expect(bounded).toHaveLength(1);
  expect(bounded[0]).toMatchObject({
    id: "bounded-component-capacity",
    peakBytes,
    capacityBytes: 236,
    headroomBytes,
  });
}

/** Require one truthful warning, including startup pushes in the selected peak. */
function expectStackWarning(result: SuccessfulBuild, peak: number, pushes: number): void {
  const warnings = result.diagnostics.filter(({ code }) => code === "W10180");
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toMatchObject({
    severity: "warning",
    message:
      `Maximum simultaneous hardware-stack use is ${peak} bytes on ` +
      "'c64-pal-prg-kernal-6581'; usable capacity is 236 " +
      `(calls 0, interrupt entries 0, explicit pushes ${pushes})`,
  });
}

describe("startup selection under hardware-stack and resident-memory pressure", () => {
  it("allows all 236 usable stack bytes when main needs the full capacity", async () => {
    // Startup must not hold a byte through main when that would reject legal use.
    await withBuiltProject(program(236), async (result) => {
      expectStackWarning(result, 236, 236);
      await expectBoundedStack(result.generation.directory, 236, 0);
    });
  }, 120_000);

  it("retains compact startup when the larger alternative cannot fit resident memory", async () => {
    // The resident buffer leaves room for compact startup, not its larger peer.
    // Its held status byte still counts towards the reported stack peak.
    await withBuiltProject(program(187, true), async (result) => {
      expectStackWarning(result, 188, 188);
      await expectBoundedStack(result.generation.directory, 188, 48);

      const costs = await readReport(join(result.generation.directory, ".costs.json"));
      const totals = costs.totals;
      if (!isRecord(totals)) {
        throw new Error("The costs report must contain totals.");
      }
      const programBytes = totals.programBytes;
      expect(typeof programBytes).toBe("number");
      if (typeof programBytes !== "number") {
        throw new Error("The charged program size must be numeric.");
      }
      expect(Number.isInteger(programBytes)).toBe(true);
      expect(programBytes).toBeGreaterThanOrEqual(0);

      const prg = await readFile(
        join(result.generation.directory, result.generation.primaryArtifact),
      );
      expect(prg.length).toBeGreaterThanOrEqual(2);
      const payloadBytes = prg.length - 2;
      expect(payloadBytes).toBe(programBytes);
      expect(payloadBytes).toBeLessThanOrEqual(51_199);
    });
  }, 120_000);

  it("keeps compact startup for an ordinary empty main", async () => {
    // One held status byte and one transient copy give a peak of two bytes.
    await withBuiltProject(program(0), async (result) => {
      await expectBoundedStack(result.generation.directory, 2, 234);
      expect(result.diagnostics.filter(({ code }) => code === "W10180")).toEqual([]);
    });
  }, 120_000);

  it("preserves constant and callable initializers with pressure-selected full startup", async () => {
    // Initializer calls finish before main. Their return addresses do not add to
    // main's peak, and selecting startup must preserve both initializer values.
    const source = [
      "module Game;",
      "let initial: byte = 7;",
      "function initialize(): byte { return peek($C110); }",
      "let dynamic: byte = initialize();",
      "let answer: byte;",
      "function main(): void {",
      "  asm_sei();",
      ...Array.from({ length: 187 }, () => "  asm_php();"),
      ...Array.from({ length: 187 }, () => "  asm_plp();"),
      "  answer = initial + dynamic;",
      "}",
    ].join("\n");
    await withBuiltProject(source, async (result) => {
      await expectBoundedStack(result.generation.directory, 187, 49);
      const artifacts = await readProfileArtifacts(result);
      await withLibraryVice(
        result,
        artifacts,
        "c64-pal-prg-kernal-6581",
        async (monitor, stopAt) => {
          await monitor.writeMemory(0xc110, Uint8Array.of(9));
          await stopAt(libraryEntry(artifacts, "src/game.blend::Game.main"));
          const mainSP = (await monitor.readCpuRegisters()).sp;
          await stopAt(libraryStartup(artifacts, "startup.restore"));
          expect((await monitor.readCpuRegisters()).sp).toBe(mainSP);
          for (const [declaration, value] of [
            ["let initial: byte = 7;", 7],
            ["let dynamic: byte = initialize();", 9],
            ["let answer: byte;", 16],
          ] as const) {
            const address = libraryGlobalAddress(
              artifacts,
              source,
              declaration,
              1,
              "src/game.blend",
            );
            expect([...(await monitor.readMemory(address, address))]).toEqual([value]);
          }
        },
      );
    });
  }, 120_000);
});

import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import type { ProjectDiagnostic } from "@blend65/compiler";
import { withProject } from "../rd06/project-fixture.js";

interface MemoryEvidence {
  readonly runtimeMemorySafety: string;
  readonly unboundedEffects: readonly unknown[];
  readonly residencies: { kind: string; id: string; group?: string }[];
  readonly intervals: {
    id: string;
    kind: string;
    addressSpaceId: string;
    start: number;
    end: number;
    size: number;
    residencyIds: string[];
    payloadBytes: number;
    paddingBytes: number;
    reservedBytes: number;
    owner: { kind: string; id: string };
    vic?: { visibility: readonly string[] };
  }[];
  readonly views: {
    id: string;
    capacityBytes: number;
    occupiedBytes: number;
    freeBytes: number;
    activeResidencyIds: string[];
    freeIntervals: { start: number; end: number; size: number }[];
  }[];
  readonly loadStates: { unitId: string; destinationIntervalIds: string[] }[];
}

interface CostsEvidence {
  readonly entries: {
    kind: string;
    component: string;
    accounting: string;
    bytes: number;
  }[];
}

interface BuildEvidence {
  readonly package: { components: { id: string; blocks: number }[] };
}

/** Build one D64 source and return the published sidecars. */
async function inspect<T>(
  source: string,
  inspect: (input: {
    readonly memory: MemoryEvidence;
    readonly costs: CostsEvidence;
    readonly build: BuildEvidence;
  }) => T,
  assets: readonly { path: string; bytes: Uint8Array }[] = [],
): Promise<T> {
  return withProject(
    source,
    assets,
    async (project) => {
      const built = await buildProject({ project });
      if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
      return inspect({
        memory: JSON.parse(
          await readFile(join(built.generation.directory, ".memory.json"), "utf8"),
        ) as MemoryEvidence,
        costs: JSON.parse(
          await readFile(join(built.generation.directory, ".costs.json"), "utf8"),
        ) as CostsEvidence,
        build: JSON.parse(
          await readFile(join(built.generation.directory, ".build.json"), "utf8"),
        ) as BuildEvidence,
      });
    },
    "c64-pal-d64-kernal-6581",
  );
}

/** Build one conflicting explicit placement and return its diagnostics. */
async function conflict(at: string): Promise<readonly ProjectDiagnostic[]> {
  return withProject(
    [
      "module Game;",
      "",
      "loadable const DATA: byte[4] = [1, 2, 3, 4];",
      `place(at: ${at}) let dest: byte[4];`,
      "function main(): void { if (c64.loader.load(DATA, dest)) { let x: byte = dest[0]; } }",
      "",
    ].join("\n"),
    [],
    async (project) => {
      const built = await buildProject({ project });
      return built.kind === "failure" ? built.diagnostics : [];
    },
    "c64-pal-d64-kernal-6581",
  );
}

describe("load layout and memory", () => {
  // ST-69: two units sequentially share one destination; one interval, exclusive states.
  it("should model sequential reuse with one interval and exclusive states", async () => {
    await inspect(
      [
        "module Game;",
        "",
        "loadable const A: byte[4] = [1, 2, 3, 4];",
        "loadable const B: byte[4] = [5, 6, 7, 8];",
        "let target: byte[4];",
        "function main(): void {",
        "  if (c64.loader.load(A, target)) { let x: byte = target[0]; }",
        "  if (c64.loader.load(B, target)) { let y: byte = target[0]; }",
        "}",
        "",
      ].join("\n"),
      ({ memory }) => {
        const destinations = memory.intervals.filter(
          ({ kind, addressSpaceId }) => kind === "loadDestination" && addressSpaceId === "cpu16",
        );
        expect(destinations).toHaveLength(1);
        const group = destinations[0]!.residencyIds.find((id) => id.includes(":unloaded"))!;
        const groupId = group.slice(0, group.lastIndexOf(":unloaded"));
        const unitMembers = destinations[0]!.residencyIds.filter((id) => id.includes(":unit:"));
        expect(unitMembers).toHaveLength(2);
        expect(memory.residencies.filter(({ group: owner }) => owner === groupId)).toHaveLength(3);
        expect(memory.loadStates).toHaveLength(2);
        expect(
          new Set(memory.loadStates.map(({ destinationIntervalIds }) => destinationIntervalIds[0])),
        ).toEqual(new Set([destinations[0]!.id]));
        const stateViews = memory.views.filter(({ id }) => id.startsWith("cpu16-load-"));
        expect(stateViews).toHaveLength(3);
        for (const view of stateViews) {
          expect(view.occupiedBytes + view.freeBytes).toBe(view.capacityBytes);
        }
      },
    );
  });

  // ST-70: one unit into two destinations keeps one disk entry and two candidates.
  it("should load one unit into two destinations with one disk entry", async () => {
    await inspect(
      [
        "module Game;",
        "",
        "loadable const DATA: byte[4] = [1, 2, 3, 4];",
        "let first: byte[4];",
        "let second: byte[4];",
        "function main(): void {",
        "  if (c64.loader.load(DATA, first)) { let x: byte = first[0]; }",
        "  if (c64.loader.load(DATA, second)) { let y: byte = second[0]; }",
        "}",
        "",
      ].join("\n"),
      ({ memory, build }) => {
        const destinations = memory.intervals.filter(
          ({ kind, addressSpaceId }) => kind === "loadDestination" && addressSpaceId === "cpu16",
        );
        expect(destinations).toHaveLength(2);
        expect(memory.loadStates).toHaveLength(2);
        expect(memory.loadStates[0]!.unitId).toBe(memory.loadStates[1]!.unitId);
        expect(build.package.components).toHaveLength(2);
        expect(build.package.components[1]!.blocks).toBe(1);
      },
    );
  });

  // ST-74: unit bytes are disk-only; only the loader name/scratch are resident.
  it("should keep disk unit bytes out of resident memory", async () => {
    await inspect(
      [
        "module Game;",
        "",
        "loadable const DATA: byte[4] = [1, 2, 3, 4];",
        "let target: byte[4];",
        "function main(): void { if (c64.loader.load(DATA, target)) { let x: byte = target[0]; } }",
        "",
      ].join("\n"),
      ({ memory, costs }) => {
        const unitOwned = memory.intervals.filter(({ owner }) => owner.kind === "loadUnit");
        expect(unitOwned.every(({ kind }) => kind === "loader" || kind === "scratch")).toBe(true);
        expect(unitOwned.some(({ payloadBytes }) => payloadBytes === 4)).toBe(false);
        const disk = costs.entries.filter(
          ({ kind, accounting }) => kind === "bytes" && accounting === "diskFile",
        );
        expect(disk.reduce((total, { bytes }) => total + bytes, 0)).toBe(4);
      },
    );
  });

  // ST-73/ST-75: every view tiles exactly and the safety flag agrees with unbounded effects.
  it("should reconcile views and the runtime safety flag", async () => {
    await inspect(
      [
        "module Game;",
        "",
        "loadable const DATA: byte[4] = [1, 2, 3, 4];",
        "let target: byte[4];",
        "function main(): void { if (c64.loader.load(DATA, target)) { let x: byte = target[0]; } }",
        "",
      ].join("\n"),
      ({ memory }) => {
        for (const view of memory.views) {
          expect(view.occupiedBytes + view.freeBytes).toBe(view.capacityBytes);
          const freeBytes = view.freeIntervals.reduce((total, { size }) => total + size, 0);
          expect(freeBytes).toBe(view.freeBytes);
          expect(view.freeIntervals.every(({ start, end }) => start < end)).toBe(true);
        }
        expect(memory.runtimeMemorySafety === "unproven").toBe(memory.unboundedEffects.length > 0);
      },
    );
  });

  // ST-66/ST-68: code, stack, MMIO and KERNAL-ROM conflicts fail before publication.
  it.each(["$0801", "$0100", "$d020", "$e000"])(
    "should reject the conflicting destination at %s",
    async (at) => {
      const diagnostics = await conflict(at);
      expect(diagnostics.map(({ code }) => code)).toEqual(["E10273"]);
      expect(diagnostics[0]?.message).toMatch(/placement constraints conflict/u);
    },
  );

  // ST-71: a constrained charset destination appears in the CPU and VIC views.
  it("should map a VIC-visible destination into the VIC view", async () => {
    const ctm = readFileSync(
      join(process.cwd(), "test/rd06/fixtures/public/charpad/synthetic-basic.ctm"),
    );
    await withProject(
      [
        "module Game;",
        "",
        'loadable const CHARSET: byte[16] = embed("level.ctm", "charset");',
        "let dest: byte[16];",
        "function main(): void { if (c64.loader.load(CHARSET, dest)) { let x: byte = dest[0]; } }",
        "",
      ].join("\n"),
      [{ path: "level.ctm", bytes: ctm }],
      async (project) => {
        const built = await buildProject({ project });
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        const memory = JSON.parse(
          await readFile(join(built.generation.directory, ".memory.json"), "utf8"),
        ) as MemoryEvidence;
        const destination = memory.intervals.find(
          ({ kind, addressSpaceId }) => kind === "loadDestination" && addressSpaceId === "cpu16",
        )!;
        expect(destination.vic?.visibility).toContain("vic");
        const projection = memory.intervals.find(
          ({ id, addressSpaceId }) =>
            id.startsWith("vic.") &&
            addressSpaceId === "cpu16-vic" &&
            memory.intervals.some(
              ({ id: sourceId, start, end }) =>
                start === destination.start && end === destination.end && id === `vic.${sourceId}`,
            ),
        );
        expect(projection).toBeDefined();
        const vicView = memory.views.find(({ id }) => id === "vic-bank-0")!;
        expect(destination.start).toBeLessThan(vicView.capacityBytes);
      },
      "c64-pal-d64-kernal-6581",
    );
  });
});

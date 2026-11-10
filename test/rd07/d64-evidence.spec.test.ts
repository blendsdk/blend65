import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { withProject } from "../rd06/project-fixture.js";

const SOURCE = [
  "module Game;",
  "",
  "loadable const DATA: byte[4] = [1, 2, 3, 4];",
  "let target: byte[4];",
  "function main(): void { if (c64.loader.load(DATA, target)) { let x: byte = target[0]; } }",
  "",
].join("\n");

interface MemoryEvidence {
  readonly residencies: { kind: string; id: string; group?: string }[];
  readonly intervals: {
    id: string;
    kind: string;
    addressSpaceId: string;
    owner: { kind: string; id: string };
    residencyIds: string[];
    loadUnitId?: string;
    payloadBytes: number;
    paddingBytes: number;
    reservedBytes: number;
    size: number;
  }[];
  readonly views: {
    id: string;
    activeResidencyIds: string[];
    occupiedBytes: number;
    freeBytes: number;
    capacityBytes: number;
  }[];
  readonly entries: {
    kind: string;
    id: string;
    component: string;
    accounting: string;
    bytes: number;
  }[];
  readonly totals: { programBytes: number };
  readonly loadStates: {
    callSite: { path: string; startByte: number; endByte: number };
    unitId: string;
    destinationIntervalIds: string[];
    quiescence: { routes: string[]; status: string };
    publicationPoint: { callSite: unknown; resultEdge: string };
  }[];
}

describe("D64 load evidence", () => {
  // The memory report names the call site, unit, destination, quiescence and publication point.
  it("should publish one load state record", async () => {
    await withProject(
      SOURCE,
      [],
      async (project) => {
        const built = await buildProject({ project });
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        const memory = JSON.parse(
          await readFile(join(built.generation.directory, ".memory.json"), "utf8"),
        ) as MemoryEvidence;
        expect(memory.loadStates).toHaveLength(1);
        const state = memory.loadStates[0]!;
        expect(state.callSite.path).toBe("src/game.blend");
        expect(state.callSite.endByte).toBeGreaterThan(state.callSite.startByte);
        expect(state.unitId).toMatch(/^[0-9a-f]{64}$/u);
        expect(state.destinationIntervalIds.length).toBeGreaterThan(0);
        expect(state.quiescence).toEqual({ routes: [], status: "proved" });
        expect(state.publicationPoint.resultEdge).toBe("true");
        const build = JSON.parse(
          await readFile(join(built.generation.directory, ".build.json"), "utf8"),
        ) as { package: { components: { id: string }[] } };
        expect(build.package.components.map(({ id }) => id)).toContain(state.unitId);
      },
      "c64-pal-d64-kernal-6581",
    );
  });

  // The loader name bytes are one read-only loader interval owned by the unit.
  it("should publish the loader name data without a RAM copy", async () => {
    await withProject(
      SOURCE,
      [],
      async (project) => {
        const built = await buildProject({ project });
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        const memory = JSON.parse(
          await readFile(join(built.generation.directory, ".memory.json"), "utf8"),
        ) as MemoryEvidence;
        const loader = memory.intervals.filter(
          ({ kind, addressSpaceId }) => kind === "loader" && addressSpaceId === "cpu16",
        );
        expect(loader).toHaveLength(1);
        expect(loader[0]).toMatchObject({
          owner: { kind: "loadUnit" },
          payloadBytes: 13,
        });
        expect(loader[0]!.loadUnitId).toMatch(/^[0-9a-f]{64}$/u);
      },
      "c64-pal-d64-kernal-6581",
    );
  });

  // The destination is one physical interval with mutually exclusive load states.
  it("should publish exclusive load-state residencies and views", async () => {
    await withProject(
      SOURCE,
      [],
      async (project) => {
        const built = await buildProject({ project });
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        const memory = JSON.parse(
          await readFile(join(built.generation.directory, ".memory.json"), "utf8"),
        ) as MemoryEvidence;
        const destination = memory.intervals.filter(
          ({ kind, addressSpaceId }) => kind === "loadDestination" && addressSpaceId === "cpu16",
        );
        expect(destination.length).toBeGreaterThan(0);
        const group = destination[0]!.residencyIds.find((id) => id.includes(":unloaded"))!;
        expect(group).toMatch(/:unloaded$/u);
        const groupId = group.slice(0, group.lastIndexOf(":unloaded"));
        expect(destination[0]!.residencyIds).toContain("resident");
        expect(destination[0]!.residencyIds.some((id) => id.includes(":unit:"))).toBe(true);
        const members = memory.residencies.filter(({ group: owner }) => owner === groupId);
        expect(members).toHaveLength(2);
        expect(members.every(({ kind }) => kind === "exclusive")).toBe(true);
        const stateViews = memory.views.filter(({ id }) => id.startsWith("cpu16-load-"));
        expect(stateViews).toHaveLength(2);
        for (const view of stateViews) {
          expect(view.occupiedBytes + view.freeBytes).toBe(view.capacityBytes);
          expect(view.activeResidencyIds).toContain("resident");
        }
      },
      "c64-pal-d64-kernal-6581",
    );
  });

  // Loader setup and call-site handling are separate byte components, each counted once.
  it("should split loader and call-site cost without double counting", async () => {
    await withProject(
      SOURCE,
      [],
      async (project) => {
        const built = await buildProject({ project });
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        const costs = JSON.parse(
          await readFile(join(built.generation.directory, ".costs.json"), "utf8"),
        ) as {
          entries: { kind: string; component: string; accounting: string; bytes: number }[];
          totals: { programBytes: number };
        };
        const loader = costs.entries.filter(
          ({ kind, component }) => kind === "bytes" && component === "loader",
        );
        const callSite = costs.entries.filter(
          ({ kind, component }) => kind === "bytes" && component === "callSite",
        );
        expect(loader).toHaveLength(1);
        expect(callSite).toHaveLength(1);
        expect(loader[0]!.bytes).toBeGreaterThan(0);
        expect(callSite[0]!.bytes).toBeGreaterThan(0);
        const program = costs.entries
          .filter(({ kind, accounting }) => kind === "bytes" && accounting === "program")
          .reduce((total, { bytes }) => total + bytes, 0);
        expect(program).toBe(costs.totals.programBytes);
      },
      "c64-pal-d64-kernal-6581",
    );
  });

  // An embedded unit publishes a disk-only asset record whose destinations are mutable ranges.
  it("should publish a loadable asset placement", async () => {
    const bytes = Uint8Array.from({ length: 8 }, (_, index) => index + 1);
    await withProject(
      [
        "module Game;",
        "",
        'loadable const TABLE: byte[8] = embed("table.bin");',
        "let target: byte[8];",
        "function main(): void { if (c64.loader.load(TABLE, target)) { let x: byte = target[0]; } }",
        "",
      ].join("\n"),
      [{ path: "table.bin", bytes }],
      async (project) => {
        const built = await buildProject({ project });
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        const assets = JSON.parse(
          await readFile(join(built.generation.directory, ".assets.json"), "utf8"),
        ) as {
          assets: {
            placement: {
              kind: string;
              loadUnitId?: string;
              artifactPath?: string;
              destinations?: { addressSpaceId: string; start: number; end: number }[];
            };
            payloadBytes: number;
            emittedBytes: number;
          }[];
        };
        const loadable = assets.assets.filter(({ placement }) => placement.kind === "loadable");
        expect(loadable).toHaveLength(1);
        expect(loadable[0]!.payloadBytes).toBe(8);
        expect(loadable[0]!.emittedBytes).toBe(8);
        expect(loadable[0]!.placement.artifactPath).toBe(built.generation.primaryArtifact);
        expect(loadable[0]!.placement.loadUnitId).toMatch(/^[0-9a-f]{64}$/u);
        const [destination] = loadable[0]!.placement.destinations!;
        expect(destination!.addressSpaceId).toBe("cpu16");
        expect(destination!.end - destination!.start).toBe(8);
      },
      "c64-pal-d64-kernal-6581",
    );
  });
});

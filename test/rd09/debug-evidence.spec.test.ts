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

/** Narrow one untrusted JSON record. */
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Expected an evidence record");
  }
  return value as Record<string, unknown>;
}

describe("debug load-unit identity", () => {
  it("should publish helper-owned temporaries with certified homes", async () => {
    const observed = await withProject(
      [
        "module Game;",
        "",
        "let a: byte = 5;",
        "let b: byte = 2;",
        "function main(): void { a = a * b; b = a / b; }",
        "",
      ].join("\n"),
      [],
      async (project) => {
        const built = await buildProject({ project });
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        return JSON.parse(
          await readFile(join(built.generation.directory, ".debug.json"), "utf8"),
        ) as Record<string, unknown>;
      },
    );
    const symbols = (observed.symbols as Record<string, unknown>[]).map(record);
    const helper = symbols.find(
      ({ kind, qualifiedName }) =>
        kind === "temporary" && String(qualifiedName).includes(":divide:"),
    );
    expect(helper).toBeDefined();
    expect(record(helper!.origin).kind).toBe("source");
    const locations = (observed.locations as Record<string, unknown>[]).map(record);
    const location = locations.find(({ symbolIndex }) => symbolIndex === symbols.indexOf(helper!));
    expect(location).toBeDefined();
    expect(record(location!.availability).kind).toBe("available");
  }, 30_000);

  it("should record the exact load destination as residence without inventing a bank", async () => {
    const observed = await withProject(
      SOURCE,
      [],
      async (project) => {
        const built = await buildProject({ project });
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        const debug = record(
          JSON.parse(await readFile(join(built.generation.directory, ".debug.json"), "utf8")),
        );
        const memory = record(
          JSON.parse(await readFile(join(built.generation.directory, ".memory.json"), "utf8")),
        );
        return { debug, memory };
      },
      "c64-pal-d64-kernal-6581",
    );
    const loadUnits = (observed.debug.loadUnits as Record<string, unknown>[]).map(record);
    const loadable = loadUnits.find(({ kind }) => kind === "loadable");
    const boot = loadUnits.find(({ kind }) => kind === "resident");
    expect(loadable).toBeDefined();
    expect(boot).toBeDefined();
    expect(loadable!.residence).toHaveLength(1);
    expect(boot!.residence).toEqual([]);
    const residence = record((loadable!.residence as unknown[])[0]);
    expect(residence.addressSpaceIndex).toBe(0);
    expect(residence.bankIndex).toBeUndefined();
    expect(residence.loadUnitIndex).toBe(loadUnits.indexOf(loadable!));

    const states = (observed.memory.loadStates as Record<string, unknown>[]).map(record);
    const state = states.find(({ unitId }) => unitId === loadable!.name);
    expect(state).toBeDefined();
    const intervals = (observed.memory.intervals as Record<string, unknown>[]).map(record);
    const destinationIds = state!.destinationIntervalIds as string[];
    expect(destinationIds).toHaveLength(1);
    const destination = intervals.find(({ id }) => String(id) === destinationIds[0]);
    expect(destination).toBeDefined();
    expect(residence.start).toBe(destination!.start);
    expect(residence.end).toBe(destination!.end);
  }, 30_000);
});

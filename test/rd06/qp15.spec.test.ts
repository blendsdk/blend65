import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { qualificationProject } from "./qualification-fixture.js";

const qualification = join(process.cwd(), "test/rd06/qualification/q-p15");

/** Narrow one untrusted evidence record. */
function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

/** Read one sidecar as untrusted JSON. */
async function sidecar(directory: string, name: string): Promise<Record<string, unknown>> {
  return record(JSON.parse(await readFile(join(directory, name), "utf8")), name);
}

/** Read the built program image. */
async function image(directory: string, name: string): Promise<Buffer> {
  return readFile(join(directory, name));
}

describe("Q-P15 compile-time integrator workload", () => {
  // Build the frozen workload once and verify every derived artifact byte.
  it("should derive the exact masks, priority, composition and conflict count", async () => {
    const expected = await sidecar(qualification, "expected.json");
    const copy = await qualificationProject("q-p15");
    let built: Awaited<ReturnType<typeof buildProject>>;
    try {
      built = await buildProject({ project: copy.project });
    } catch (error) {
      await copy.cleanup();
      throw error;
    }
    expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
      "success",
    );
    if (built.kind !== "success") throw new Error("Expected the Q-P15 build");
    const directory = built.generation.directory;
    const debug = await sidecar(directory, ".debug.json");
    const symbols = debug.symbols as Record<string, unknown>[];
    const locations = debug.locations as Record<string, unknown>[];
    const globals = symbols.filter(
      (symbol) => symbol.kind === "global" && String(symbol.type).startsWith("byte["),
    );
    expect(globals).toHaveLength(4);
    const prg = await image(directory, built.generation.primaryArtifact);
    const load = prg.readUInt16LE(0);
    const bytesAt = (index: number): Buffer => {
      const location = record(locations[index], `location ${index}`);
      const availability = record(location.availability, `availability ${index}`);
      expect(availability.kind).toBe("available");
      const piece = record((availability.pieces as unknown[])[0], "piece");
      const machine = record(piece.machine, "machine");
      const start = Number(machine.start);
      const end = Number(machine.end);
      return prg.subarray(2 + start - load, 2 + end - load);
    };
    const expectedHex = (name: string): string => String(record(expected[name], name).hex);
    expect(bytesAt(3).toString("hex")).toBe(expectedHex("mask"));
    expect(bytesAt(4).toString("hex")).toBe(expectedHex("priority"));
    expect(bytesAt(5).toString("hex")).toBe(expectedHex("precomposed"));
    expect(bytesAt(6).toString("hex")).toBe(expectedHex("references"));
    for (const [index, name] of [
      [3, "mask"],
      [4, "priority"],
      [5, "precomposed"],
      [6, "references"],
    ] as const) {
      expect(createHash("sha256").update(bytesAt(index)).digest("hex")).toBe(
        String(record(expected[name], name).sha256),
      );
    }

    // The conflict count is a compile-time word; only its final bytes reach the target.
    const assembly = await readFile(join(directory, ".asm"), "utf8");
    expect(assembly).toMatch(/lda #\$3f\b/iu);
    expect(assembly).toMatch(/sta \$0702\b/iu);
    expect(assembly).toMatch(/sta \$0703\b/iu);
    await copy.cleanup();
  }, 60_000);

  // The transformation functions are not emitted, allocate no SFA home and add no helper.
  it("should emit no target routine or helper for the compile-time functions", async () => {
    const copy = await qualificationProject("q-p15");
    let built: Awaited<ReturnType<typeof buildProject>>;
    try {
      built = await buildProject({ project: copy.project });
    } catch (error) {
      await copy.cleanup();
      throw error;
    }
    if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
    const directory = built.generation.directory;
    const debug = await sidecar(directory, ".debug.json");
    const functions = (debug.functions as Record<string, unknown>[]).map(({ qualifiedName }) =>
      String(qualifiedName),
    );
    expect(functions).toEqual(["src/game.blend::Game.main", "src/game.blend::Game.render"]);
    const assembly = await readFile(join(directory, ".asm"), "utf8");
    for (const name of ["invertPanel", "panelPriority", "composePanels", "conflictCount"]) {
      expect(assembly).not.toContain(name);
    }
    const expected = await sidecar(qualification, "expected.json");
    const memory = await sidecar(directory, ".memory.json");
    const code = (memory.intervals as Record<string, unknown>[]).find(
      ({ kind, owner }) =>
        kind === "code" && record(owner, "owner").id === "src/game.blend::Game.render",
    );
    expect(record(code!, "render code").payloadBytes).toBe(Number(expected.renderBytes));
    const costs = await sidecar(directory, ".costs.json");
    const cycles = (costs.totals as Record<string, unknown>).pathCycles as Record<
      string,
      unknown
    >[];
    expect(cycles[0]?.cycles).toEqual({ kind: "unknown" });
    expect(String(expected.renderCycles)).toBe("Unknown");
    await copy.cleanup();
  }, 60_000);

  // The source owns both representations; the compiler does not collapse them or copy the image.
  it("should retain both selected representations without a duplicate image", async () => {
    const copy = await qualificationProject("q-p15");
    let built: Awaited<ReturnType<typeof buildProject>>;
    try {
      built = await buildProject({ project: copy.project });
    } catch (error) {
      await copy.cleanup();
      throw error;
    }
    if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
    const directory = built.generation.directory;
    const expected = await sidecar(qualification, "expected.json");
    const assets = await sidecar(directory, ".assets.json");
    const records = assets.assets as Record<string, unknown>[];
    expect(records).toHaveLength(3);
    expect(Number(expected.conflicts)).toBe(63);
    const bitmap = records.find(({ selector }) => selector === "bitmap")!;
    const prg = await image(directory, built.generation.primaryArtifact);
    const load = prg.readUInt16LE(0);
    const range = record(record(bitmap.placement, "placement").range, "range");
    const start = 2 + Number(range.start) - load;
    const bytes = prg.subarray(start, start + Number(bitmap.payloadBytes));
    expect(prg.indexOf(bytes, start + 1)).toBe(-1);
    await copy.cleanup();
  }, 60_000);
});

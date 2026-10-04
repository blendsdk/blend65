import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { validateCostsEvidence, validateMemoryEvidence } from "../artifacts/evidence.js";
import type { CostsEvidence, MemoryEvidence } from "../artifacts/evidence-types.js";
import { buildProject } from "./services.js";

/** The one retained-machine class groups independent unproved external obligations. */
const EXTERNAL_EFFECT_CLASS =
  "external-nmi-aggregate-stack+retained-nmi-firmware-completion+external-nmi-finite-deadline";

/** Inspect the exact published generation through the unchanged evidence validators. */
async function withEvidence(
  source: string,
  inspect: (memory: MemoryEvidence, costs: CostsEvidence) => void,
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "blend65-nmi-evidence-impl-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "src/game.blend"), source);
    await writeFile(
      join(root, "blend65.json"),
      JSON.stringify({
        schemaVersion: 1,
        name: "nmi-evidence",
        sourceRoot: "src",
        entry: "Game",
        target: "c64-pal-prg-kernal-6581",
        outDir: "out",
        optimization: "none",
      }),
    );
    const built = await buildProject({ project: join(root, "blend65.json") });
    if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
    const memory = validateMemoryEvidence(
      await readFile(join(built.generation.directory, ".memory.json")),
    );
    const costs = validateCostsEvidence(
      await readFile(join(built.generation.directory, ".costs.json")),
    );
    if (memory.kind !== "complete" || costs.kind !== "complete")
      throw new Error("Expected unchanged schema validators to accept published evidence");
    inspect(memory.value, costs.value);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

/** Keep all source status saves live until their balanced restores execute. */
function saves(depth: number): string {
  return `${"asm_php(); ".repeat(depth)}${"asm_plp(); ".repeat(depth)}`;
}

describe("cooperative stack evidence derivation", () => {
  it("should attribute one compound record to the complete UTF-8 exported main declaration", async () => {
    const main = "export function main(): void { poke($0400, 1); }";
    const prefix = "module Game;\n// café 🚀\nfunction before(): void {}\n";
    const source = `${prefix}${main}\nfunction after(): void {}`;
    await withEvidence(source, (memory) => {
      expect(memory.runtimeMemorySafety).toBe("unproven");
      expect(memory.unboundedEffects).toEqual([
        {
          kind: "machineState",
          site: {
            path: "src/game.blend",
            startByte: Buffer.byteLength(prefix),
            endByte: Buffer.byteLength(prefix + main),
          },
          effectClass: EXTERNAL_EFFECT_CLASS,
        },
      ]);
    });
  }, 60_000);

  it("should retain source-route order while separating reserve from nested-call use", async () => {
    const source = `module Game;
function helper(): void { ${saves(4)} }
function main(): void { ${"asm_php(); ".repeat(6)}helper(); ${"asm_plp(); ".repeat(6)} }`;
    await withEvidence(source, (memory, costs) => {
      expect(memory.stackDomains.map(({ id }) => id)).toEqual([
        "bounded-component-capacity",
        "interrupt-entry-save",
        "program",
      ]);
      const combined = memory.stackDomains[0]!;
      const program = memory.stackDomains[2]!;
      expect(combined).toMatchObject({ capacityBytes: 236, peakBytes: 12, headroomBytes: 224 });
      expect(combined.route).toEqual([
        "bounded-component:generated-program-and-irq",
        ...(Array.isArray(program.route) ? program.route : []),
      ]);
      expect(costs.totals.resources.find(({ id }) => id === "hardwareStack")).toEqual({
        kind: "standard",
        id: "hardwareStack",
        value: 12,
      });
    });
  }, 60_000);

  it("should give a bounded 236-byte component zero headroom without adding reserve", async () => {
    await withEvidence(`module Game; function main(): void { ${saves(236)} }`, (memory, costs) => {
      expect(memory.stackDomains[0]).toMatchObject({
        id: "bounded-component-capacity",
        capacityBytes: 236,
        peakBytes: 236,
        headroomBytes: 0,
      });
      expect(costs.totals.resources.find(({ id }) => id === "hardwareStack")?.value).toBe(236);
      expect(memory.runtimeMemorySafety).toBe("unproven");
    });
  }, 60_000);
});

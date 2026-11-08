import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject, checkProject } from "@blend65/compiler";
import { patternedBytes, withProject } from "./project-fixture.js";

const MAIN = "\nfunction main(): void {}\n";

/** Check one source and return its diagnostic codes. */
async function codes(source: string, assets = [] as const): Promise<readonly string[]> {
  return withProject(source, assets, async (project) => {
    const checked = await checkProject({ project });
    return checked.diagnostics.map(({ code }) => code);
  });
}

describe("compile-time asset refinement", () => {
  // A compile-time function reads embedded bytes and returns an exact transformed array.
  it("should transform an embedded array with no target transformation code", async () => {
    const bytes = Uint8Array.from([0, 1, 2, 254, 255, 16, 32, 64]);
    const source = `module Game;
const DATA: byte[] = embed("data.bin");
comptime function invert(): byte[8] {
  let result: byte[8] = [; 0];
  for (let index: byte = 0; index < 8; index += 1) {
    result[index] = DATA[index] ^ $ff;
  }
  return result;
}
const OUT: byte[8] = invert();
${MAIN}`;
    await withProject(source, [{ path: "data.bin", bytes }], async (project) => {
      const built = await buildProject({ project });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("Expected a compile-time build");
      const debug = JSON.parse(
        await readFile(join(built.generation.directory, ".debug.json"), "utf8"),
      ) as {
        symbols: { kind: string; type: string }[];
        locations: {
          availability: { kind: string; pieces: { machine: { start: number; end: number } }[] };
        }[];
      };
      const index = debug.symbols.findIndex(
        (symbol) => symbol.kind === "global" && symbol.type === "byte[8]",
      );
      expect(index).toBeGreaterThanOrEqual(0);
      const location = debug.locations[index]!;
      expect(location.availability.kind).toBe("available");
      const machine = location.availability.pieces[0]!.machine;
      const prg = await readFile(
        join(built.generation.directory, built.generation.primaryArtifact),
      );
      const load = prg.readUInt16LE(0);
      const output = prg.subarray(2 + machine.start - load, 2 + machine.end - load);
      expect([...output]).toEqual([...bytes].map((byte) => byte ^ 0xff));
      const assembly = await readFile(join(built.generation.directory, ".asm"), "utf8");
      expect(assembly).not.toContain("invert");
      expect(assembly).not.toMatch(/jsr[^\n]*invert/iu);
    });
  }, 60_000);

  // A compile-time function reads an embedded scalar as an ordinary constant.
  it("should read an embedded PSID scalar in a compile-time function", async () => {
    const source = `module Game;
const INIT: word = embed("music.sid", "init_address");
comptime function get(): word { return INIT; }
const VALUE: word = get();
function main(): void { poke($0400, byte(VALUE)); poke($0401, byte(VALUE >> 8)); }
`;
    await withProject(
      source,
      [
        {
          path: "music.sid",
          bytes: await import("node:fs/promises").then(({ readFile: read }) =>
            read(join(process.cwd(), "test/rd06/fixtures/public/psid/psid-v1-fixed.sid")),
          ),
        },
      ],
      async (project) => {
        const built = await buildProject({ project });
        expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
          "success",
        );
        if (built.kind !== "success") throw new Error("Expected a scalar comptime build");
        const assembly = await readFile(join(built.generation.directory, ".asm"), "utf8");
        // $C000 low byte is $00 and high byte is $C0.
        expect(assembly).toMatch(/lda #\$00\b/iu);
        expect(assembly).toMatch(/lda #\$c0\b/iu);
      },
    );
  }, 60_000);

  // File access, MMIO and ordinary calls are rejected inside compile-time functions.
  it("should reject embed, peek and ordinary calls inside a compile-time function", async () => {
    const embedCodes = await codes(
      `module Game;\ncomptime function bad(): byte[] { return embed("data.bin"); }\n${MAIN}`,
    );
    expect(embedCodes).toContain("E10135");
    const peekCodes = await codes(
      `module Game;\ncomptime function bad(): byte { return peek($0400); }\n${MAIN}`,
    );
    expect(peekCodes).toContain("E10191");
    const callCodes = await codes(
      `module Game;\nfunction runtime(): byte { return 1; }\ncomptime function bad(): byte { return runtime(); }\n${MAIN}`,
    );
    expect(callCodes).toContain("E10191");
  }, 60_000);

  // Two compile-time readers of one admitted embed do not duplicate its bytes.
  it("should reference one admitted embed twice without a second copy", async () => {
    const bytes = patternedBytes(64, 21);
    const source = `module Game;
const DATA: byte[] = embed("data.bin");
comptime function first(): byte { return DATA[0]; }
comptime function last(): byte { return DATA[63]; }
const FIRST: byte = first();
const LAST: byte = last();
function main(): void { poke($0400, FIRST); poke($0401, LAST); }
`;
    await withProject(source, [{ path: "data.bin", bytes }], async (project) => {
      const built = await buildProject({ project });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("Expected a deduplicated embed");
      const assets = JSON.parse(
        await readFile(join(built.generation.directory, ".assets.json"), "utf8"),
      ) as { assets: unknown[] };
      expect(assets.assets).toHaveLength(1);
      const prg = await readFile(
        join(built.generation.directory, built.generation.primaryArtifact),
      );
      const sequence = Buffer.from(bytes);
      const first = prg.indexOf(sequence);
      expect(first).toBeGreaterThanOrEqual(0);
      expect(prg.indexOf(sequence, first + 1)).toBe(-1);
    });
  }, 60_000);
});

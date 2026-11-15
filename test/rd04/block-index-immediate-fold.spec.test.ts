import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

/** Read the exact `Game.main` body from the generated assembly. */
async function mainBody(asmPath: string): Promise<readonly string[]> {
  const asm = await readFile(asmPath, "utf8");
  const lines = asm.split("\n");
  const start = lines.findIndex((line) => /b65_Game_main_block_/.test(line));
  if (start < 0) throw new Error("Missing Game.main block label");
  const end = lines.findIndex((line, index) => index > start && /^\s+jmp/u.test(line));
  return lines
    .slice(start + 1, end < 0 ? start + 30 : end)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith(";"));
}

const cases = [
  {
    name: "should fold a symbolic block index to one immediate load and store",
    source: `module Game;
let buffer: byte[64];
function main(): void { c64.vic.setSpritePointer(0, lo(&buffer / 64)); }`,
    check: (body: readonly string[]) => {
      const instructions = body.filter((line) => /^(lda|sta)/u.test(line));
      expect(instructions).toHaveLength(2);
      expect(instructions[0]).toMatch(/^lda #\$[0-9a-f]{2}$/u);
      expect(instructions[1]).toMatch(/^sta \$07f8$/u);
      expect(body.some((line) => /^(lsr|ror)/u.test(line))).toBe(false);
    },
  },
  {
    name: "should keep the ordinary pointer path for lo(address)",
    source: `module Game;
let buffer: byte[64];
function main(): void { poke($C000, lo(&buffer)); }`,
    check: (body: readonly string[]) => {
      expect(body.some((line) => /^sta\+?1? \$02$/u.test(line))).toBe(true);
      expect(body.some((line) => /^(lsr|ror)/u.test(line))).toBe(false);
    },
  },
  {
    name: "should keep the ordinary high-byte path",
    source: `module Game;
let buffer: byte[64];
function main(): void { poke($C000, hi(&buffer)); }`,
    check: (body: readonly string[]) => {
      expect(body.some((line) => /^lda #>\(/u.test(line))).toBe(true);
      expect(body.some((line) => /07f8/u.test(line))).toBe(false);
    },
  },
  {
    name: "should keep the runtime shift for a dynamic element address",
    source: `module Game;
let buffer: byte[64];
function main(): void { poke($C000, lo(&buffer[peek($0400) & 63] / 64)); }`,
    check: (body: readonly string[]) => {
      expect(body.some((line) => /^(lsr|ror)/u.test(line))).toBe(true);
    },
  },
  {
    name: "should keep the runtime shift for non-block arithmetic",
    source: `module Game;
let buffer: byte[64];
function main(): void { poke($C000, lo(&buffer / 32)); }`,
    check: (body: readonly string[]) => {
      expect(body.some((line) => /^(lsr|ror)/u.test(line))).toBe(true);
    },
  },
  {
    name: "should keep the runtime path for an explicit placement",
    source: `module Game;
place(at: $C040) let buffer: byte[64];
function main(): void { c64.vic.setSpritePointer(0, lo(&buffer / 64)); }`,
    check: (body: readonly string[]) => {
      expect(body.some((line) => /^(lsr|ror)/u.test(line))).toBe(true);
    },
  },
] as const;

describe.each(sourceLibraryProfiles)("symbolic block-index fold on %s", (profile) => {
  for (const testCase of cases) {
    it(
      testCase.name,
      async () => {
        await withProfileProject(testCase.source, profile, async (project) => {
          const built = await buildProject({ project, optimization: "none" });
          expect(
            built.kind,
            built.kind === "failure" ? JSON.stringify(built.diagnostics) : "",
          ).toBe("success");
          if (built.kind !== "success") return;
          const body = await mainBody(join(built.generation.directory, ".asm"));
          testCase.check(body);
        });
      },
      120_000,
    );
  }
});

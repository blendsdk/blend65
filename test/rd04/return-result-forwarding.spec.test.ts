import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

/** Read one routine body from the generated assembly up to its first return. */
async function routineBody(asmPath: string, routine: string): Promise<readonly string[]> {
  const asm = await readFile(asmPath, "utf8");
  const lines = asm.split("\n");
  const start = lines.findIndex((line) => line.startsWith(`b65_Game_${routine}_`));
  if (start < 0) throw new Error(`Missing ${routine} routine label`);
  const end = lines.findIndex((line, index) => index > start && /^\s+rts/u.test(line));
  if (end < 0) throw new Error(`Missing ${routine} return`);
  return lines
    .slice(start + 1, end + 1)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length > 0 &&
        !line.startsWith(";") &&
        !line.startsWith("*") &&
        !line.startsWith("b65_"),
    );
}

const cases = [
  {
    name: "should return a byte arithmetic result directly in A",
    routine: "next",
    source: `module Game;
let data: byte[8] = [0; 8];
let total: byte = 0;
function next(value: byte): byte { return value + 1; }
function main(): void {
  for (let i: word = 0; i < 8; i += 1) { data[i] = byte(i); }
  total = next(7);
}`,
    check: (body: readonly string[]) => {
      expect(body.filter((line) => /^(lda|sta)/u.test(line))).toHaveLength(1);
      expect(body.some((line) => /^sta/u.test(line))).toBe(false);
      expect(body.at(-1)).toBe("rts");
      expect(body.some((line) => /^adc #\$01$/u.test(line))).toBe(true);
    },
  },
  {
    name: "should return a helper result directly after the call",
    routine: "calculate",
    source: `module Game;
let total: byte = 0;
function calculate(a: byte, b: byte): byte { return a * b; }
function main(): void { total = calculate(3, 4); }`,
    check: (body: readonly string[]) => {
      expect(body.at(-1)).toBe("rts");
      const call = body.findLastIndex((line) => /^jsr/u.test(line));
      expect(call).toBe(body.length - 2);
      expect(body.slice(call + 1).some((line) => /^(sta|lda)/u.test(line))).toBe(false);
    },
  },
] as const;

describe.each(sourceLibraryProfiles)("return-result forwarding on %s", (profile) => {
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
          testCase.check(
            await routineBody(join(built.generation.directory, ".asm"), testCase.routine),
          );
        });
      },
      120_000,
    );
  }
});

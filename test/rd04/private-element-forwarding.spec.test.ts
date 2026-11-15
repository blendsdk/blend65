import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { withProfileProject } from "../rd05/profile-fixture.js";
import { sourceLibraryProfiles } from "../rd05/source-library-fixture.js";

/** Read the `Game.main` body from the generated assembly. */
async function mainBody(asmPath: string): Promise<readonly string[]> {
  const asm = await readFile(asmPath, "utf8");
  const lines = asm.split("\n");
  const start = lines.findIndex((line) => line.startsWith("b65_Game_main_block_"));
  if (start < 0) throw new Error("Missing Game.main block label");
  const end = lines.findIndex((line, index) => index > start && /^\s+jmp/u.test(line));
  return lines
    .slice(start + 1, end < 0 ? start + 30 : end)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith(";") && !line.startsWith("*"));
}

const cases = [
  {
    name: "should forward a supplied private element into its next read",
    source: `module Game;
function main(): void {
  let a: byte[2] = [7];
  poke($C000, a[0]);
}`,
    check: (body: readonly string[]) => {
      const loads = body.filter((line) => /^lda\b/u.test(line));
      expect(loads).toHaveLength(1);
      expect(loads[0]).toMatch(/^lda #\$07$/u);
      expect(body.some((line) => /^sta \$c000$/u.test(line))).toBe(true);
    },
  },
  {
    name: "should not forward a global element into its next read",
    source: `module Game;
let a: byte[2];
function main(): void {
  a[0] = 7;
  poke($C000, a[0]);
}`,
    check: (body: readonly string[]) => {
      expect(body.filter((line) => /^lda\b/u.test(line)).length).toBeGreaterThanOrEqual(2);
    },
  },
  {
    name: "should not forward across a dynamic raw destination",
    source: `module Game;
function main(): void {
  let a: byte[2] = [7];
  poke(peekw($0330), a[0]);
}`,
    check: (body: readonly string[]) => {
      expect(body.filter((line) => /^lda\b/u.test(line)).length).toBeGreaterThanOrEqual(2);
    },
  },
  {
    name: "should not forward a runtime-index element store",
    source: `module Game;
function main(): void {
  let a: byte[2] = [7, 8];
  let i: byte = peek($0400) & 1;
  a[i] = 9;
  poke($C000, a[i]);
}`,
    check: (body: readonly string[]) => {
      expect(body.filter((line) => /^lda\b/u.test(line)).length).toBeGreaterThanOrEqual(2);
    },
  },
] as const;

describe.each(sourceLibraryProfiles)("private element forwarding on %s", (profile) => {
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
          testCase.check(await mainBody(join(built.generation.directory, ".asm")));
        });
      },
      120_000,
    );
  }
});

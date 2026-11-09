import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { withProject } from "./project-fixture.js";

describe("proved ordinal raw-write selection", () => {
  it("should emit sta absolute,x for a bounded byte index in none mode", async () => {
    await withProject(
      `module Game;
function main(): void {
  for (let index: word = 0; index < 8; index += 1) {
    poke($0C00 + index, byte(index));
  }
}
`,
      [],
      async (project) => {
        const built = await buildProject({ project });
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        const assembly = await readFile(join(built.generation.directory, ".asm"), "utf8");
        expect(assembly).toMatch(/sta(?:\+\d+)? \$0c00,x\b/iu);
        expect(assembly).not.toMatch(/sta \(/iu);
      },
      "c64-pal-prg-kernal-6581",
      "balanced",
    );
  }, 60_000);

  it("should keep an unproved word index on the indirect path", async () => {
    await withProject(
      `module Game;
function main(): void {
  let index: word = 0;
  while (index < 1000) {
    poke($0C00 + index, byte(index));
    index += 1;
  }
}
`,
      [],
      async (project) => {
        const built = await buildProject({ project });
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        const assembly = await readFile(join(built.generation.directory, ".asm"), "utf8");
        expect(assembly).toMatch(/sta \(/iu);
        expect(assembly).not.toMatch(/sta \$0c00,x\b/iu);
      },
      "c64-pal-prg-kernal-6581",
      "balanced",
    );
  }, 60_000);
});

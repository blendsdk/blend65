import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { withProject } from "../rd06/project-fixture.js";

describe("static raw-address evidence", () => {
  it("should store through a static mutable place without a pointer pair", async () => {
    await withProject(
      `module Game;
let DATA: byte[4] = [; 0];
function main(): void { poke(&DATA, $5a); }
`,
      [],
      async (project) => {
        const built = await buildProject({ project });
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        const assembly = await readFile(join(built.generation.directory, ".asm"), "utf8");
        expect(assembly).toMatch(/sta\+2 b65_Game_DATA_/iu);
        expect(assembly).not.toMatch(/sta \(/iu);
      },
    );
  }, 60_000);
});

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject, checkProject } from "@blend65/compiler";
import { patternedBytes, withProject } from "./project-fixture.js";

const MAIN = "\nfunction main(): void {}\n";

describe("native asset security boundaries", () => {
  // A traversal spelling is rejected before any file outside the project is read.
  it("should reject a traversal path in a reserved native request", async () => {
    const source = `module Game;\n\nconst SPRITES: byte[] = embed("../outside.spd");\n${MAIN}`;
    await withProject(source, [], async (project) => {
      const checked = await checkProject({ project });
      expect(checked.kind).toBe("failure");
      expect(checked.diagnostics.map(({ code }) => code)).toEqual(["PROJECT_PATH_INVALID"]);
      expect(checked.diagnostics[0]?.message).not.toContain("outside.spd' — searched");
    });
  });

  // A hostile file name is never written into generated assembly as text or a directive.
  it("should keep a hostile asset name and bytes out of generated ACME source", async () => {
    const hostileName = "evil;!byte 0.bin";
    const source = `module Game;\n\nconst TABLE: byte[] = embed("${hostileName}");\n${MAIN}`;
    const bytes = Uint8Array.from([0xff, 0x00, 0x21, 0x62, 0x79, 0x74, 0x65]);
    await withProject(source, [{ path: hostileName, bytes }], async (project) => {
      const built = await buildProject({ project });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("Expected a successful build");
      const assembly = await readFile(join(built.generation.directory, ".asm"), "utf8");
      expect(assembly).not.toContain(hostileName);
      expect(assembly).not.toMatch(/!binary|!source|!to|!8\s+"/u);
      expect(assembly).toContain("!byte $ff, $00, $21, $62, $79, $74, $65");
    });
  });
});

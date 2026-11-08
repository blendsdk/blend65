import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject, checkProject } from "@blend65/compiler";
import { patternedBytes, withProject } from "./project-fixture.js";

const MAIN = "\nfunction main(): void {}\n";

describe("asset boundary hardening", () => {
  // The maximum admitted raw array is accepted and one byte more is rejected before emission.
  it("should accept 65535 raw bytes and reject 65536", async () => {
    const accepted = `module Game;\n\nconst TABLE: byte[] = embed("large.bin");\n${MAIN}`;
    await withProject(
      accepted,
      [{ path: "large.bin", bytes: patternedBytes(0xffff, 1) }],
      async (project) => {
        const checked = await checkProject({ project });
        expect(
          checked.kind,
          checked.kind === "failure" ? JSON.stringify(checked.diagnostics) : "",
        ).toBe("success");
      },
    );

    const rejected = `module Game;\n\nconst TABLE: byte[] = embed("large.bin");\n${MAIN}`;
    await withProject(
      rejected,
      [{ path: "large.bin", bytes: patternedBytes(0x10000, 1) }],
      async (project) => {
        const checked = await checkProject({ project });
        expect(checked.kind).toBe("failure");
        expect(checked.diagnostics.map(({ code }) => code)).toEqual(["E10265"]);
      },
    );
  });

  // A control character in a file name never becomes a second assembly line.
  it("should keep a newline in an asset name out of generated assembly", async () => {
    const name = "evil\nname.bin";
    const source = `module Game;\n\nconst TABLE: byte[] = embed("evil\\nname.bin");\n${MAIN}`;
    await withProject(
      source,
      [{ path: name, bytes: Uint8Array.from([1, 2, 3]) }],
      async (project) => {
        const built = await buildProject({ project });
        expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
          "success",
        );
        if (built.kind !== "success") throw new Error("Expected a successful build");
        const assembly = await readFile(join(built.generation.directory, ".asm"), "utf8");
        expect(assembly).not.toContain("evil\nname.bin");
        expect(assembly).not.toMatch(/^evil/mu);
        expect(assembly).toContain("!byte $01, $02, $03");
      },
    );
  });

  // A traversal spelling is rejected by the native reader before the host lookup.
  it("should reject parent traversal and absolute native spellings", async () => {
    for (const literal of ["../outside.spd", "/outside.spd", "assets/../../outside.spd"]) {
      const source = `module Game;\n\nconst SPRITES: byte[] = embed("${literal}");\n${MAIN}`;
      await withProject(source, [], async (project) => {
        const checked = await checkProject({ project });
        expect(checked.kind).toBe("failure");
        expect(checked.diagnostics.map(({ code }) => code)).toEqual(["PROJECT_PATH_INVALID"]);
      });
    }
  });
});

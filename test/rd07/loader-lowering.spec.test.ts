import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { withProject } from "../rd06/project-fixture.js";

/** Build one D64 program and return its published assembly. */
async function assembly(source: string): Promise<string> {
  return withProject(
    source,
    [],
    async (project) => {
      const built = await buildProject({ project });
      if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
      return readFile(join(built.generation.directory, ".asm"), "utf8");
    },
    "c64-pal-d64-kernal-6581",
  );
}

const STATIC = [
  "module Game;",
  "",
  "loadable const DATA: byte[4] = [1, 2, 3, 4];",
  "let target: byte[4];",
  "function main(): void { if (c64.loader.load(DATA, target)) { let x: byte = target[0]; } }",
  "",
].join("\n");

describe("KERNAL loader lowering", () => {
  // The exact SETLFS/SETNAM/LOAD sequence is emitted once for a reachable call.
  it("should emit the exact KERNAL sequence", async () => {
    const text = await assembly(STATIC);
    expect(text).toContain("ldx+1 $ba");
    expect(text).toContain("jsr $ffba");
    expect(text).toContain("jsr $ffbd");
    expect(text).toContain("jsr $ffd5");
    expect(text.match(/jsr \$ffd5/gu)).toHaveLength(1);
  });

  // The unit name is read-only data addressed by the SETNAM pointer, never copied.
  it("should pass the read-only unit name without a RAM copy", async () => {
    const text = await assembly(STATIC);
    expect(text).toContain("compiler_c64_load_unit_name_");
    expect(text).not.toContain("lda #$4c");
  });

  // KERNAL messages are suppressed while the call runs so errors return with carry.
  it("should suppress KERNAL messages around the call", async () => {
    const text = await assembly(STATIC);
    expect(text).toContain("lda+1 $9d");
    expect(text).toContain("and #$3f");
    expect(text).toContain("sta+1 $9d");
  });

  // Only the low STATUS error nibble is checked; EOI remains a successful transfer.
  it("should mask STATUS to its low error nibble", async () => {
    const text = await assembly(STATIC);
    expect(text).toContain("lda+1 $90");
    expect(text).toContain("and #$0f");
  });

  // Cross-call values live in an absolute RAM scratch object, not KERNAL zero page.
  it("should keep cross-call state outside the KERNAL zero-page scratch", async () => {
    const text = await assembly(STATIC);
    expect(text).toContain("compiler_c64_load_unit_scratch_");
    expect(text).toContain("sta+2 b65_compiler_c64_load_unit_scratch_");
  });

  // A D64 program with no reachable load emits no loader code or name data.
  it("should emit no loader when no load call is reachable", async () => {
    const text = await assembly(
      "module Game;\n\nlet value: byte = 1;\nfunction main(): void { value = 2; }\n",
    );
    expect(text).not.toContain("jsr $ffd5");
    expect(text).not.toContain("compiler_c64_load_unit_name_");
    expect(text).not.toContain("compiler_c64_load_unit_scratch_");
  });
});

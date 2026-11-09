import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { patternedBytes, withProject } from "./project-fixture.js";

/** Return the first diagnostic with the requested code from one public build. */
async function diagnostic(source: string, code: string) {
  return withProject(
    source,
    [{ path: "sprites.bin", bytes: patternedBytes(64, 51) }],
    async (project) => {
      const built = await buildProject({ project });
      expect(built.kind).toBe("failure");
      const selected = built.diagnostics.find((item) => item.code === code);
      expect(selected, JSON.stringify(built.diagnostics)).toBeDefined();
      return selected!;
    },
  );
}

describe("source-linked VIC field diagnostics", () => {
  it("should report a misaligned constant field as E10273 with its source", async () => {
    const selected = await diagnostic(
      `module Game;
function main(): void { poke($D018, c64.vic.vicSpriteBlock($0401)); }
`,
      "E10273",
    );
    expect(selected.primarySpan).not.toBeNull();
    expect(selected.message).toMatch(/\$0?401/u);
    expect(selected.message).toMatch(/64-byte alignment/u);
  }, 60_000);

  it("should report an out-of-bank constant field as E10273", async () => {
    const selected = await diagnostic(
      `module Game;
function main(): void { poke($D018, c64.vic.vicSpriteBlock($4000)); }
`,
      "E10273",
    );
    expect(selected.message).toMatch(/outside/iu);
  }, 60_000);

  it("should report a character-ROM constant field as E10273", async () => {
    const selected = await diagnostic(
      `module Game;
function main(): void { poke($D018, c64.vic.vicCharsetSelect($1800)); }
`,
      "E10273",
    );
    expect(selected.message).toMatch(/character-ROM/iu);
  }, 60_000);

  it("should reject a dynamic non-asset field argument as E10273", async () => {
    const selected = await diagnostic(
      `module Game;
function main(): void { poke($D018, c64.vic.vicScreenSelect(peek($C000))); }
`,
      "E10273",
    );
    expect(selected.primarySpan).not.toBeNull();
    expect(selected.message).toMatch(/constant or symbolic/iu);
  }, 60_000);
});

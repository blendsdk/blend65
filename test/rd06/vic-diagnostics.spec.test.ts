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

  // A placed sprite array is checked at its resolved address, not only when the
  // source passes a literal address.
  it.each([
    ["$1000", /character-ROM|VIC-visible/iu],
    ["$4000", /outside|VIC-visible/iu],
  ])(
    "should reject a VIC-visible placed array at %s",
    async (address, message) => {
      const selected = await diagnostic(
        `module Game;
place(at: ${address}) const SPRITES: byte[64] = embed("sprites.bin");
function main(): void { poke($D018, c64.vic.vicSpriteBlock(&SPRITES)); }
`,
        "E10273",
      );
      expect(selected.message).toMatch(message);
    },
    60_000,
  );

  // The same window is legal for ordinary CPU-readable data. The VIC restriction
  // applies to a resolved object a VIC consumer claims, not to every address.
  it("should allow ordinary CPU data at $1000 without a VIC consumer", async () => {
    const result = await withProject(
      `module Game;
place(at: $1000) const TABLE: byte[64] = embed("sprites.bin");
function main(): void { poke($D020, TABLE[0]); }
`,
      [{ path: "sprites.bin", bytes: patternedBytes(64, 51) }],
      async (project) => buildProject({ project }),
    );
    expect(result.kind).toBe("success");
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

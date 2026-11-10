import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import type { ProjectDiagnostic } from "@blend65/compiler";
import { withProject } from "../rd06/project-fixture.js";

const ctm = readFileSync(
  join(process.cwd(), "test/rd06/fixtures/public/charpad/synthetic-basic.ctm"),
);
const spd = readFileSync(
  join(process.cwd(), "test/rd06/fixtures/public/spritepad/synthetic-basic.spd"),
);

const CHARSET_HEADER = [
  "module Game;",
  "",
  'loadable const CHARSET: byte[16] = embed("level.ctm", "charset");',
  "",
].join("\n");

interface Observed {
  readonly start: number;
  readonly end: number;
  readonly visibility: readonly string[];
  readonly alignmentBytes: number;
}

/** Build a CharPad unit program and inspect the proved destination. */
async function buildCharset(
  body: string,
): Promise<
  | { readonly kind: "success"; readonly destination: Observed }
  | { readonly kind: "failure"; readonly diagnostics: readonly ProjectDiagnostic[] }
> {
  return withProject(
    `${CHARSET_HEADER}${body}\n`,
    [{ path: "level.ctm", bytes: ctm }],
    async (project) => {
      const built = await buildProject({ project });
      if (built.kind === "failure") {
        return { kind: "failure" as const, diagnostics: built.diagnostics };
      }
      const memory = JSON.parse(
        await readFile(join(built.generation.directory, ".memory.json"), "utf8"),
      ) as {
        intervals: {
          kind: string;
          addressSpaceId: string;
          start: number;
          end: number;
          alignmentBytes: number;
          vic?: { visibility: readonly string[] };
        }[];
      };
      const destination = memory.intervals.find(
        ({ kind, addressSpaceId }) => kind === "loadDestination" && addressSpaceId === "cpu16",
      )!;
      expect(destination.start % 2048).toBe(0);
      return {
        kind: "success" as const,
        destination: {
          start: destination.start,
          end: destination.end,
          visibility: destination.vic?.visibility ?? [],
          alignmentBytes: destination.alignmentBytes,
        },
      };
    },
    "c64-pal-d64-kernal-6581",
  );
}

describe("load destination constraints", () => {
  // A loadable charset into a plain global is aligned and VIC-visible.
  it("should place a charset destination at a VIC-visible 2048-byte boundary", async () => {
    const observed = await buildCharset(
      "let dest: byte[16];\nfunction main(): void { if (c64.loader.load(CHARSET, dest)) { let x: byte = dest[0]; } }",
    );
    expect(observed.kind).toBe("success");
    if (observed.kind !== "success") throw new Error(JSON.stringify(observed.diagnostics));
    expect(observed.destination.alignmentBytes).toBe(2048);
    expect(observed.destination.visibility).toContain("vic");
    expect(observed.destination.end).toBeLessThanOrEqual(0x4000);
  });

  // A field at offset zero inherits the root's alignment.
  it("should accept a field destination at offset zero", async () => {
    const observed = await buildCharset(
      [
        "struct Holder { data: byte[16]; }",
        "let holder: Holder;",
        "function main(): void { if (c64.loader.load(CHARSET, holder.data)) { let x: byte = holder.data[0]; } }",
      ].join("\n"),
    );
    expect(observed.kind).toBe("success");
  });

  // A field at a non-multiple offset cannot satisfy the handler alignment.
  it("should reject a misaligned field destination with E10275", async () => {
    const observed = await buildCharset(
      [
        "struct Holder { pad: byte[2]; data: byte[16]; }",
        "let holder: Holder;",
        "function main(): void { if (c64.loader.load(CHARSET, holder.data)) { let x: byte = holder.data[0]; } }",
      ].join("\n"),
    );
    expect(observed.kind).toBe("failure");
    if (observed.kind !== "failure") throw new Error("Expected a constraint rejection");
    expect(observed.diagnostics.map(({ code }) => code)).toEqual(["E10275"]);
    expect(observed.diagnostics[0]?.message).toMatch(/field offset 2.*2048-byte alignment/u);
  });

  // A local home cannot yet prove handler alignment or visibility.
  it("should reject a constrained local destination with E10275", async () => {
    const observed = await buildCharset(
      "function main(): void { let dest: byte[16]; if (c64.loader.load(CHARSET, dest)) { let x: byte = dest[0]; } }",
    );
    expect(observed.kind).toBe("failure");
    if (observed.kind !== "failure") throw new Error("Expected a constraint rejection");
    expect(observed.diagnostics[0]?.message).toMatch(/local or parameter home/u);
  });

  // An explicit destination inside character ROM is not VIC-visible.
  it("should reject a character-ROM destination with E10275", async () => {
    const observed = await buildCharset(
      "place(at: $1000) let dest: byte[16];\nfunction main(): void { if (c64.loader.load(CHARSET, dest)) { let x: byte = dest[0]; } }",
    );
    expect(observed.kind).toBe("failure");
    if (observed.kind !== "failure") throw new Error("Expected a constraint rejection");
    expect(observed.diagnostics[0]?.message).toMatch(/character-ROM window/u);
  });

  // An explicit, aligned, non-ROM bank-zero destination is accepted.
  it("should accept an explicit VIC-visible destination", async () => {
    const observed = await buildCharset(
      "place(at: $3000) let dest: byte[16];\nfunction main(): void { if (c64.loader.load(CHARSET, dest)) { let x: byte = dest[0]; } }",
    );
    expect(observed.kind).toBe("success");
    if (observed.kind !== "success") throw new Error(JSON.stringify(observed.diagnostics));
    expect(observed.destination.start).toBe(0x3000);
  });

  // A SpritePad unit requires 64-byte alignment and VIC visibility.
  it("should enforce the sprite alignment", async () => {
    const result = await withProject(
      [
        "module Game;",
        "",
        'loadable const SPRITES: byte[64] = embed("player.spd");',
        "let dest: byte[64];",
        "function main(): void { if (c64.loader.load(SPRITES, dest)) { let x: byte = dest[0]; } }",
        "",
      ].join("\n"),
      [{ path: "player.spd", bytes: spd }],
      async (project) => {
        const built = await buildProject({ project });
        if (built.kind === "failure") throw new Error(JSON.stringify(built.diagnostics));
        const memory = JSON.parse(
          await readFile(join(built.generation.directory, ".memory.json"), "utf8"),
        ) as {
          intervals: {
            kind: string;
            addressSpaceId: string;
            start: number;
            alignmentBytes: number;
            vic?: { visibility: readonly string[] };
          }[];
        };
        return memory.intervals.find(
          ({ kind, addressSpaceId }) => kind === "loadDestination" && addressSpaceId === "cpu16",
        )!;
      },
      "c64-pal-d64-kernal-6581",
    );
    expect(result.start % 64).toBe(0);
    expect(result.alignmentBytes).toBe(64);
    expect(result.vic?.visibility).toContain("vic");
  });

  // The active screen matrix is not a legal VIC-visible destination.
  it("should reject an active-screen destination with E10275", async () => {
    const result = await withProject(
      [
        "module Game;",
        "",
        'loadable const SPRITES: byte[64] = embed("player.spd");',
        "place(at: $0400) let dest: byte[64];",
        "function main(): void { if (c64.loader.load(SPRITES, dest)) { let x: byte = dest[0]; } }",
        "",
      ].join("\n"),
      [{ path: "player.spd", bytes: spd }],
      async (project) => await buildProject({ project }),
      "c64-pal-d64-kernal-6581",
    );
    expect(result.kind).toBe("failure");
    if (result.kind !== "failure") throw new Error("Expected a screen conflict");
    expect(result.diagnostics.map(({ code }) => code)).toEqual(["E10275"]);
    expect(result.diagnostics[0]?.message).toMatch(/active screen matrix/u);
  });

  // An unconstrained raw unit still accepts a local destination.
  it("should keep unconstrained raw units unrestricted", async () => {
    const result = await withProject(
      [
        "module Game;",
        "",
        'loadable const RAW: byte[8] = embed("raw.bin");',
        "function main(): void { let dest: byte[8]; if (c64.loader.load(RAW, dest)) { let x: byte = dest[0]; } }",
        "",
      ].join("\n"),
      [{ path: "raw.bin", bytes: Uint8Array.from({ length: 8 }, (_, index) => index + 1) }],
      async (project) => (await buildProject({ project })).kind,
      "c64-pal-d64-kernal-6581",
    );
    expect(result).toBe("success");
  });
});

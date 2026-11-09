import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildProject } from "@blend65/compiler";
import { patternedBytes, withProject } from "./project-fixture.js";

const MAIN = "\nfunction main(): void {}\n";

describe("resident memory views", () => {
  // CPU, VIC and Color RAM views tile their windows and reconcile every interval.
  it("should publish three reconciling memory views", async () => {
    const bytes = readFileSync(
      join(process.cwd(), "test/rd06/fixtures/public/koala/koala-patterned.kla"),
    );
    const source = `module Game;
place(at: $2000) const BITMAP: byte[] = embed("level.kla", "bitmap");
place(at: $0C00) const SCREEN: byte[] = embed("level.kla", "screen");
function main(): void { poke($D018, c64.vic.vicBitmapSelect(&BITMAP) | c64.vic.vicScreenSelect(&SCREEN)); }
`;
    await withProject(source, [{ path: "level.kla", bytes }], async (project) => {
      const built = await buildProject({ project });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("Expected the view build");
      const memory = JSON.parse(
        await readFile(join(built.generation.directory, ".memory.json"), "utf8"),
      ) as {
        intervals: {
          id: string;
          addressSpaceId: string;
          start: number;
          end: number;
          size: number;
          kind: string;
        }[];
        views: {
          id: string;
          consumer: string;
          addressSpaceId: string;
          start: number;
          end: number;
          capacityBytes: number;
          occupiedBytes: number;
          freeBytes: number;
          freeIntervals: { start: number; end: number; size: number }[];
          largestFreeBytes: number;
          payloadBytes: number;
          paddingBytes: number;
          reservedBytes: number;
        }[];
      };
      expect(memory.views.map(({ id }) => id).sort()).toEqual([
        "color-ram",
        "cpu16-resident",
        "vic-bank-0",
      ]);
      for (const view of memory.views) {
        expect(view.capacityBytes).toBe(view.end - view.start);
        expect(view.occupiedBytes + view.freeBytes).toBe(view.capacityBytes);
        expect(view.payloadBytes + view.paddingBytes + view.reservedBytes).toBe(view.occupiedBytes);
        expect(view.freeIntervals.reduce((total, range) => total + range.size, 0)).toBe(
          view.freeBytes,
        );
        expect(Math.max(0, ...view.freeIntervals.map(({ size }) => size))).toBe(
          view.largestFreeBytes,
        );
      }
      const bank = memory.views.find(({ id }) => id === "vic-bank-0")!;
      expect(bank).toMatchObject({ consumer: "vic", addressSpaceId: "cpu16", end: 0x4000 });
      expect(bank.freeIntervals.some(({ start, end }) => start < 0x2000 && end > 0x2000)).toBe(
        false,
      );
      const cpu = memory.views.find(({ id }) => id === "cpu16-resident")!;
      for (const range of cpu.freeIntervals) {
        expect(range.start).toBeGreaterThanOrEqual(0x0801);
        expect(range.end).toBeLessThanOrEqual(0xd000);
      }
      expect(memory.intervals).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "platform.cpu-high.d000", kind: "reservation" }),
          expect.objectContaining({ id: "platform.screen.0400", kind: "reservation" }),
        ]),
      );
      // Character ROM is either covered by PRG fill or explicitly reserved; it
      // must never appear as a free VIC allocation hole.
      expect(cpu.freeIntervals.some(({ start, end }) => start < 0x2000 && end > 0x1000)).toBe(
        false,
      );
      const costs = JSON.parse(
        await readFile(join(built.generation.directory, ".costs.json"), "utf8"),
      ) as { totals: { resources: { id: string; value: number }[] } };
      const residentRam = costs.totals.resources.find(({ id }) => id === "residentRam")!.value;
      expect(residentRam).toBe(
        memory.intervals
          .filter(
            ({ addressSpaceId, kind }) => addressSpaceId === "cpu16" && kind !== "reservation",
          )
          .reduce((total, interval) => total + interval.size, 0),
      );
      const color = memory.views.find(({ id }) => id === "color-ram")!;
      expect(color).toMatchObject({
        consumer: "vic",
        addressSpaceId: "colorram4",
        capacityBytes: 0x400,
        reservedBytes: 0x400,
        freeBytes: 0,
      });
      const reservation = memory.intervals.find(({ id }) => id === "color-ram.hardware");
      expect(reservation).toMatchObject({
        addressSpaceId: "colorram4",
        start: 0,
        end: 0x400,
        kind: "reservation",
      });
      for (const interval of memory.intervals) {
        expect(
          memory.views.some(
            (view) =>
              view.addressSpaceId === interval.addressSpaceId &&
              interval.start >= view.start &&
              interval.end <= view.end,
          ),
        ).toBe(true);
      }
    });
  }, 60_000);
});

describe("resident layout asset constraints", () => {
  // 128 sprite records fill half of bank 0 and remain visible.
  it("should fit 128 sprite records in bank 0", async () => {
    const source = `module Game;
const SPRITES: byte[] = embed("sprites.bin");
function main(): void { c64.vic.setSpriteEnabled(0, true); c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&SPRITES)); }
`;
    await withProject(
      source,
      [{ path: "sprites.bin", bytes: patternedBytes(128 * 64, 3) }],
      async (project) => {
        const built = await buildProject({ project });
        expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
          "success",
        );
        if (built.kind !== "success") throw new Error("Expected 128 sprites to fit");
        const assets = JSON.parse(
          await readFile(join(built.generation.directory, ".assets.json"), "utf8"),
        ) as { assets: { placement: { range: { start: number; visibility: string[] } } }[] };
        expect(assets.assets[0]?.placement.range.start).toBe(0x2000);
        expect(assets.assets[0]?.placement.range.visibility).toEqual(["vic"]);
      },
    );
  }, 60_000);

  // Automatic placement must not depend on content-hash order: the bitmap needs
  // an 8-KiB slot and the screen a 1-KiB slot, and both fit in bank 0.
  it("should place an unplaced bitmap and screen in bank 0", async () => {
    const bytes = readFileSync(
      join(process.cwd(), "test/rd06/fixtures/public/koala/koala-patterned.kla"),
    );
    const source = `module Game;
const BITMAP: byte[] = embed("level.kla", "bitmap");
const SCREEN: byte[] = embed("level.kla", "screen");
function main(): void { poke($D018, c64.vic.vicBitmapSelect(&BITMAP) | c64.vic.vicScreenSelect(&SCREEN)); }
`;
    await withProject(source, [{ path: "level.kla", bytes }], async (project) => {
      const built = await buildProject({ project });
      expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
        "success",
      );
      if (built.kind !== "success") throw new Error("Expected automatic VIC placement");
      const assets = JSON.parse(
        await readFile(join(built.generation.directory, ".assets.json"), "utf8"),
      ) as { assets: { selector: string; placement: { range: { start: number } } }[] };
      expect(
        assets.assets.find(({ selector }) => selector === "bitmap")?.placement.range.start,
      ).toBe(0x2000);
      expect(
        assets.assets.find(({ selector }) => selector === "screen")?.placement.range.start,
      ).toBe(0x0c00);
    });
  }, 60_000);

  // A fixed sprite request must not collide with its own reserved range.
  it("should honor an explicit sprite address", async () => {
    const source = `module Game;
place(at: $3000) const SPRITES: byte[] = embed("sprites.bin");
function main(): void { c64.vic.setSpriteEnabled(0, true); c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&SPRITES)); }
`;
    await withProject(
      source,
      [{ path: "sprites.bin", bytes: patternedBytes(2 * 64, 9) }],
      async (project) => {
        const built = await buildProject({ project });
        expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
          "success",
        );
        if (built.kind !== "success") throw new Error("Expected fixed sprite placement");
        const assets = JSON.parse(
          await readFile(join(built.generation.directory, ".assets.json"), "utf8"),
        ) as { assets: { placement: { range: { start: number } } }[] };
        expect(assets.assets[0]?.placement.range.start).toBe(0x3000);
      },
    );
  }, 60_000);

  // A raw charset used by a VIC field operation receives its consumer alignment.
  it("should align a raw charset for vicCharsetSelect", async () => {
    const source = `module Game;
const CHARSET: byte[] = embed("charset.bin");
function main(): void { poke($D018, c64.vic.vicCharsetSelect(&CHARSET)); }
`;
    await withProject(
      source,
      [{ path: "charset.bin", bytes: patternedBytes(2048, 11) }],
      async (project) => {
        const built = await buildProject({ project });
        expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
          "success",
        );
        if (built.kind !== "success") throw new Error("Expected charset placement");
        const assets = JSON.parse(
          await readFile(join(built.generation.directory, ".assets.json"), "utf8"),
        ) as { assets: { placement: { range: { start: number; visibility: string[] } } }[] };
        const range = assets.assets[0]!.placement.range;
        expect(range.start % 2048).toBe(0);
        expect(range.start).toBeGreaterThanOrEqual(0x0801);
        expect(range.start + 2048).toBeLessThanOrEqual(0x4000);
        expect(range.visibility).toEqual(["vic"]);
      },
    );
  }, 60_000);

  // A pure VIC field combined with an ordinary constant must fold to one
  // immediate and must not leave executable zero fill before a fallthrough.
  it("should fold a VIC field OR and preserve fallthrough bytes", async () => {
    const source = `module Game;
const CHARSET: byte[] = embed("charset.bin");
function main(): void { poke($D018, $10 | c64.vic.vicCharsetSelect(&CHARSET)); while (true) { poke($D020, 0); } }
`;
    await withProject(
      source,
      [{ path: "charset.bin", bytes: patternedBytes(2048, 13) }],
      async (project) => {
        const built = await buildProject({ project });
        expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
          "success",
        );
        if (built.kind !== "success") throw new Error("Expected VIC OR build");
        const directory = built.generation.directory;
        const asm = await readFile(join(directory, ".asm"), "utf8");
        expect(asm).toMatch(/lda #\$18\b/iu);
        expect(asm).not.toMatch(/ora #\$30/iu);
        const labels = await readFile(join(directory, ".labels"), "utf8");
        const loop = /b65_Game_main_block_2_[A-Za-z0-9_]+\s*=\s*\$([0-9a-f]+)/iu.exec(labels);
        expect(loop).not.toBeNull();
        const address = Number.parseInt(loop![1]!, 16);
        const prg = await readFile(join(directory, built.generation.primaryArtifact));
        const offset = address - 0x0801 + 2;
        // The loop body must start immediately after `sta $d018` (8D 18 D0).
        expect([...prg.subarray(offset - 3, offset)]).toEqual([0x8d, 0x18, 0xd0]);
      },
    );
  }, 60_000);

  // A partial charset is legal: only the used characters are fetched, while
  // the 2-KiB slot above it remains addressable.
  it("should accept a charset smaller than the VIC window", async () => {
    const source = `module Game;
const CHARSET: byte[] = embed("charset.bin");
function main(): void { poke($D018, c64.vic.vicCharsetSelect(&CHARSET)); }
`;
    await withProject(
      source,
      [{ path: "charset.bin", bytes: patternedBytes(64, 17) }],
      async (project) => {
        const built = await buildProject({ project });
        expect(built.kind, built.kind === "failure" ? JSON.stringify(built.diagnostics) : "").toBe(
          "success",
        );
      },
    );
  }, 60_000);

  // A bitmap fetch reads the complete 8,000-byte object; a smaller asset is invalid.
  it("should reject a bitmap smaller than the VIC consumer window", async () => {
    const source = `module Game;
const BITMAP: byte[] = embed("bitmap.bin");
function main(): void { poke($D018, c64.vic.vicBitmapSelect(&BITMAP)); }
`;
    await withProject(
      source,
      [{ path: "bitmap.bin", bytes: patternedBytes(64, 19) }],
      async (project) => {
        const built = await buildProject({ project });
        expect(built.kind).toBe("failure");
      },
    );
  }, 60_000);

  // 256 sprite records cannot coexist with the active screen in one 16-KiB bank.
  it("should reject 256 sprite records with the active screen", async () => {
    const source = `module Game;
const SPRITES: byte[] = embed("sprites.bin");
function main(): void { c64.vic.setSpriteEnabled(0, true); c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&SPRITES)); }
`;
    await withProject(
      source,
      [{ path: "sprites.bin", bytes: patternedBytes(256 * 64, 5) }],
      async (project) => {
        const built = await buildProject({ project });
        expect(built.kind).toBe("failure");
        const conflict = built.diagnostics.find(({ code }) => code === "E10273");
        expect(conflict).toBeDefined();
      },
    );
  }, 60_000);
});

describe("relocated-screen sprite pointer base", () => {
  const screen = patternedBytes(1000, 31);
  const sprites = patternedBytes(64, 32);

  /** Build one program with an explicit screen and one sprite record. */
  async function buildScreen(source: string) {
    return withProject(
      source,
      [
        { path: "screen.bin", bytes: screen },
        { path: "sprites.bin", bytes: sprites },
      ],
      async (project) => {
        const built = await buildProject({ project });
        if (built.kind !== "success") {
          throw new Error(JSON.stringify(built.diagnostics));
        }
        const assembly = await readFile(join(built.generation.directory, ".asm"), "utf8");
        const memory = JSON.parse(
          await readFile(join(built.generation.directory, ".memory.json"), "utf8"),
        ) as { intervals: { id: string; start: number; end: number; size: number }[] };
        return { assembly, memory };
      },
    );
  }

  it("should derive the pointer table from a relocated screen", async () => {
    const { assembly, memory } = await buildScreen(`module Game;
place(at: $0C00) const SCREEN: byte[] = embed("screen.bin");
const SPRITES: byte[] = embed("sprites.bin");
function main(): void {
  poke($D018, c64.vic.vicScreenSelect(&SCREEN));
  c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&SPRITES));
}
`);
    expect(assembly).toMatch(/sta \$0ff8\b/iu);
    expect(memory.intervals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "screen.c00.pointer-table",
          start: 0x0ff8,
          end: 0x1000,
          size: 8,
        }),
      ]),
    );
  }, 60_000);

  it("should keep the default screen pointer table at $07F8", async () => {
    const { assembly } = await buildScreen(`module Game;
const SPRITES: byte[] = embed("sprites.bin");
function main(): void {
  c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&SPRITES));
}
`);
    expect(assembly).toMatch(/sta \$07f8\b/iu);
  }, 60_000);

  it("should recognize a constant screen selection", async () => {
    const { assembly } = await buildScreen(`module Game;
const SPRITES: byte[] = embed("sprites.bin");
function main(): void {
  poke($D018, c64.vic.vicScreenSelect($0C00));
  c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&SPRITES));
}
`);
    expect(assembly).toMatch(/sta \$0ff8\b/iu);
  }, 60_000);

  it("should keep a 1,024-byte screen pointer table inside the asset", async () => {
    const fullScreen = patternedBytes(1024, 33);
    await withProject(
      `module Game;
place(at: $0C00) const SCREEN: byte[] = embed("screen.bin");
const SPRITES: byte[] = embed("sprites.bin");
function main(): void {
  poke($D018, c64.vic.vicScreenSelect(&SCREEN));
  c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&SPRITES));
}
`,
      [
        { path: "screen.bin", bytes: fullScreen },
        { path: "sprites.bin", bytes: sprites },
      ],
      async (project) => {
        const built = await buildProject({ project });
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        const assembly = await readFile(join(built.generation.directory, ".asm"), "utf8");
        expect(assembly).toMatch(/sta \$0ff8\b/iu);
      },
    );
  }, 60_000);

  it("should derive the bank-end pointer table at $3FF8", async () => {
    await withProject(
      `module Game;
place(at: $3C00) const SCREEN: byte[] = embed("screen.bin");
const SPRITES: byte[] = embed("sprites.bin");
function main(): void {
  poke($D018, c64.vic.vicScreenSelect(&SCREEN));
  c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&SPRITES));
}
`,
      [
        { path: "screen.bin", bytes: screen },
        { path: "sprites.bin", bytes: sprites },
      ],
      async (project) => {
        const built = await buildProject({ project });
        if (built.kind !== "success") throw new Error(JSON.stringify(built.diagnostics));
        const assembly = await readFile(join(built.generation.directory, ".asm"), "utf8");
        expect(assembly).toMatch(/sta \$3ff8\b/iu);
      },
    );
  }, 60_000);

  it("should reject two distinct active screens", async () => {
    const source = `module Game;
place(at: $0800) const FIRST: byte[] = embed("screen.bin");
place(at: $0C00) const SECOND: byte[] = embed("screen.bin");
const SPRITES: byte[] = embed("sprites.bin");
function main(): void {
  poke($D018, c64.vic.vicScreenSelect(&FIRST) | c64.vic.vicScreenSelect(&SECOND));
  c64.vic.setSpritePointer(0, c64.vic.vicSpriteBlock(&SPRITES));
}
`;
    await withProject(
      source,
      [
        { path: "screen.bin", bytes: screen },
        { path: "sprites.bin", bytes: sprites },
      ],
      async (project) => {
        const built = await buildProject({ project });
        expect(built.kind).toBe("failure");
        const conflict = built.diagnostics.find(({ code }) => code === "E10273");
        expect(conflict).toBeDefined();
        expect(conflict?.primarySpan).not.toBeNull();
      },
    );
  }, 60_000);
});

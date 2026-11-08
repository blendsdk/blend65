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

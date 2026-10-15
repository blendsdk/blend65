import { describe, expect, it } from "vitest";
import {
  libraryEntry,
  libraryGlobalAddress,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

const ODD = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
const EVEN = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];

const LIBRARY = `module Library;
export let effects: byte = 0;
export function select(first: boolean): byte[11] {
  let odd: byte[11] = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
  let even: byte[11] = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
  effects += 1;
  if (first) { return odd; }
  return even;
}
export function borrowed(data: byte[11]): byte[11] { return data; }
export function path(data: byte[11], takeBorrow: boolean): byte[11] {
  let local: byte[11] = [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22];
  if (takeBorrow) { return data; }
  return local;
}
function increment(data: byte[11]): void { data[0] += 1; effects += 1; }
export function multiuse(): byte[11] {
  let local: byte[11] = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
  increment(local);
  increment(local);
  return local;
}
export function aliases(left: byte[11], right: byte[11]): byte[11] {
  left[0] = 71;
  right[10] = 99;
  return left;
}`;

function source(masked: boolean): string {
  return `module Game;
import { select, borrowed, path, multiuse, aliases } from Library;
let firstResult: byte[11] = [; 0];
let secondResult: byte[11] = [; 0];
let thirdResult: byte[11] = [; 0];
let borrowedResult: byte[11] = [; 0];
let localPathResult: byte[11] = [; 0];
let borrowedPathResult: byte[11] = [; 0];
let multiuseResult: byte[11] = [; 0];
let aliasResult: byte[11] = [; 0];
let nestedLeft: byte[11] = [; 0];
let nestedRight: byte[11] = [; 0];
let original: byte[11] = [31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41];
function before(): void { asm_nop(); }
function after(): void { asm_nop(); }
function consume(left: byte[11], right: byte[11]): void {
  nestedLeft = left;
  nestedRight = right;
}
function main(): void {
  ${masked ? "asm_sei();" : "asm_cli();"}
  before();
  firstResult = select(true);
  secondResult = select(false);
  thirdResult = select(true);
  borrowedResult = borrowed(original);
  borrowedPathResult = path(original, true);
  localPathResult = path(original, false);
  multiuseResult = multiuse();
  consume(select(true), select(false));
  aliasResult = aliases(original, original);
  original = borrowed(original);
  after();
  asm_cli();
}`;
}

describe("native fixed aggregate return setup preservation", () => {
  for (const profile of sourceLibraryProfiles)
    for (const masked of [false, true])
      it(`${profile}: preserves repeated, nested, borrowed, path and aliased returns with I=${Number(masked)}`, async () => {
        const game = source(masked);
        await withLibraryBuild(game, LIBRARY, profile, async (artifacts, built) => {
          const address = (name: string) =>
            libraryGlobalAddress(artifacts, game, name, 11, "src/game.blend");
          const expected = new Map<string, readonly number[]>([
            ["firstResult", ODD],
            ["secondResult", EVEN],
            ["thirdResult", ODD],
            ["borrowedResult", [31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41]],
            ["borrowedPathResult", [31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41]],
            ["localPathResult", EVEN],
            ["multiuseResult", [3, ...ODD.slice(1)]],
            ["nestedLeft", ODD],
            ["nestedRight", EVEN],
            ["aliasResult", [71, 32, 33, 34, 35, 36, 37, 38, 39, 40, 99]],
            ["original", [71, 32, 33, 34, 35, 36, 37, 38, 39, 40, 99]],
          ]);
          const effects = libraryGlobalAddress(artifacts, LIBRARY, "effects", 1);
          await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.before"));
            const before = await monitor.readCpuRegisters();
            expect(before.p & 0x04).toBe(masked ? 0x04 : 0);
            expect(before.p & 0x08).toBe(0);
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.after"));
            const after = await monitor.readCpuRegisters();
            expect(after.p & 0x0c, "Aggregate calls preserve interrupt and decimal state").toBe(
              before.p & 0x0c,
            );
            expect(after.sp, "Every nested call and copy balances the hardware stack").toBe(
              before.sp,
            );
            for (const [name, bytes] of expected) {
              const start = address(name);
              expect([...(await monitor.readMemory(start, start + 10))], name).toEqual(bytes);
            }
            // Five selections and two observable mutations execute exactly once.
            expect([...(await monitor.readMemory(effects, effects))]).toEqual([7]);
          });
        });
      }, 180_000);
});

import { describe, expect, it } from "vitest";
import { buildProfileSource, profileRecords } from "./profile-fixture.js";
import {
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
  libraryEntry,
} from "./source-library-fixture.js";

type Artifacts = Awaited<ReturnType<typeof buildProfileSource>>;
const REGISTER_ADDRESSES = [
  ...Array.from({ length: 16 }, (_, index) => 0xd000 + index),
  0xd010,
  0xd015,
  0xd017,
  0xd018,
  0xd01b,
  0xd01c,
  0xd01d,
  0xd020,
  0xd021,
  ...Array.from({ length: 8 }, (_, index) => 0xd027 + index),
];
const POINTER_ADDRESSES = Array.from({ length: 8 }, (_, index) => 0x07f8 + index);
const DEFAULTS = new Map([
  [0xd018, 0x14],
  [0xd015, 0],
  [0xd017, 0],
  [0xd01b, 0],
  [0xd01c, 0],
  [0xd01d, 0],
  [0xd020, 0],
  [0xd021, 0],
]);
const CASES = [
  [
    "direct VIC read",
    `module Game; let observed: byte;
    function main(): void { observed = peek($D018); }`,
  ],
  [
    "direct VIC write",
    `module Game;
    function main(): void { poke($D020, 3); }`,
  ],
  [
    "VIC mirrored register read",
    `module Game; let observed: byte;
    function main(): void { observed = peek($D060); }`,
  ],
  [
    "screen matrix read",
    `module Game; let observed: byte;
    function main(): void { observed = peek($0400); }`,
  ],
  [
    "screen matrix write relying on display defaults",
    `module Game;
    function main(): void { poke($0400, 1); }`,
  ],
  [
    "color RAM consumer",
    `module Game;
    function main(): void { poke($D800, 2); }`,
  ],
  [
    "transitive helper display dependence",
    `module Game;
    function draw(): void { poke($D021, 4); }
    function update(): void { draw(); }
    function main(): void { update(); }`,
  ],
  [
    "initializer display dependence",
    `module Game;
    let initial: byte = sample();
    function sample(): byte { return peek($D020); }
    function main(): void { initial = initial + 1; }`,
  ],
  [
    "declared handler display dependence",
    `module Game;
    interrupt function raster(): void { poke($D020, 5); }
    function main(): void {}`,
  ],
  [
    "unknown raw address",
    `module Game;
    function main(): void { let address: word = peekw($CFFE); poke(address, 1); }`,
  ],
  [
    "unknown aliased address reaching a helper",
    `module Game;
    function write(address: word): void { let alias: word = address; poke(alias, 1); }
    function main(): void { write(peekw($CFFE)); }`,
  ],
] as const;

function startupBytes(artifacts: Artifacts, id: string) {
  const matches = profileRecords(artifacts.memory.intervals).filter((entry) => entry.id === id);
  expect(matches, id).toHaveLength(1);
  const { start, end, size, owner, kind } = matches[0]!;
  expect(kind).toBe("code");
  expect(owner).toEqual({ kind: "platform", id: "startup" });
  if (typeof start !== "number" || typeof end !== "number" || typeof size !== "number")
    throw new TypeError("Startup requires a public physical code interval");
  expect(size).toBe(end - start);
  expect(size).toBeGreaterThan(0);
  const offset = 2 + start - artifacts.prg.readUInt16LE(0);
  expect(offset).toBeGreaterThanOrEqual(2);
  expect(offset + size).toBeLessThanOrEqual(artifacts.prg.length);
  return artifacts.prg.subarray(offset, offset + size);
}

// The NMOS width inventory excludes operands from opcode scanning.
const opcodes = (text: string) => new Set(text.split(" ").map((byte) => Number.parseInt(byte, 16)));
const one = opcodes(
  "08 0a 18 28 2a 38 40 48 4a 58 60 68 6a 78 88 8a 98 9a a8 aa b8 ba c8 ca d8 e8 ea f8",
);
const two = opcodes(
  "01 05 06 09 10 11 15 16 21 24 25 26 29 30 31 35 36 41 45 46 49 50 51 55 56 61 65 66 69 70 71 75 76 81 84 85 86 90 91 94 95 96 a0 a1 a2 a4 a5 a6 a9 b0 b1 b4 b5 b6 c0 c1 c4 c5 c6 c9 d0 d1 d5 d6 e0 e1 e4 e5 e6 e9 f0 f1 f5 f6",
);
const three = opcodes(
  "0d 0e 1d 1e 20 2c 2d 2e 3d 3e 4c 4d 4e 5d 5e 6c 6d 6e 7d 7e 8c 8d 8e 99 9d ac ad ae b9 bc bd be cc cd ce d9 dd de ec ed ee f9 fd fe",
);
const reads = opcodes(
  "0d 0e 1d 1e 2c 2d 2e 3d 3e 4d 4e 5d 5e 6d 6e 7d 7e ac ad ae b9 bc bd be cc cd ce d9 dd de ec ed ee f9 fd fe",
);
const writes = opcodes("0e 1e 2e 3e 4e 5e 6e 7e 8c 8d 8e 99 9d ce de ee fe");
const indexed = opcodes("1d 1e 3d 3e 5d 5e 7d 7e 99 9d b9 bc bd be d9 dd de f9 fd fe");

function accessInventory(bytes: Buffer) {
  const result: { address: number; last: number; read: boolean; write: boolean }[] = [];
  for (let offset = 0; offset < bytes.length; ) {
    const opcode = bytes[offset]!;
    const width = one.has(opcode) ? 1 : two.has(opcode) ? 2 : three.has(opcode) ? 3 : 0;
    expect(width, `Documented startup instruction at byte ${offset}`).toBeGreaterThan(0);
    expect(offset + width).toBeLessThanOrEqual(bytes.length);
    if (width === 3 && (reads.has(opcode) || writes.has(opcode))) {
      const address = bytes[offset + 1]! | (bytes[offset + 2]! << 8);
      result.push({
        address,
        last: address + (indexed.has(opcode) ? 255 : 0),
        read: reads.has(opcode),
        write: writes.has(opcode),
      });
    }
    offset += width;
  }
  return result;
}

function expectFullDisplayOwnership(artifacts: Artifacts) {
  const entry = accessInventory(startupBytes(artifacts, "code.startup.entry"));
  const restore = accessInventory(startupBytes(artifacts, "code.startup.restore"));
  const covers = (list: typeof entry, address: number, operation: "read" | "write") =>
    list.some((access) => access[operation] && address >= access.address && address <= access.last);
  for (const address of [...REGISTER_ADDRESSES, ...POINTER_ADDRESSES]) {
    expect(covers(entry, address, "read"), `Capture display byte ${address}`).toBe(true);
    expect(covers(restore, address, "write"), `Restore display byte ${address}`).toBe(true);
  }
  for (const address of DEFAULTS.keys())
    expect(covers(entry, address, "write"), `Establish display default ${address}`).toBe(true);
}

describe("Conservative display-dependent startup", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const [name, source] of CASES) {
      it(`${profile}: keeps full display startup for ${name}`, async () => {
        const artifacts = await buildProfileSource(source, profile);
        expectFullDisplayOwnership(artifacts);
      }, 30_000);
    }

    it(`${profile}: observes an imported helper's display dependence through an alias`, async () => {
      await withLibraryBuild(
        `module Game; import { draw as paint } from Renderer;
         function main(): void { paint(); }`,
        `module Renderer; export function draw(): void { poke($0400, 1); }`,
        profile,
        async (artifacts) => {
          expectFullDisplayOwnership(artifacts);
        },
      );
    }, 30_000);

    it(`${profile}: establishes every promised display default and restores captured display bytes`, async () => {
      await withLibraryBuild(
        `module Game; function main(): void { poke($D020, 3); }`,
        "module Auxiliary;",
        profile,
        async (artifacts, built) => {
          await withLibraryVice(
            built,
            artifacts,
            profile,
            async (monitor, stopAt) => {
              for (const [index, address] of REGISTER_ADDRESSES.entries())
                await monitor.writeIo(address, Uint8Array.of((index * 17 + 5) & 255));
              await monitor.writeMemory(
                0x07f8,
                Uint8Array.from(POINTER_ADDRESSES.map((_, index) => index * 13 + 7)),
              );
              const before = new Map<number, number>();
              for (const address of REGISTER_ADDRESSES)
                before.set(address, (await monitor.readIo(address, address))[0]!);
              const pointers = [...(await monitor.readMemory(0x07f8, 0x07ff))];
              await stopAt(libraryEntry(artifacts, "src/game.blend::Game.main"));
              for (const [address, value] of DEFAULTS) {
                const mask =
                  address === 0xd018 ? 0xfe : address === 0xd020 || address === 0xd021 ? 15 : 255;
                expect(
                  (await monitor.readIo(address, address))[0]! & mask,
                  `Display default ${address}`,
                ).toBe(value);
              }
              // The pinned SYS return has not yet executed BASIC-side register stores.
              await stopAt(0xe147);
              for (const address of REGISTER_ADDRESSES)
                expect(
                  (await monitor.readIo(address, address))[0],
                  `Restore display byte ${address}`,
                ).toBe(before.get(address));
              expect([...(await monitor.readMemory(0x07f8, 0x07ff))]).toEqual(pointers);
            },
            [false, false],
          );
        },
      );
    }, 90_000);
  }
});

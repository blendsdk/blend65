import { describe, expect, it } from "vitest";
import { profileRecord, profileRecords } from "./profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryEntry,
  libraryFunctionBytes,
  sourceLibraryProfiles,
  withLibraryBuild,
} from "./source-library-fixture.js";

// Documented NMOS instruction costs. Calls include their own six cycles; called bodies
// are charged separately. This bounded straight-line scan is not a machine emulator.
const costs = new Map<number, readonly [number, number]>([
  [0xad, [3, 4]], // LDA absolute
  [0xa5, [2, 3]], // LDA zero page
  [0x8d, [3, 4]], // STA absolute
  [0x85, [2, 3]], // STA zero page
  [0x20, [3, 6]], // JSR absolute
  [0x60, [1, 6]], // RTS
  [0xea, [1, 2]], // NOP, including any charged padding
]);

const probes = [
  {
    name: "unsigned read",
    functions: "function sink(value: byte): void { poke($3200, value); }",
    argument: "peek($3300)",
    produced: false,
  },
  {
    name: "same-width signed reinterpretation",
    functions: "function sink(value: sbyte): void { poke($3200, byte(value)); }",
    argument: "sbyte(peek($3300))",
    produced: false,
  },
  {
    name: "ordinary produced byte",
    functions: `function sink(value: byte): void { poke($3200, value); }
function producer(): byte { return peek($3300); }`,
    argument: "producer()",
    produced: true,
  },
];

describe("sole adjacent byte argument delivery has no expression-only home", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const probe of probes) {
      it(`${profile}: ${probe.name}`, async () => {
        const source = `module Game;
${probe.functions}
function deliver(): void { sink(${probe.argument}); }
function step(): void { poke($3203, $5A); }
function observed(): void { poke($3202, $A5); }
function main(): void { while (true) { step(); deliver(); observed(); } }
`;
        await withLibraryBuild(source, "module Library;", profile, async (artifacts) => {
          expectLibraryAccounting(artifacts);
          const functions = [
            "src/game.blend::Game.deliver",
            "src/game.blend::Game.sink",
            ...(probe.produced ? ["src/game.blend::Game.producer"] : []),
          ];
          const limits = [
            [10, probe.produced ? 22 : 20],
            [7, 14],
            [4, 10],
          ];
          const instructions = new Map<string, { opcode: number; operand?: number }[]>();
          let bodyCycles = 0;
          let bodyBytes = 0;
          for (const [index, name] of functions.entries()) {
            const bytes = libraryFunctionBytes(artifacts, name);
            // Measure the whole published body before asking the small cost table to decode it.
            expect(bytes.length, `${name}: complete bytes`).toBeLessThanOrEqual(limits[index]![0]!);
            bodyBytes += bytes.length;
            const decoded: { opcode: number; operand?: number }[] = [];
            let cycles = 0;
            for (let offset = 0; offset < bytes.length; ) {
              const opcode = bytes[offset]!;
              const cost = costs.get(opcode);
              expect(cost, `${name}: documented instruction at byte ${offset}`).toBeDefined();
              if (cost === undefined)
                throw new Error("Unexpected instruction in bounded call leaf");
              const [width, nominal] = cost;
              expect(offset + width).toBeLessThanOrEqual(bytes.length);
              decoded.push({
                opcode,
                ...(width > 1
                  ? {
                      operand: bytes[offset + 1]! | (width === 3 ? bytes[offset + 2]! << 8 : 0),
                    }
                  : {}),
              });
              cycles += nominal;
              offset += width;
            }
            expect(decoded.at(-1)?.opcode, `${name}: complete ordinary return`).toBe(0x60);
            expect(decoded.filter((entry) => entry.opcode === 0x60)).toHaveLength(1);
            expect(cycles, `${name}: owner cycles`).toBeLessThanOrEqual(limits[index]![1]!);
            bodyCycles += cycles;
            instructions.set(name, decoded);
          }
          // LDA source; STA parameter; JSR sink; RTS = 10 bytes/20 cycles.
          // Replacing LDA by JSR producer gives 10/22, plus the separately charged producer.
          expect(bodyBytes).toBeLessThanOrEqual(probe.produced ? 21 : 17);
          expect(bodyCycles).toBeLessThanOrEqual(probe.produced ? 46 : 34);
          const caller = instructions.get("src/game.blend::Game.deliver")!;
          const sink = instructions.get("src/game.blend::Game.sink")!;
          const loads = (code: typeof caller) =>
            code.filter((entry) => entry.opcode === 0xad || entry.opcode === 0xa5);
          const stores = (code: typeof caller) =>
            code.filter((entry) => entry.opcode === 0x8d || entry.opcode === 0x85);
          const calls = caller.filter((entry) => entry.opcode === 0x20);
          expect(calls.map((entry) => entry.operand)).toEqual([
            ...(probe.produced ? [libraryEntry(artifacts, "src/game.blend::Game.producer")] : []),
            libraryEntry(artifacts, "src/game.blend::Game.sink"),
          ]);
          expect(loads(caller).map((entry) => entry.operand)).toEqual(
            probe.produced ? [] : [0x3300],
          );
          expect(stores(caller)).toHaveLength(1);
          expect(loads(sink)).toHaveLength(1);
          const home = stores(caller)[0]!.operand!;
          expect(loads(sink)[0]!.operand).toBe(home);
          expect(stores(sink).map((entry) => entry.operand)).toEqual([0x3200]);
          expect(sink.filter((entry) => entry.opcode === 0x20)).toHaveLength(0);
          if (probe.produced) {
            const producer = instructions.get("src/game.blend::Game.producer")!;
            expect(loads(producer).map((entry) => entry.operand)).toEqual([0x3300]);
            expect(stores(producer)).toHaveLength(0);
            expect(producer.filter((entry) => entry.opcode === 0x20)).toHaveLength(0);
          }

          const intervals = profileRecords(artifacts.memory.intervals);
          const homes = intervals.filter((interval) =>
            ["sfa", "zeroPage", "scratch"].includes(String(interval.kind)),
          );
          const owners = (interval: Record<string, unknown>): string[] => {
            const id = profileRecord(interval.owner).id;
            if (typeof id !== "string") throw new TypeError("Storage requires a published owner");
            if (!id.startsWith("overlay:")) return [id];
            const names: unknown = JSON.parse(id.slice("overlay:".length));
            if (!Array.isArray(names) || names.some((name) => typeof name !== "string"))
              throw new TypeError("Overlay storage requires complete source identities");
            return names as string[];
          };
          for (const name of [
            "src/game.blend::Game.deliver",
            ...(probe.produced ? ["src/game.blend::Game.producer"] : []),
          ])
            expect(
              homes.filter((interval) => owners(interval).includes(name)),
              name,
            ).toHaveLength(0);
          const parameter = homes.filter((interval) =>
            owners(interval).includes("src/game.blend::Game.sink"),
          );
          expect(parameter).toHaveLength(1);
          expect(parameter[0]).toMatchObject({ start: home, end: home + 1, size: 1 });

          // The PRG payload includes startup, callers, markers, and all resident code.
          // Physical overlays are charged once; the declared parameter is never a free register ABI.
          const resources = profileRecords(profileRecord(artifacts.costs.totals).resources);
          for (const id of ["residentRam", "zeroPage", "hardwareStack", "scratch"]) {
            const matches = resources.filter((resource) => resource.id === id);
            expect(matches, id).toHaveLength(1);
            expect(matches[0]!.kind).toBe("standard");
            expect(Number.isInteger(matches[0]!.value)).toBe(true);
            expect(matches[0]!.value).toBeGreaterThanOrEqual(0);
          }
          const resource = (id: string) =>
            resources.find((entry) => entry.id === id)!.value as number;
          expect(resource("residentRam")).toBeGreaterThanOrEqual(artifacts.prg.length - 2);
          expect(
            resource(parameter[0]!.resourceClass === "zeroPage" ? "zeroPage" : "residentRam"),
          ).toBeGreaterThanOrEqual(1);
          const domains = profileRecords(artifacts.memory.stackDomains);
          expect(domains.length).toBeGreaterThan(0);
          for (const domain of domains) {
            expect(Number.isInteger(domain.peakBytes)).toBe(true);
            expect(domain.peakBytes).toBeGreaterThanOrEqual(0);
            expect(Array.isArray(domain.route)).toBe(true);
          }
          // Main -> deliver -> sink/producer has two live ordinary return addresses.
          expect(resource("hardwareStack")).toBeGreaterThanOrEqual(4);
        });
      });
    }
  }
});

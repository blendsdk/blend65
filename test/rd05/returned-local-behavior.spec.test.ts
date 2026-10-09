import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import type { ViceMonitor } from "../m1/vice-monitor.js";
import { profileRecords, readProfileArtifacts, withProfileProject } from "./profile-fixture.js";
import {
  libraryEntry,
  libraryGlobalAddress,
  libraryStartup,
  sourceLibraryProfiles,
  withLibraryVice,
} from "./source-library-fixture.js";
import type { LibraryArtifacts } from "./source-library-fixture.js";

const SAMPLE_TYPE = `struct Sample {
  values: byte[8]; first: byte; second: byte; quality: byte;
}`;
const PAIR_TYPE = "struct Pair { x: byte; y: byte; }";
const SAMPLE_INITIALIZER = "{ values: [1,2,3,4,5,6,7,8], first: 9, second: 10, quality: 2 }";
const PAIR_FACTORY = `function make(source: const Pair): Pair {
  let r: Pair = { x: 1, y: 2 };
  r.y = source.x;
  return r;
}`;

/** A completed source value published after its return for independent inspection. */
interface Capture {
  declaration: string;
  expected: readonly number[];
}

/** Source-driven expectations for complete returned values and their consumers. */
interface ValueFixture {
  name: string;
  source: string;
  captures: readonly Capture[];
  singleOrdinaryMake?: boolean;
}

const valueFixtures: readonly ValueFixture[] = [
  {
    // A return must deliver every byte, including writes after initialization.
    name: "should deliver the complete initialized and updated returned local",
    source: `module Game;
${SAMPLE_TYPE}
let observed: Sample;
function sample(): Sample {
  let r: Sample = ${SAMPLE_INITIALIZER};
  r.values[0] = 17;
  return r;
}
function main(): void {
  let received: Sample = sample();
  observed = received;
}`,
    captures: [
      { declaration: "let observed: Sample;", expected: [17, 2, 3, 4, 5, 6, 7, 8, 9, 10, 2] },
    ],
  },
  {
    // The first result stays live across the second call and both return paths.
    name: "should preserve distinct results from early and final return paths",
    source: `module Game;
${SAMPLE_TYPE}
let observedFirst: Sample;
let observedSecond: Sample;
function sample(choice: byte): Sample {
  let r: Sample = ${SAMPLE_INITIALIZER};
  if (choice == 0) { return r; }
  r.values[7] = 23;
  return r;
}
function main(): void {
  let first: Sample = sample(0);
  let second: Sample = sample(1);
  observedFirst = first;
  observedSecond = second;
}`,
    captures: [
      { declaration: "let observedFirst: Sample;", expected: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 2] },
      { declaration: "let observedSecond: Sample;", expected: [1, 2, 3, 4, 5, 6, 7, 23, 9, 10, 2] },
    ],
  },
  {
    // A const aggregate argument can alias the assignment's return destination.
    name: "should read the original aliased input before delivering the result",
    source: `module Game;
${PAIR_TYPE}
let observed: Pair;
${PAIR_FACTORY}
function main(): void {
  let v: Pair = { x: 7, y: 9 };
  v = make(v);
  observed = v;
}`,
    captures: [{ declaration: "let observed: Pair;", expected: [1, 7] }],
  },
  {
    // Both callers must preserve values even when only one destination is fresh.
    name: "should preserve both fresh and aliased results from the same function",
    source: `module Game;
${PAIR_TYPE}
let observedFresh: Pair;
let observedAliased: Pair;
${PAIR_FACTORY}
function main(): void {
  let v: Pair = { x: 7, y: 9 };
  let fresh: Pair = make(v);
  v = make(v);
  observedFresh = fresh;
  observedAliased = v;
}`,
    captures: [
      { declaration: "let observedFresh: Pair;", expected: [1, 7] },
      { declaration: "let observedAliased: Pair;", expected: [1, 7] },
    ],
    singleOrdinaryMake: true,
  },
  {
    // Inner fields remain readable after an outer write; the outer root survives.
    name: "should preserve the outer local and inner result across a nested call",
    source: `module Game;
${SAMPLE_TYPE}
${PAIR_TYPE}
let observed: Sample;
function makePair(): Pair {
  let r: Pair = { x: 31, y: 47 };
  return r;
}
function sample(): Sample {
  let r: Sample = { values: [1,2,3,4,5,6,7,8], first: 31, second: 47, quality: 2 };
  let inner: Pair = makePair();
  r.values[4] = inner.y;
  r.first = inner.x;
  r.second = inner.y;
  return r;
}
function main(): void {
  let received: Sample = sample();
  observed = received;
}`,
    captures: [
      { declaration: "let observed: Sample;", expected: [1, 2, 3, 4, 47, 6, 7, 8, 31, 47, 2] },
    ],
  },
  {
    // Borrowing each completed loop-local result must remain legal and ordered.
    name: "should allow an ordinary borrowed reader after each repeated return",
    source: `module Game;
${PAIR_TYPE}
let observed: byte[4];
function make(index: byte): Pair {
  let r: Pair = { x: 10, y: 20 };
  r.x = index;
  return r;
}
function read(source: const Pair): byte { return source.x + source.y; }
function main(): void {
  for (let index: byte = 0; index < 4; index += 1) {
    let received: Pair = make(index);
    observed[index] = read(received);
  }
}`,
    captures: [{ declaration: "let observed: byte[4];", expected: [20, 21, 22, 23] }],
  },
];

/** Check and build through public exports, then inspect the real selected-profile runtime. */
async function withReturnedValue(
  source: string,
  profile: (typeof sourceLibraryProfiles)[number],
  inspect: (
    monitor: ViceMonitor,
    artifacts: LibraryArtifacts,
    stopAt: (address: number) => Promise<void>,
  ) => Promise<void>,
): Promise<void> {
  await withProfileProject(source, profile, async (project, root) => {
    const options = { cwd: root, project, target: profile };
    const checked = await checkProject(options);
    expect(checked.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(checked.kind).toBe("success");
    const built = await buildProject(options);
    expect(built.diagnostics.filter((diagnostic) => diagnostic.severity === "error")).toEqual([]);
    expect(built.kind).toBe("success");
    if (built.kind !== "success") {
      throw new Error("The legal returned-value source must build successfully.");
    }
    const artifacts = await readProfileArtifacts(built);
    await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
      await inspect(monitor, artifacts, stopAt);
    });
  });
}

describe.sequential("returned-local value, effect and lifetime preservation", () => {
  for (const profile of sourceLibraryProfiles) {
    describe(profile, () => {
      for (const fixture of valueFixtures) {
        it(
          fixture.name,
          async () => {
            await withReturnedValue(fixture.source, profile, async (monitor, artifacts, stopAt) => {
              if (fixture.singleOrdinaryMake) {
                const functions = profileRecords(artifacts.debug.functions).filter(
                  (entry) => entry.qualifiedName === "src/game.blend::Game.make",
                );
                expect(functions).toHaveLength(1);
                const variants = profileRecords(functions[0]?.entryVariants);
                expect(variants.map((variant) => variant.kind)).toEqual(["ordinary"]);
                const locals = profileRecords(artifacts.debug.symbols).filter(
                  (symbol) =>
                    symbol.kind === "local" &&
                    symbol.scope === "src/game.blend::Game.make" &&
                    symbol.byteWidth === 2,
                );
                expect(locals).toHaveLength(1);
                expect(locals[0]?.locationIndexes).toEqual(
                  expect.arrayContaining([expect.any(Number)]),
                );
                expect(profileRecords(artifacts.memory.intervals)).toContainEqual(
                  expect.objectContaining({
                    kind: "sfa",
                    size: 2,
                    owner: expect.objectContaining({
                      kind: "function",
                      id: "src/game.blend::Game.make",
                    }),
                  }),
                );
              }
              await stopAt(libraryStartup(artifacts, "startup.restore"));
              for (const capture of fixture.captures) {
                const address = libraryGlobalAddress(
                  artifacts,
                  fixture.source,
                  capture.declaration,
                  capture.expected.length,
                  "src/game.blend",
                );
                expect(
                  Array.from(
                    await monitor.readMemory(address, address + capture.expected.length - 1),
                  ),
                ).toEqual(capture.expected);
              }
            });
          },
          60_000,
        );
      }
      // Volatile return delivery preserves the single device read and following write.
      it("should read once then write the observed byte while returning every field", async () => {
        const source = `module Game;
${SAMPLE_TYPE}
let observed: Sample;
function sample(): Sample {
  let r: Sample = { values: [0,0,0,0,0,0,0,0], first: 0, second: 0, quality: 2 };
  r.values[0] = peek($D020);
  return r;
}
function main(): void {
  let received: Sample = sample();
  poke($D021, received.values[0]);
  observed = received;
}`;
        await withReturnedValue(source, profile, async (monitor, artifacts, stopAt) => {
          await stopAt(libraryEntry(artifacts, "src/game.blend::Game.sample"));
          await monitor.writeIo(0xd020, Uint8Array.of(6));
          const observedByte = (await monitor.readIo(0xd020, 0xd020))[0];
          expect(observedByte).toBeTypeOf("number");
          if (observedByte === undefined) {
            throw new Error("The independent device observation must contain one byte.");
          }
          expect(observedByte & 15).toBe(6);
          const readTrace = await monitor.setAccessTracepoint(0xd020, "load");
          const writeTrace = await monitor.setAccessTracepoint(0xd021, "store");
          monitor.takeCheckpointHits();
          try {
            await stopAt(libraryStartup(artifacts, "startup.restore"));
            const accesses = monitor
              .takeCheckpointHits()
              .filter((identity) => identity === readTrace || identity === writeTrace);
            expect(accesses).toEqual([readTrace, writeTrace]);
            expect(Array.from(await monitor.readIo(0xd021, 0xd021))).toEqual([observedByte]);
            const address = libraryGlobalAddress(
              artifacts,
              source,
              "let observed: Sample;",
              11,
              "src/game.blend",
            );
            expect(Array.from(await monitor.readMemory(address, address + 10))).toEqual([
              observedByte,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              0,
              2,
            ]);
          } finally {
            await monitor.deleteCheckpoint(readTrace);
            await monitor.deleteCheckpoint(writeTrace);
          }
        });
      }, 60_000);
    });
  }
});

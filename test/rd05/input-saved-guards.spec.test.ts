import { describe, expect, it } from "vitest";
import {
  libraryEntry,
  libraryGlobalAddress,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

const guardedDeclaration = "let guarded: Guarded";
const argumentsDeclaration = "let arguments: byte[4]";
const answersDeclaration = "let answers: byte[74]";
const library = `module SavedGuards;
import { InputSnapshot, SnapshotQuality, Key,
         JoystickPort, JoystickControl, keyState, joystickState } from c64.input;
struct Guarded { before: byte[256]; snapshot: InputSnapshot; after: byte[256]; }
${guardedDeclaration} = {
  before: [0; 0],
  snapshot: { rows: [255, 255, 255, 255, 255, 255, 255, 255],
              joystick1: 255, joystick2: 255, quality: SnapshotQuality.COMPLETE },
  after: [0; 0]
};
${argumentsDeclaration} = [0, 0, 1, 0];
${answersDeclaration};
let completedCount: word = 0;
export function query(): void {
  if (arguments[0] == 0) {
    for (let key: byte = 0; key < 64; key += 1) {
      answers[key] = keyState(guarded.snapshot, Key(key));
    }
    for (let control: byte = 0; control < 5; control += 1) {
      answers[64 + control] = joystickState(guarded.snapshot, JoystickPort.PORT_1, JoystickControl(control));
      answers[69 + control] = joystickState(guarded.snapshot, JoystickPort.PORT_2, JoystickControl(control));
    }
  } else if (arguments[0] == 1) {
    answers[0] = keyState(guarded.snapshot, Key(arguments[1]));
  } else {
    answers[0] = joystickState(guarded.snapshot, JoystickPort(arguments[2]), JoystickControl(arguments[3]));
  }
}
export function completed(): void { completedCount += 1; }
`;
const source = `module Game;
import { query, completed } from SavedGuards;
function main(): void { asm_sei(); while (true) { query(); completed(); } }
`;

/** Dynamic caller values; mode selects all named queries, one key, or one joystick query. */
type GuardCase = readonly [
  name: string,
  quality: number,
  mode: number,
  key: number,
  port: number,
  control: number,
];
const cases: readonly GuardCase[] = [
  ...[1, 2, 3, 255].map((quality) => [`quality ${quality}`, quality, 0, 0, 1, 0] as const),
  ...[64, 255].map((key) => [`unnamed key ${key}`, 0, 1, key, 1, 0] as const),
  ...[0, 3, 255].flatMap((port) =>
    Array.from(
      { length: 5 },
      (_, control) => [`unnamed port ${port}, control ${control}`, 0, 2, 0, port, control] as const,
    ),
  ),
  ...[5, 255].flatMap((control) =>
    [1, 2].map(
      (port) => [`port ${port}, unnamed control ${control}`, 0, 2, 0, port, control] as const,
    ),
  ),
];

describe("saved input quality and argument guards", () => {
  // Invalid enums are legal source values but cannot authorize a query, even when all pins are HIGH.
  it.each(sourceLibraryProfiles)(
    "should guard dynamic quality and arguments before out-of-object access on %s",
    async (profile) => {
      await withLibraryBuild(source, library, profile, async (artifacts, built) => {
        const guarded = libraryGlobalAddress(artifacts, library, guardedDeclaration, 523);
        const saved = guarded + 256;
        const argumentsAddress = libraryGlobalAddress(artifacts, library, argumentsDeclaration, 4);
        const answers = libraryGlobalAddress(artifacts, library, answersDeclaration, 74);
        const query = libraryEntry(artifacts, "src/library.blend::SavedGuards.query");
        const completed = libraryEntry(artifacts, "src/library.blend::SavedGuards.completed");
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          // Startup initializes ordinary guard data first; trace installation occurs while stopped.
          await stopAt(query);
          const checkpoints = new Set<number>();
          try {
            for (let index = 0; index < 256; index += 1)
              for (const address of [guarded + index, saved + 11 + index])
                for (const operation of ["load", "store"] as const)
                  checkpoints.add(await monitor.setAccessTracepoint(address, operation));
            for (const [name, quality, mode, key, port, control] of cases) {
              const bytes = Uint8Array.from([...Array.from({ length: 10 }, () => 255), quality]);
              await monitor.writeMemory(saved, bytes);
              await monitor.writeMemory(
                argumentsAddress,
                Uint8Array.from([mode, key, port, control]),
              );
              monitor.takeCheckpointHits();
              await stopAt(completed);
              const hits = monitor.takeCheckpointHits().filter((id) => checkpoints.has(id));
              expect(hits, name).toEqual([]);
              const count = mode === 0 ? 74 : 1;
              expect([...(await monitor.readMemory(answers, answers + count - 1))], name).toEqual(
                Array.from({ length: count }, () => 2),
              );
              expect([...(await monitor.readMemory(saved, saved + 10))], name).toEqual([...bytes]);
              await stopAt(query);
            }
          } finally {
            for (const checkpoint of checkpoints) await monitor.deleteCheckpoint(checkpoint);
          }
        });
      });
    },
    1_200_000,
  );
});

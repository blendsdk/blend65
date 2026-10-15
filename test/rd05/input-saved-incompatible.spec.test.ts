import { describe, expect, it } from "vitest";
import {
  libraryEntry,
  libraryGlobalAddress,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

const savedDeclaration = "let saved: InputSnapshot";
const answersDeclaration = "let answers: byte[74]";
const library = `module SavedIncompatible;
import { InputSnapshot, SnapshotQuality, Key,
         JoystickPort, JoystickControl, keyState, joystickState } from c64.input;
${savedDeclaration} = {
  rows: [255, 255, 255, 255, 255, 255, 255, 255],
  joystick1: 255, joystick2: 255, quality: SnapshotQuality.COMPLETE
};
${answersDeclaration};
let completedCount: word = 0;
export function query(): void {
  for (let key: byte = 0; key < 64; key += 1) {
    answers[key] = keyState(saved, Key(key));
  }
  for (let control: byte = 0; control < 5; control += 1) {
    answers[64 + control] = joystickState(saved, JoystickPort.PORT_1, JoystickControl(control));
    answers[69 + control] = joystickState(saved, JoystickPort.PORT_2, JoystickControl(control));
  }
}
export function completed(): void { completedCount += 1; }
`;
const source = `module Game;
import { query, completed } from SavedIncompatible;
function main(): void { while (true) { query(); completed(); } }
`;

/** An explicitly incompatible complete observation, including both released-drive ground masks. */
type InvalidObservation = readonly [
  name: string,
  rows: readonly number[],
  groundedPa: number,
  groundedPb: number,
];
const repeated = (value: number) => Array.from({ length: 8 }, () => value);
const missingBaseline: readonly InvalidObservation[] = Array.from({ length: 8 }, (_, column) => {
  const rows = repeated(0xfe);
  rows[column] = 0xff;
  return [`PB0 baseline absent from column ${column}`, rows, 0, 1] as const;
});
const cases: readonly InvalidObservation[] = [
  // One contradictory component invalidates inferred LOW answers even at the remote D switch.
  ["D low beside incompatible components", [0xfc, 0xfd, 0xfb, 0xff, 0xff, 0xff, 0xff, 0xff], 0, 0],
  ...missingBaseline,
  // A PA pin already grounded cannot expose a new PB ground when that column is driven.
  ["grounded PA0 adds PB0 low", [0xfe, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff], 1, 0],
  ["grounded PA7 adds PB5 low", [0xef, 0xef, 0xef, 0xef, 0xef, 0xef, 0xef, 0xcf], 0x81, 0x10],
  // Overlapping floating components cannot disagree about their complete reachable PB endpoint set.
  [
    "overlapping unequal components at columns 6 and 7",
    [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfc, 0xf9],
    0,
    0,
  ],
  // Opposite grounded endpoints exist, but none of these high-numbered pins can supply direct ground.
  ["no eligible source for grounded endpoints", repeated(0x7f), 0xe0, 0x80],
  // An eligible source on the same port cannot reach an ineligible pin without an opposite endpoint.
  ["PA5 grounded without any PB ground", repeated(0xff), 0x21, 0],
  ["PB5 grounded without any PA ground", repeated(0xde), 0, 0x21],
  ["PA7 grounded beside eligible PA4 without PB ground", repeated(0xff), 0x90, 0],
  ["PB7 grounded beside eligible PB4 without PA ground", repeated(0x6f), 0, 0x90],
];

/** Direct HIGH observations remain decisive; incompatible bytes cannot justify any LOW inference. */
function expectedAnswers(rows: readonly number[], joystick1: number, joystick2: number) {
  const answers = Array.from({ length: 64 }, (_, key) =>
    (rows[Math.floor(key / 8)]! & (1 << (key % 8))) !== 0 ? 1 : 2,
  );
  for (const raw of [joystick1, joystick2])
    for (let control = 0; control < 5; control += 1)
      answers.push((raw & (1 << control)) !== 0 ? 1 : 2);
  return answers;
}

describe("saved input incompatible observations", () => {
  // Every named query respects direct evidence without treating an empty explanation set as agreement.
  it.each(sourceLibraryProfiles)(
    "should preserve direct HIGH answers and reject LOW inference for incompatible snapshots on %s",
    async (profile) => {
      await withLibraryBuild(source, library, profile, async (artifacts, built) => {
        const saved = libraryGlobalAddress(artifacts, library, savedDeclaration, 11);
        const answers = libraryGlobalAddress(artifacts, library, answersDeclaration, 74);
        const query = libraryEntry(artifacts, "src/library.blend::SavedIncompatible.query");
        const completed = libraryEntry(artifacts, "src/library.blend::SavedIncompatible.completed");
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          for (const [name, rows, pa, pb] of cases) {
            const joystick1 = 255 ^ pb;
            const joystick2 = 255 ^ pa;
            const bytes = Uint8Array.from([...rows, joystick1, joystick2, 0]);
            await stopAt(query);
            await monitor.writeMemory(saved, bytes);
            await stopAt(completed);
            expect([...(await monitor.readMemory(answers, answers + 73))], name).toEqual(
              expectedAnswers(rows, joystick1, joystick2),
            );
            expect([...(await monitor.readMemory(saved, saved + 10))], name).toEqual([...bytes]);
          }
        });
      });
    },
    1_200_000,
  );
});

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
const library = `module SavedGrounded;
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
import { query, completed } from SavedGrounded;
function main(): void { while (true) { query(); completed(); } }
`;

/** Exact grounded observations and named-answer ordinals; unlisted answers are observed up. */
type GroundedCase = readonly [
  name: string,
  groundedPa: number,
  groundedPb: number,
  down: readonly number[],
  uncertain: readonly number[],
];

// Answer ordinals are keys 0..63, then port-1 controls 64..68 and port-2 controls 69..73.
// PA/PB masks describe released-drive pin observations, including propagated ineligible endpoints.
const cases: readonly GroundedCase[] = [
  // With one eligible source, every star contact and that source are necessary.
  ["sole PB0 source", 32, 33, [40, 45, 64], []],
  ["two eligible PB leaves", 32, 3, [], [40, 41, 64, 65]],
  ["sole PA0 source", 33, 32, [5, 45, 69], []],
  ["two eligible PA leaves", 3, 32, [], [5, 13, 69, 70]],
  // PA0 and PB0 are distinct eligible sources, despite sharing their bit ordinal.
  ["distinct PA0 and PB0 sources", 1, 1, [], [0, 64, 69]],
  ["empty PA baseline", 0, 1, [64], []],
  ["empty PB baseline", 1, 0, [69], []],
  // Endpoint 4 can supply ground; endpoint 7 must be grounded through its star contact.
  ["sole PB4 source with ineligible endpoints", 128, 144, [60, 63, 68], []],
  ["sole PA4 source with ineligible endpoints", 144, 128, [39, 63, 73], []],
  // Two eligible leaves can explain one another, but the ineligible leaf still needs its edge.
  ["mandatory PB7 leaf beside eligible leaves", 32, 131, [47], [40, 41, 64, 65]],
  ["mandatory PA7 leaf beside eligible leaves", 131, 32, [61], [5, 13, 69, 70]],
  ["distinct PA4 and PB4 sources", 16, 16, [], [36, 68, 73]],
];

describe("saved input grounded contact components", () => {
  // These exact examples independently exercise both star orientations and both joystick ports.
  it.each(sourceLibraryProfiles)(
    "should infer exact grounded certainty without modifying the saved observation on %s",
    async (profile) => {
      await withLibraryBuild(source, library, profile, async (artifacts, built) => {
        const saved = libraryGlobalAddress(artifacts, library, savedDeclaration, 11);
        const answers = libraryGlobalAddress(artifacts, library, answersDeclaration, 74);
        const query = libraryEntry(artifacts, "src/library.blend::SavedGrounded.query");
        const completed = libraryEntry(artifacts, "src/library.blend::SavedGrounded.completed");
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          for (const [name, pa, pb, down, uncertain] of cases) {
            // No floating component adds new lows: every driven row already contains the PB grounds.
            const bytes = Uint8Array.from([
              ...Array.from({ length: 8 }, () => 255 ^ pb),
              255 ^ pb,
              255 ^ pa,
              0,
            ]);
            const expected = Array.from({ length: 74 }, () => 1);
            down.forEach((index) => {
              expected[index] = 0;
            });
            uncertain.forEach((index) => {
              expected[index] = 2;
            });
            await stopAt(query);
            await monitor.writeMemory(saved, bytes);
            await stopAt(completed);
            expect([...(await monitor.readMemory(answers, answers + 73))], name).toEqual(expected);
            expect([...(await monitor.readMemory(saved, saved + 10))], name).toEqual([...bytes]);
          }
        });
      });
    },
    1_200_000,
  );
});

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
const library = `module SavedComponents;
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
import { query, completed } from SavedComponents;
function main(): void {
  while (true) { query(); completed(); }
}
`;

/** Endpoints in one floating connected contact component, with no direct joystick grounds. */
interface ContactComponent {
  readonly columns: readonly number[];
  readonly rows: readonly number[];
}

/** One complete saved observation containing mutually disjoint contact components. */
interface ComponentCase {
  readonly name: string;
  readonly components: readonly ContactComponent[];
}

const allEndpoints = Array.from({ length: 8 }, (_, index) => index);
const cases: readonly ComponentCase[] = [
  { name: "first 2 by 2 rectangle", components: [{ columns: [0, 1], rows: [0, 1] }] },
  { name: "boundary 2 by 2 rectangle", components: [{ columns: [0, 7], rows: [0, 7] }] },
  { name: "last 2 by 2 rectangle", components: [{ columns: [6, 7], rows: [6, 7] }] },
  { name: "first-column star", components: [{ columns: [0], rows: [0, 7] }] },
  { name: "last-column star", components: [{ columns: [7], rows: [0, 7] }] },
  { name: "first-row star", components: [{ columns: [0, 7], rows: [0] }] },
  { name: "last-row star", components: [{ columns: [0, 7], rows: [7] }] },
  { name: "three-row star", components: [{ columns: [7], rows: [0, 3, 7] }] },
  { name: "three-column star", components: [{ columns: [0, 3, 7], rows: [7] }] },
  { name: "2 by 3 rectangle", components: [{ columns: [0, 7], rows: [0, 3, 7] }] },
  { name: "3 by 2 rectangle", components: [{ columns: [0, 3, 7], rows: [0, 7] }] },
  { name: "3 by 3 rectangle", components: [{ columns: [0, 3, 7], rows: [0, 3, 7] }] },
  { name: "full matrix", components: [{ columns: allEndpoints, rows: allEndpoints }] },
  {
    name: "column star beside rectangle",
    components: [
      { columns: [0], rows: [0, 7] },
      { columns: [6, 7], rows: [1, 6] },
    ],
  },
  {
    name: "row star beside rectangle",
    components: [
      { columns: [0, 7], rows: [0] },
      { columns: [1, 6], rows: [6, 7] },
    ],
  },
];

/** Produce electrical observations and answers from floating contact-component connectivity. */
function observation(testCase: ComponentCase) {
  const rows = Array.from({ length: 8 }, () => 255);
  const answers = Array.from({ length: 74 }, () => 1);
  for (const component of testCase.components) {
    // A sole endpoint on either side requires every contact to connect the opposite endpoints.
    // Otherwise a connected spanning contact graph can omit any chosen rectangle edge.
    const state = component.columns.length === 1 || component.rows.length === 1 ? 0 : 2;
    for (const column of component.columns)
      for (const row of component.rows) {
        rows[column] = rows[column]! & (255 ^ (1 << row));
        answers[column * 8 + row] = state;
      }
  }
  // Released raw pins rule out every joystick control; untouched HIGH key positions are also up.
  return { bytes: Uint8Array.from([...rows, 255, 255, 0]), answers };
}

describe("saved input floating contact components", () => {
  // Connectivity determines certainty independently for each component and preserves the saved bytes.
  it.each(sourceLibraryProfiles)(
    "should distinguish necessary star contacts from optional rectangle contacts on %s",
    async (profile) => {
      await withLibraryBuild(source, library, profile, async (artifacts, built) => {
        const saved = libraryGlobalAddress(artifacts, library, savedDeclaration, 11);
        const answers = libraryGlobalAddress(artifacts, library, answersDeclaration, 74);
        const query = libraryEntry(artifacts, "src/library.blend::SavedComponents.query");
        const completed = libraryEntry(artifacts, "src/library.blend::SavedComponents.completed");
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          for (const testCase of cases) {
            const expected = observation(testCase);
            await stopAt(query);
            await monitor.writeMemory(saved, expected.bytes);
            await stopAt(completed);
            expect([...(await monitor.readMemory(answers, answers + 73))], testCase.name).toEqual(
              expected.answers,
            );
            expect([...(await monitor.readMemory(saved, saved + 10))], testCase.name).toEqual([
              ...expected.bytes,
            ]);
          }
        });
      });
    },
    1_200_000,
  );
});

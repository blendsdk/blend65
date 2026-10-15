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
const library = `module SavedContacts;
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
import { query, completed } from SavedContacts;
function main(): void { while (true) { query(); completed(); } }
`;

/** A physically closed undirected switch between one PA column and one PB row. */
type Contact = readonly [column: number, row: number];
/** Physical contacts and actual direct joystick sources, rather than inferred pin observations. */
type ContactCase = readonly [
  name: string,
  contacts: readonly Contact[],
  port1Grounds: number,
  port2Grounds: number,
];

// This sparse cycle uses every column and row, including the wrap from column 7 to row 0.
const fullMatrixContacts = Array.from(
  { length: 64 },
  (_, key) => [Math.floor(key / 8), key % 8] as const,
).filter(([column, row]) => row === column || row === (column + 1) % 8);
const cases: readonly ContactCase[] = [
  [
    "floating rectangle missing one actual contact",
    [
      [0, 0],
      [0, 7],
      [7, 0],
    ],
    0,
    0,
  ],
  [
    "grounded rectangle missing one actual contact",
    [
      [0, 0],
      [0, 7],
      [7, 0],
    ],
    1,
    0,
  ],
  [
    "disjoint grounded star and floating rectangle",
    [
      [0, 0],
      [0, 7],
      [6, 5],
      [6, 6],
      [7, 5],
    ],
    1,
    0,
  ],
  ["contact cycle spanning all columns and rows", fullMatrixContacts, 16, 1],
  [
    "grounded column star with sole PB0 source",
    [
      [5, 0],
      [5, 5],
    ],
    1,
    0,
  ],
  [
    "grounded row star with sole PA0 source",
    [
      [0, 5],
      [5, 5],
    ],
    0,
    1,
  ],
];

/** Construct released and eight driven-column observations by physical ground reachability. */
function observe(contacts: readonly Contact[], port1: number, port2: number): Uint8Array {
  const neighbors = Array.from({ length: 16 }, () => new Set<number>());
  for (const [column, row] of contacts) {
    neighbors[column]!.add(8 + row);
    neighbors[8 + row]!.add(column);
  }
  const sources: number[] = [];
  for (let bit = 0; bit < 5; bit += 1) {
    if ((port1 & (1 << bit)) !== 0) sources.push(8 + bit);
    if ((port2 & (1 << bit)) !== 0) sources.push(bit);
  }
  const pins = (drivenColumn?: number) => {
    const pending = drivenColumn === undefined ? [...sources] : [...sources, drivenColumn];
    const grounded = new Set(pending);
    // Appending newly reached neighbors walks each ground-connected endpoint once.
    for (const pin of pending)
      for (const neighbor of neighbors[pin]!)
        if (!grounded.has(neighbor)) {
          grounded.add(neighbor);
          pending.push(neighbor);
        }
    const byte = (base: number) =>
      Array.from({ length: 8 }, (_, bit) => bit).reduce(
        (value, bit) => (grounded.has(base + bit) ? value & (255 ^ (1 << bit)) : value),
        255,
      );
    return [byte(8), byte(0)] as const;
  };
  const rows = Array.from({ length: 8 }, (_, column) => pins(column)[0]);
  return Uint8Array.from([...rows, ...pins(), 0]);
}

describe("saved input actual contact graphs", () => {
  // These bounded witnesses support soundness; they do not replace exact certainty requirements.
  it.each(sourceLibraryProfiles)(
    "should make only sound definite claims about actual contacts and sources on %s",
    async (profile) => {
      await withLibraryBuild(source, library, profile, async (artifacts, built) => {
        const saved = libraryGlobalAddress(artifacts, library, savedDeclaration, 11);
        const answers = libraryGlobalAddress(artifacts, library, answersDeclaration, 74);
        const query = libraryEntry(artifacts, "src/library.blend::SavedContacts.query");
        const completed = libraryEntry(artifacts, "src/library.blend::SavedContacts.completed");
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          for (const [name, contacts, port1, port2] of cases) {
            const bytes = observe(contacts, port1, port2);
            await stopAt(query);
            await monitor.writeMemory(saved, bytes);
            await stopAt(completed);
            const actual = [...(await monitor.readMemory(answers, answers + 73))];
            const closed = Array.from({ length: 64 }, (_, key) =>
              contacts.some(([column, row]) => key === column * 8 + row),
            );
            for (const grounds of [port1, port2])
              for (let bit = 0; bit < 5; bit += 1) closed.push((grounds & (1 << bit)) !== 0);
            actual.forEach((state, index) => {
              expect([0, 1, 2], `${name}: answer ${index}`).toContain(state);
              // A definite claim must match the actual switch/source; uncertainty makes no such claim.
              if (state !== 2) expect(state === 0, `${name}: answer ${index}`).toBe(closed[index]);
            });
            expect([...(await monitor.readMemory(saved, saved + 10))], name).toEqual([...bytes]);
          }
        });
      });
    },
    1_200_000,
  );
});

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
const library = `module SavedInput;
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
import { query, completed } from SavedInput;
function main(): void {
  while (true) { query(); completed(); }
}
`;

/** One caller-owned saved observation and its independently derived named-query answers. */
interface SavedObservation {
  readonly name: string;
  readonly bytes: Uint8Array;
  readonly answers: readonly number[];
}

/** Encode the packed saved object; the final byte denotes a complete observation. */
function snapshot(rows: readonly number[], joystick1 = 255, joystick2 = 255): Uint8Array {
  return Uint8Array.from([...rows, joystick1, joystick2, 0]);
}

/** Enumerate released inputs, every single switch, and every direct joystick-ground pair. */
function* observations(): Generator<SavedObservation> {
  const releasedRows = Array.from({ length: 8 }, () => 255);
  const releasedAnswers = Array.from({ length: 74 }, () => 1);
  yield { name: "released", bytes: snapshot(releasedRows), answers: releasedAnswers };
  for (let key = 0; key < 64; key += 1) {
    const rows = [...releasedRows];
    rows[Math.floor(key / 8)] = 255 ^ (1 << (key % 8));
    const answers = [...releasedAnswers];
    answers[key] = 0;
    yield { name: `single key ${key}`, bytes: snapshot(rows), answers };
  }
  // PA grounds belong to port 2; PB grounds belong to port 1. All opposite directions are legal.
  for (let pa = 0; pa < 32; pa += 1)
    for (let pb = 0; pb < 32; pb += 1) {
      const answers = Array.from({ length: 64 }, (_, key) => {
        const groundedColumn = (pa & (1 << Math.floor(key / 8))) !== 0;
        const groundedRow = (pb & (1 << (key % 8))) !== 0;
        // Joining two already grounded endpoints changes no observation: that key is uncertain.
        // A contact to an ungrounded column would ground it in the raw PA observation, so it is up.
        return groundedColumn && groundedRow ? 2 : 1;
      });
      for (const [own, opposite] of [
        [pb, pa],
        [pa, pb],
      ] as const)
        for (let control = 0; control < 5; control += 1) {
          // A HIGH pin certifies release. A LOW with no opposite grounds needs its direct source.
          // With opposite grounds, contact paths offer another explanation for the same LOW pin.
          answers.push((own & (1 << control)) === 0 ? 1 : opposite === 0 ? 0 : 2);
        }
      yield {
        name: `joystick grounds PA=${pa} PB=${pb}`,
        bytes: snapshot(
          Array.from({ length: 8 }, () => 255 ^ pb),
          255 ^ pb,
          255 ^ pa,
        ),
        answers,
      };
    }
}

describe("saved input simple observations", () => {
  // Every named result is read from one saved object; query calls must leave all 11 bytes intact.
  it.each(sourceLibraryProfiles)(
    "should decode released, single-key and every joystick-pair observation on %s",
    async (profile) => {
      await withLibraryBuild(source, library, profile, async (artifacts, built) => {
        const saved = libraryGlobalAddress(artifacts, library, savedDeclaration, 11);
        const answers = libraryGlobalAddress(artifacts, library, answersDeclaration, 74);
        const query = libraryEntry(artifacts, "src/library.blend::SavedInput.query");
        const completed = libraryEntry(artifacts, "src/library.blend::SavedInput.completed");
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          let count = 0;
          for (const observation of observations()) {
            await stopAt(query);
            await monitor.writeMemory(saved, observation.bytes);
            await stopAt(completed);
            expect(
              [...(await monitor.readMemory(answers, answers + 73))],
              observation.name,
            ).toEqual(observation.answers);
            expect([...(await monitor.readMemory(saved, saved + 10))], observation.name).toEqual([
              ...observation.bytes,
            ]);
            count += 1;
          }
          expect(count).toBe(1 + 64 + 32 * 32);
        });
      });
    },
    1_200_000,
  );
});

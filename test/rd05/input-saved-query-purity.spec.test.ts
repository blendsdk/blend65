import { describe, expect, it } from "vitest";
import { analyzeProfileSource, profileRecord, profileRecords } from "./profile-fixture.js";
import {
  libraryEntry,
  libraryGlobalAddress,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

const savedDeclaration = "let saved: InputSnapshot";
const answersDeclaration = "let answers: byte[74]";
const library = `module SavedPurity;
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
import { query, completed } from SavedPurity;
function main(): void { asm_sei(); while (true) { query(); completed(); } }
`;

/** Compatible saved inputs, with exact DOWN/UNCERTAIN answer ordinals and all other answers UP. */
type SavedCase = readonly [
  name: string,
  rows: readonly number[],
  joystick1: number,
  joystick2: number,
  down: readonly number[],
  uncertain: readonly number[],
];
const cases: readonly SavedCase[] = [
  ["single D switch", [255, 255, 251, 255, 255, 255, 255, 255], 255, 255, [18], []],
  ["floating rectangle", [252, 252, 255, 255, 255, 255, 255, 255], 255, 255, [], [0, 1, 8, 9]],
  [
    "grounded star with sole PB0 source",
    Array.from({ length: 8 }, () => 222),
    222,
    223,
    [40, 45, 64],
    [],
  ],
  [
    "distinct PA0 and PB0 ground sources",
    Array.from({ length: 8 }, () => 254),
    254,
    254,
    [],
    [0, 64, 69],
  ],
];

describe("saved input query purity", () => {
  // Saved-only calls retain no acquisition function, selected input interrupt, or allocated global state.
  it.each(sourceLibraryProfiles)(
    "should use only saved bytes and retain no scanner resources on %s",
    async (profile) => {
      const analyzed = await analyzeProfileSource(source, profile, library);
      expect(analyzed.kind, JSON.stringify(analyzed.diagnostics)).toBe("complete");
      if (analyzed.kind !== "complete") throw new Error("Expected a legal saved-only caller");
      const interrupts = new Set(
        analyzed.program.bindings
          .filter(
            (entry) =>
              entry.functionMode === "interrupt" && entry.qualifiedName?.startsWith("c64.input."),
          )
          .map((entry) => `${entry.id.sourceId}::${entry.qualifiedName}`),
      );
      await withLibraryBuild(source, library, profile, async (artifacts, built) => {
        const selected = profileRecords(artifacts.debug.functions).map((entry) => {
          if (typeof entry.qualifiedName !== "string") throw new Error("Missing function identity");
          return entry.qualifiedName;
        });
        expect(selected).not.toContain(
          "@blend65/stdlib/c64/input.blend::c64.input.readInputSnapshot",
        );
        expect(selected.filter((name) => interrupts.has(name))).toEqual([]);
        const sources = profileRecords(artifacts.debug.sources);
        const inputSourceIndex = sources.findIndex(
          (entry) => entry.path === "@blend65/stdlib/c64/input.blend",
        );
        expect(inputSourceIndex).toBeGreaterThanOrEqual(0);
        const globals = new Set<string>();
        for (const symbol of profileRecords(artifacts.debug.symbols))
          if (symbol.kind === "global") {
            if (typeof symbol.qualifiedName !== "string")
              throw new Error("Missing global identity");
            const origin = profileRecord(symbol.origin);
            expect(origin.kind).toBe("source");
            const span = profileRecord(origin.span);
            if (
              typeof span.sourceIndex !== "number" ||
              !Number.isInteger(span.sourceIndex) ||
              span.sourceIndex < 0 ||
              span.sourceIndex >= sources.length
            )
              throw new TypeError("Global source indexes must resolve");
            if (span.sourceIndex === inputSourceIndex) globals.add(symbol.qualifiedName);
          }
        const allocated = profileRecords(artifacts.memory.intervals).filter((interval) => {
          const owner = profileRecord(interval.owner);
          return (
            owner.kind === "symbol" &&
            typeof owner.id === "string" &&
            globals.has(owner.id) &&
            interval.size !== 0
          );
        });
        expect(allocated).toEqual([]);
        const saved = libraryGlobalAddress(artifacts, library, savedDeclaration, 11);
        const answers = libraryGlobalAddress(artifacts, library, answersDeclaration, 74);
        const query = libraryEntry(artifacts, "src/library.blend::SavedPurity.query");
        const completed = libraryEntry(artifacts, "src/library.blend::SavedPurity.completed");
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          await stopAt(query);
          const checkpoints = new Set<number>();
          try {
            // Trace installation occurs while stopped after ordinary initialization and IRQ exclusion.
            const addresses = [0, 1, ...Array.from({ length: 4096 }, (_, index) => 0xd000 + index)];
            for (const address of addresses)
              for (const operation of ["load", "store"] as const)
                checkpoints.add(await monitor.setAccessTracepoint(address, operation));
            for (const [name, rows, joystick1, joystick2, down, uncertain] of cases) {
              const bytes = Uint8Array.from([...rows, joystick1, joystick2, 0]);
              const expected = Array.from({ length: 74 }, () => 1);
              down.forEach((index) => {
                expected[index] = 0;
              });
              uncertain.forEach((index) => {
                expected[index] = 2;
              });
              await monitor.writeMemory(saved, bytes);
              let initial: readonly number[] | undefined;
              for (const hardware of [
                [255, 255, 0, 0],
                [0, 0, 255, 255],
              ]) {
                // Change both CIA1 output latches and directions outside the CPU-observed interval.
                await monitor.writeIo(0xdc00, Uint8Array.from(hardware));
                monitor.takeCheckpointHits();
                await stopAt(completed);
                expect(
                  monitor.takeCheckpointHits().filter((id) => checkpoints.has(id)),
                  name,
                ).toEqual([]);
                const actual = [...(await monitor.readMemory(answers, answers + 73))];
                expect(actual, name).toEqual(expected);
                if (initial !== undefined) expect(actual, name).toEqual(initial);
                initial = actual;
                expect([...(await monitor.readMemory(saved, saved + 10))], name).toEqual([
                  ...bytes,
                ]);
                await stopAt(query);
              }
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

import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { readProfileArtifacts, withProfileProject } from "./profile-fixture.js";
import {
  libraryEntry,
  libraryGlobalAddress,
  sourceLibraryProfiles,
  withLibraryVice,
} from "./source-library-fixture.js";

const CIA1 = 0xdc00;
const CIA2 = 0xdd00;
const NMINV = 0x0318;
const registerNames = [
  "PA",
  "PB",
  "DDRA",
  "DDRB",
  "TALO",
  "TAHI",
  "TBLO",
  "TBHI",
  "TOD10",
  "TODSEC",
  "TODMIN",
  "TODHOUR",
  "SDR",
  "ICR",
  "CRA",
  "CRB",
] as const;

/** Expected source effects exclude vector traffic and any unrelated checkpoint. */
const normalAccesses = [
  "load:CIA1.CRA",
  "load:CIA1.CRB",
  "load:CIA1.DDRA",
  "load:CIA1.DDRB",
  "store:CIA1.PA",
  "store:CIA1.DDRA",
  "store:CIA1.DDRB",
  "store:CIA1.PA",
  "load:CIA1.PB",
  "load:CIA1.PA",
  ...Array.from({ length: 8 }, () => ["store:CIA1.PA", "load:CIA1.PB"]).flat(),
  "store:CIA1.PA",
  "store:CIA1.DDRA",
  "store:CIA1.DDRB",
];

/** Ordinary callers repeat acquisition without copied source-library bodies or hand-unrolled scans. */
function callerSource(initialI: boolean): string {
  return `module Game;
import { readInputSnapshot, InputSnapshot } from c64.input;
let saved: InputSnapshot;
function before(): void { }
function after(): void { }
function acquire(): void {
    before();
    saved = readInputSnapshot();
    after();
}
function main(): void {
    ${initialI ? "asm_sei();" : "asm_cli();"}
    for (let attempt: byte = 0; attempt < 2; attempt += 1) {
        acquire();
    }
}`;
}

describe("installed input acquisition with released contacts", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const initialI of [false, true]) {
      // Each acquisition must retain released bytes, its caller's state, and the exact port transaction.
      it(`should preserve the normal helper-loop transaction with I=${Number(initialI)} on ${profile}`, async () => {
        const source = callerSource(initialI);
        await withProfileProject(source, profile, async (project) => {
          const checked = await checkProject({ project });
          expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
          const built = await buildProject({ project, optimization: "none" });
          expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
          if (built.kind !== "success") throw new Error("Expected installed input acquisition");
          const artifacts = await readProfileArtifacts(built);
          const beforeAddress = libraryEntry(artifacts, "src/game.blend::Game.before");
          const afterAddress = libraryEntry(artifacts, "src/game.blend::Game.after");
          const savedAddress = libraryGlobalAddress(
            artifacts,
            source,
            "let saved: InputSnapshot;",
            11,
            "src/game.blend",
          );
          await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
            // A generated installer requires the actual stock predecessor at program entry.
            expect([...(await monitor.readMemory(NMINV, NMINV + 1))]).toEqual([0x47, 0xfe]);
            // Stop timer IRQ production outside observation so firmware cannot add scan traffic.
            await monitor.writeIo(CIA1 + 0x0d, Uint8Array.of(0x7f));
            await monitor.writeIo(CIA1 + 0x0e, Uint8Array.of(0, 0));
            const checkpoints = new Map<number, string>();
            try {
              for (const [base, chip] of [
                [CIA1, "CIA1"],
                [CIA2, "CIA2"],
              ] as const) {
                for (const [offset, name] of registerNames.entries()) {
                  for (const operation of ["load", "store"] as const) {
                    const id = await monitor.setAccessTracepoint(base + offset, operation);
                    checkpoints.set(id, `${operation}:${chip}.${name}`);
                  }
                }
              }
              for (const [address, name] of [
                [0, "CPU.DDR"],
                [1, "CPU.PORT"],
                [0xd018, "VIC.MEMORY"],
                [NMINV, "NMINV.LO"],
                [NMINV + 1, "NMINV.HI"],
              ] as const) {
                const id = await monitor.setAccessTracepoint(address, "store");
                checkpoints.set(id, `store:${name}`);
              }
              for (const [ddra, ddrb] of [
                [0xff, 0x00],
                [0xa5, 0x5a],
              ] as const) {
                await stopAt(beforeAddress);
                // Released pins and known PB latch belong to setup, never to acquired-result repair.
                await monitor.writeIo(CIA1, Uint8Array.of(0xff, 0xff, ddra, ddrb));
                const original = await monitor.readCpuRegisters();
                expect(original.p & 0x04).toBe(initialI ? 0x04 : 0);
                const predecessor = [...(await monitor.readMemory(NMINV, NMINV + 1))];
                monitor.takeCheckpointHits();
                await stopAt(afterAddress);
                const trace = monitor.takeCheckpointHits().flatMap((id) => {
                  const name = checkpoints.get(id);
                  return name === undefined ? [] : [name];
                });
                const ports = trace.filter((name) => !name.includes("NMINV."));
                expect(ports).toEqual(normalAccesses);
                expect(ports.filter((name) => name.startsWith("load:"))).toHaveLength(14);
                expect(ports.filter((name) => name.startsWith("store:"))).toHaveLength(15);
                // Publication follows direction setup; removal precedes exact direction restoration.
                const setup = trace.indexOf("store:CIA1.DDRB");
                const firstSample = trace.indexOf("store:CIA1.PA", setup + 1);
                expect(
                  trace.slice(setup + 1, firstSample).some((name) => name.includes("NMINV.")),
                ).toBe(true);
                const finalIdle = trace.lastIndexOf("store:CIA1.PA");
                const restoreDirection = trace.lastIndexOf("store:CIA1.DDRA");
                expect(
                  trace
                    .slice(finalIdle + 1, restoreDirection)
                    .some((name) => name.includes("NMINV.")),
                ).toBe(true);
                expect([...(await monitor.readMemory(savedAddress, savedAddress + 10))]).toEqual([
                  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0,
                ]);
                expect([...(await monitor.readIo(CIA1 + 2, CIA1 + 3))]).toEqual([ddra, ddrb]);
                // Both saved PA directions drive bit seven, exposing the library's own final idle value.
                expect([...(await monitor.readIo(CIA1, CIA1))]).toEqual([0x7f]);
                expect([...(await monitor.readMemory(NMINV, NMINV + 1))]).toEqual(predecessor);
                const returned = await monitor.readCpuRegisters();
                expect(returned.p & 0x0c).toBe(original.p & 0x0c);
                expect(returned.sp).toBe(original.sp);
              }
            } finally {
              for (const id of checkpoints.keys()) await monitor.deleteCheckpoint(id);
            }
          });
        });
      }, 120_000);
    }
  }
});

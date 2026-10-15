import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { profileRecords, readProfileArtifacts, withProfileProject } from "./profile-fixture.js";
import {
  libraryEntry,
  libraryFunctionBytes,
  libraryGlobalAddress,
  sourceLibraryProfiles,
  withLibraryVice,
} from "./source-library-fixture.js";

const CIA1 = 0xdc00;
const NMINV = 0x0318;
const stockVector = [0x47, 0xfe];

/** The exclusive unexpanded caller deliberately replaces RESTORE with returning acknowledgement. */
function callerSource(owner: "chained" | "exclusive"): string {
  const exclusive = owner === "exclusive";
  return `module Game;
import { readInputSnapshot, InputSnapshot, SnapshotQuality } from c64.input;
import { ${exclusive ? "setNMIExclusive" : "setNMI"}, restoreNMI } from c64.system;
${exclusive ? "const CIA2_INTERRUPT_CONTROL: word = $DD0D;\nlet consumedNmiSources: byte = 0;" : ""}
let saved: InputSnapshot;
interrupt function prior(): void {
    ${exclusive ? "consumedNmiSources = peek(CIA2_INTERRUPT_CONTROL);" : ""}
}
function installed(): void { }
function before(): void { }
function after(): void { }
function released(): void { }
function acquire(): void {
    saved = { rows: [85, 85, 85, 85, 85, 85, 85, 85], joystick1: 86,
              joystick2: 87, quality: SnapshotQuality.UNAVAILABLE };
    before();
    saved = readInputSnapshot();
    after();
}
function main(): void {
    asm_sei();
    ${exclusive ? "setNMIExclusive" : "setNMI"}(&prior);
    installed();
    for (let attempt: byte = 0; attempt < 2; attempt += 1) {
        acquire();
    }
    restoreNMI();
    released();
}`;
}

describe("installed input acquisition with compatible generated NMI predecessors", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const owner of ["chained", "exclusive"] as const) {
      // A real prior owner must remain installed across each nested acquisition and unwind in LIFO order.
      it(`should preserve ${owner} predecessor ownership through helper loops on ${profile}`, async () => {
        const source = callerSource(owner);
        await withProfileProject(source, profile, async (project) => {
          const checked = await checkProject({ project });
          expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
          const built = await buildProject({ project, optimization: "none" });
          expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
          if (built.kind !== "success")
            throw new Error("Expected compatible predecessor composition");
          const artifacts = await readProfileArtifacts(built);
          const priorAddress = libraryEntry(artifacts, "src/game.blend::Game.prior");
          const priorVector = [priorAddress & 0xff, priorAddress >>> 8];
          const priorFunctions = profileRecords(artifacts.debug.functions).filter(
            (entry) => entry.qualifiedName === "src/game.blend::Game.prior",
          );
          expect(priorFunctions).toHaveLength(1);
          expect(priorFunctions[0]!.kind).toBe("interrupt");
          const bytes = libraryFunctionBytes(artifacts, "src/game.blend::Game.prior");
          let retainedLink: number | undefined;
          if (owner === "chained") {
            // The terminal operand identifies physical storage without private labels or owner prefixes.
            expect(bytes.at(-3)).toBe(0x6c);
            retainedLink = bytes.at(-2)! | (bytes.at(-1)! << 8);
            expect(retainedLink & 0xff).toBeLessThanOrEqual(0xfe);
            const link = retainedLink;
            const intervals = profileRecords(artifacts.memory.intervals).filter(
              (interval) =>
                typeof interval.start === "number" &&
                typeof interval.end === "number" &&
                interval.start <= link &&
                interval.end >= link + 2,
            );
            expect(intervals).toHaveLength(1);
            expect(typeof intervals[0]!.addressSpaceId).toBe("string");
          } else {
            expect(bytes.at(-1)).toBe(0x40);
          }
          const installedAddress = libraryEntry(artifacts, "src/game.blend::Game.installed");
          const beforeAddress = libraryEntry(artifacts, "src/game.blend::Game.before");
          const afterAddress = libraryEntry(artifacts, "src/game.blend::Game.after");
          const releasedAddress = libraryEntry(artifacts, "src/game.blend::Game.released");
          const savedAddress = libraryGlobalAddress(
            artifacts,
            source,
            "let saved: InputSnapshot;",
            11,
            "src/game.blend",
          );
          await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
            expect([...(await monitor.readMemory(NMINV, NMINV + 1))]).toEqual(stockVector);
            // Quiet IRQ production outside the observed no-event composition; no ICR read is used.
            await monitor.writeIo(CIA1 + 0x0d, Uint8Array.of(0x7f));
            await monitor.writeIo(CIA1 + 0x0e, Uint8Array.of(0, 0));
            await stopAt(installedAddress);
            expect([...(await monitor.readMemory(NMINV, NMINV + 1))]).toEqual(priorVector);
            expect(priorVector).not.toEqual(stockVector);
            const linkStores: number[] = [];
            try {
              if (retainedLink !== undefined) {
                expect([...(await monitor.readMemory(retainedLink, retainedLink + 1))]).toEqual(
                  stockVector,
                );
                for (const address of [retainedLink, retainedLink + 1])
                  linkStores.push(await monitor.setAccessTracepoint(address, "store"));
              }
              monitor.takeCheckpointHits();
              for (let attempt = 0; attempt < 2; attempt += 1) {
                await stopAt(beforeAddress);
                expect(
                  monitor.takeCheckpointHits().filter((id) => linkStores.includes(id)),
                ).toEqual([]);
                await monitor.writeIo(CIA1, Uint8Array.of(0xff, 0xff, 0xa5, 0x5a));
                expect([...(await monitor.readMemory(NMINV, NMINV + 1))]).toEqual(priorVector);
                const original = await monitor.readCpuRegisters();
                expect(original.p & 0x04).toBe(0x04);
                await stopAt(afterAddress);
                expect(
                  monitor.takeCheckpointHits().filter((id) => linkStores.includes(id)),
                ).toEqual([]);
                expect([...(await monitor.readMemory(NMINV, NMINV + 1))]).toEqual(priorVector);
                if (retainedLink !== undefined)
                  expect([...(await monitor.readMemory(retainedLink, retainedLink + 1))]).toEqual(
                    stockVector,
                  );
                expect([...(await monitor.readMemory(savedAddress, savedAddress + 10))]).toEqual([
                  0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0,
                ]);
                expect([...(await monitor.readIo(CIA1 + 2, CIA1 + 3))]).toEqual([0xa5, 0x5a]);
                const returned = await monitor.readCpuRegisters();
                expect(returned.p & 0x0c).toBe(original.p & 0x0c);
                expect(returned.sp).toBe(original.sp);
              }
              await stopAt(releasedAddress);
              expect([...(await monitor.readMemory(NMINV, NMINV + 1))]).toEqual(stockVector);
            } finally {
              for (const id of linkStores) await monitor.deleteCheckpoint(id);
            }
          });
        });
      }, 120_000);
    }
  }
});

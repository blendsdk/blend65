import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";
import { libraryEntry, sourceLibraryProfiles, withLibraryVice } from "./source-library-fixture.js";
import type { LibraryArtifacts } from "./source-library-fixture.js";
import { cia2FunctionVariants } from "./cia2-output-fixture.js";

/** Runtime signed input keeps both lower and upper checks necessary. */
const SOURCE = `module Game;
place(at: $3000) let input: sword;
place(at: $30FC) let rows: byte[8];
place(at: $3300) let output: byte;
function armed(): void { asm_nop(); }
function observed(): void { asm_nop(); }
function sample(rows: const byte[8], ordinal: sword): void {
  output = rows[ordinal];
  observed();
}
function main(): void { asm_sei(); armed(); sample(rows, input); }
`;

/** Find exact C64 stop bodies and prove the SEI has source/function provenance. */
function sourceStops(artifacts: LibraryArtifacts): number[] {
  const sources = profileRecords(artifacts.debug.sources);
  const sourceIndex = sources.findIndex((source) => source.path === "src/game.blend");
  expect(sourceIndex).toBeGreaterThanOrEqual(0);
  const position = SOURCE.indexOf("rows[ordinal]");
  const expressionStart = Buffer.byteLength(SOURCE.slice(0, position));
  const expressionEnd = expressionStart + Buffer.byteLength("rows[ordinal]");
  const ranges = profileRecords(artifacts.debug.ranges);
  const variants = cia2FunctionVariants(artifacts, "sample");
  expect(variants.length).toBeGreaterThan(0);
  const stops: number[] = [];
  for (const variant of variants) {
    const candidates: number[] = [];
    for (let offset = 0; offset + 4 <= variant.bytes.length; offset += 1) {
      const address = variant.start + offset;
      const expected = [0x78, 0x4c, address & 0xff, address >>> 8];
      if (!expected.every((byte, index) => variant.bytes[offset + index] === byte)) continue;
      const provenance = ranges.some((range) => {
        const machine = profileRecord(range.machine);
        const owner = profileRecord(range.owner);
        if (owner.kind !== "function" || owner.functionIndex !== variant.functionIndex)
          return false;
        if (typeof machine.start !== "number" || typeof machine.end !== "number") return false;
        if (machine.start > address || machine.end <= address) return false;
        const origin = profileRecord(range.origin);
        const rawSpan = origin.kind === "source" ? origin.span : origin.sourceSpan;
        if (rawSpan === null || typeof rawSpan !== "object" || Array.isArray(rawSpan)) return false;
        const span = profileRecord(rawSpan);
        const { startByte, endByte } = span;
        if (typeof startByte !== "number" || typeof endByte !== "number") return false;
        return (
          [machine.start, machine.end, startByte, endByte, span.sourceIndex].every(
            Number.isInteger,
          ) &&
          span.sourceIndex === sourceIndex &&
          startByte <= expressionStart &&
          endByte >= expressionEnd
        );
      });
      expect(provenance, "stop SEI belongs to the indexed source expression").toBe(true);
      candidates.push(address);
    }
    expect(candidates.length, "checked function has an exact source-owned stop").toBeGreaterThan(0);
    stops.push(...candidates);
  }
  return stops;
}

describe.sequential("array bounds guards", () => {
  for (const profile of sourceLibraryProfiles) {
    for (const ordinal of [-1, 8]) {
      // Known negative and upper-bound constants are rejected before publication.
      it(`should reject constant ordinal ${ordinal} with E10240 and no generation on ${profile}`, async () => {
        const invalid = `module Game;
const ORDINAL: sword = ${ordinal};
let rows: byte[8] = [0; 0];
function main(): void { let value: byte = rows[ORDINAL]; }
`;
        await withProfileProject(invalid, profile, async (project) => {
          const checked = await checkProject({ project });
          const built = await buildProject({ project, optimization: "none" });
          for (const result of [checked, built]) {
            expect(result.kind).toBe("failure");
            expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("E10240");
            expect(result).not.toHaveProperty("generation");
          }
        });
      }, 120_000);
    }

    for (const ordinal of [-1, 8, 0, 7]) {
      // Failed checks stop before access; valid controls prove the observation path works.
      it(`should ${ordinal < 0 || ordinal >= 8 ? "stop before access" : "read the selected byte"} for checked runtime ordinal ${ordinal} on ${profile}`, async () => {
        await withProfileProject(SOURCE, profile, async (project) => {
          const built = await buildProject({ project, optimization: "none", boundsCheck: true });
          expect(built.kind).toBe("success");
          if (built.kind !== "success") throw new Error("Checked runtime fixture must build");
          const artifacts = await readProfileArtifacts(built);
          const stops = sourceStops(artifacts);
          await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
            await stopAt(libraryEntry(artifacts, "src/game.blend::Game.armed"));
            const input = Uint8Array.of(ordinal & 0xff, (ordinal >>> 8) & 0xff);
            const rows = Uint8Array.of(0x21, 0x35, 0x49, 0x5d, 0x71, 0x85, 0x99, 0xad);
            await monitor.writeMemory(0x3000, input);
            await monitor.writeMemory(0x30fb, Uint8Array.of(0x66, ...rows, 0x77));
            await monitor.writeMemory(0x3300, Uint8Array.of(0xca));
            const accesses: number[] = [];
            for (let address = 0x30fb; address <= 0x3104; address += 1) {
              accesses.push(await monitor.setAccessTracepoint(address, "load"));
              accesses.push(await monitor.setAccessTracepoint(address, "store"));
            }
            const outputWrite = await monitor.setAccessTracepoint(0x3300, "store");
            const observed = libraryEntry(artifacts, "src/game.blend::Game.observed");
            for (const address of [...stops, observed]) await monitor.setExecuteCheckpoint(address);
            await monitor.takeCheckpointHits();
            const firstStop = monitor.waitForStop();
            await monitor.resume();
            const stopped = await firstStop;
            const failed = ordinal < 0 || ordinal >= 8;
            if (failed) {
              expect(stops).toContain(stopped);
              const stack = (await monitor.readCpuRegisters()).sp;
              const repeatedStop = monitor.waitForStop();
              await monitor.resume();
              expect(await repeatedStop).toBe(stopped);
              expect((await monitor.readCpuRegisters()).sp).toBe(stack);
            } else expect(stopped).toBe(observed);
            const hits = await monitor.takeCheckpointHits();
            const effects = hits.filter((id) => [...accesses, outputWrite].includes(id));
            expect(effects).toEqual(failed ? [] : [accesses[(ordinal + 1) * 2], outputWrite]);
            expect((await monitor.readMemory(0x3300, 0x3300))[0]).toBe(
              failed ? 0xca : rows[ordinal],
            );
            expect(await monitor.readMemory(0x3000, 0x3001)).toEqual(input);
            expect(await monitor.readMemory(0x30fb, 0x3104)).toEqual(
              Uint8Array.of(0x66, ...rows, 0x77),
            );
            expect((await monitor.readCpuRegisters()).p & 0x04).toBe(0x04);
          });
        });
      }, 120_000);
    }
  }
});

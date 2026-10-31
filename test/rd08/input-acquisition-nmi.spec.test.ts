import { buildProject, checkProject } from "@blend65/compiler";
import { expect, it } from "vitest";
import { cia2FunctionVariants } from "../rd05/cia2-output-fixture.js";
import {
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "../rd05/profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryBytes,
  libraryEntry,
  libraryFunctionBytes,
  libraryStartup,
  sourceLibraryProfiles,
  withLibraryVice,
} from "../rd05/source-library-fixture.js";

it.each(sourceLibraryProfiles)(
  "should preserve a returning hardware NMI and live acquisition links on %s",
  async (profile) => {
    const source = `module Game;
import { InputSnapshot, Key, JoystickPort, JoystickControl, readInputSnapshot,
  keyState, joystickState } from c64.input;
import { setNMI, restoreNMI } from c64.system;
const CIA2_ICR: word = $DD0D;
const MARKER: word = $C102;
place(at: $3200) let saved: InputSnapshot;
place(at: $3400) let answers: byte[3] = [; 0];
interrupt function priorNmi(): void { poke(MARKER, 1); }
function beforeScan(): void { asm_nop(); }
function afterScan(): void { asm_nop(); }
function main(): void {
  setNMI(&priorNmi);
  asm_cli();
  answers[0] = peek(CIA2_ICR);
  beforeScan();
  saved = readInputSnapshot();
  afterScan();
  answers[0] = keyState(saved, Key.SPACE);
  answers[1] = joystickState(saved, JoystickPort.PORT_1, JoystickControl.UP);
  answers[2] = joystickState(saved, JoystickPort.PORT_2, JoystickControl.DOWN);
  restoreNMI();
}`;
    await withProfileProject(source, profile, async (project) => {
      const checked = await checkProject({ project });
      expect(checked.kind, JSON.stringify(checked.diagnostics)).toBe("success");
      if (checked.kind !== "success") throw new Error("Expected legal ordinary input source");
      const built = await buildProject({ project, optimization: "size" });
      expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
      if (built.kind !== "success") throw new Error("Expected a complete size build");
      const artifacts = await readProfileArtifacts(built);
      expectLibraryAccounting(artifacts);
      expect(artifacts.memory).toMatchObject({ profileId: profile, acmeReconciled: true });
      await withLibraryVice(
        built,
        artifacts,
        profile,
        async (monitor, stopAt) => {
          await monitor.writeIo(0xdd0d, Uint8Array.of(0x7f));
          await monitor.writeIo(0xdd0e, Uint8Array.of(8, 8));
          await monitor.writeMemory(0x02a1, Uint8Array.of(0));
          await monitor.writeMemory(0xc102, Uint8Array.of(0));
          await stopAt(libraryEntry(artifacts, "src/game.blend::Game.main"));

          const functions = profileRecords(artifacts.debug.functions);
          const scans = functions.flatMap((fn, index) =>
            typeof fn.qualifiedName === "string" && fn.qualifiedName.endsWith(".readInputSnapshot")
              ? [index]
              : [],
          );
          expect(scans).toHaveLength(1);
          const scanIndex = scans[0]!;
          const scan = functions[scanIndex]!;
          if (typeof scan.qualifiedName !== "string") throw new Error("Expected scanner identity");
          if (!Array.isArray(scan.rangeIndexes)) throw new Error("Expected scanner range indexes");
          const ranges = profileRecords(artifacts.debug.ranges);
          const spaces = profileRecords(artifacts.debug.addressSpaces);
          expect(scan.rangeIndexes.length).toBeGreaterThan(0);
          const scanRanges = scan.rangeIndexes.map((index) => {
            if (typeof index !== "number" || !Number.isInteger(index) || !ranges[index])
              throw new Error("Expected a valid scanner range index");
            const range = ranges[index]!;
            expect(range.owner).toEqual({ kind: "function", functionIndex: scanIndex });
            const machine = profileRecord(range.machine);
            if (
              typeof machine.start !== "number" ||
              typeof machine.end !== "number" ||
              typeof machine.addressSpaceIndex !== "number"
            )
              throw new Error("Expected numeric machine coordinates");
            expect(
              [machine.start, machine.end, machine.addressSpaceIndex].every(Number.isInteger),
            ).toBe(true);
            expect(machine.start).toBeGreaterThanOrEqual(0);
            expect(machine.end).toBeGreaterThan(machine.start);
            expect(machine.end).toBeLessThanOrEqual(65536);
            expect(machine.addressSpaceIndex).toBeGreaterThanOrEqual(0);
            expect(machine.addressSpaceIndex).toBeLessThan(spaces.length);
            expect(spaces[machine.addressSpaceIndex]).toMatchObject({
              kind: "cpu",
              sizeBytes: 65536,
              banks: [],
            });
            return { start: machine.start, end: machine.end };
          });
          // The buffer begins at the minimum owned address, not necessarily the entry label.
          const byteOrigin = Math.min(...scanRanges.map((range) => range.start));
          const bytes = libraryFunctionBytes(artifacts, scan.qualifiedName);
          const prior = cia2FunctionVariants(artifacts, "priorNmi");
          expect(prior).toHaveLength(1);
          const priorEntry = libraryEntry(artifacts, "src/game.blend::Game.priorNmi");
          /** Check the actual entry's first instruction and return its page-safe link address. */
          const predecessor = (code: readonly number[], entry: number) => {
            expect(libraryBytes(artifacts, entry, 1)).toEqual([0x08]);
            expect(code.at(-3)).toBe(0x6c);
            const word = code.at(-2)! | (code.at(-1)! << 8);
            expect(word & 0xff).toBeLessThanOrEqual(0xfe);
            return word;
          };
          const priorLink = predecessor([...prior[0]!.bytes], priorEntry);
          const stockVector = await monitor.readMemory(0x318, 0x319);
          expect([...stockVector]).toEqual([0x47, 0xfe]);
          expect([...(await monitor.readMemory(0xfffa, 0xfffb))]).toEqual([0x43, 0xfe]);
          expect([...(await monitor.readMemory(0xfe43, 0xfe46))]).toEqual([0x78, 0x6c, 0x18, 3]);
          await monitor.writeIo(0xdc0d, Uint8Array.of(0x7f));
          await monitor.writeIo(0xdc0e, Uint8Array.of(0, 0));
          await stopAt(libraryEntry(artifacts, "src/game.blend::Game.beforeScan"));
          const before = await monitor.readCpuRegisters();
          expect(before.p & 0x0c).toBe(0);
          expect((await monitor.readIo(0xdd0d, 0xdd0d))[0]! & 0x1f).toBe(0);
          const priorVector = await monitor.readMemory(0x318, 0x319);
          expect(priorVector[0]! | (priorVector[1]! << 8)).toBe(priorEntry);
          expect(await monitor.readMemory(priorLink, priorLink + 1)).toEqual(stockVector);
          const priorWrites: number[] = [];
          for (const address of [priorLink, priorLink + 1])
            priorWrites.push(await monitor.setAccessTracepoint(address, "store"));
          await monitor.writeIo(0xdc00, Uint8Array.of(0xff, 0xff, 0xa5, 0x5a));
          const candidates = new Map<number, number>();
          const paStore = [0x8d, 0, 0xdc];
          // Gaps in the byte buffer never supply candidates; all three bytes must be owned.
          for (const range of scanRanges) {
            for (let address = range.start; address + 3 <= range.end; address += 1) {
              const offset = address - byteOrigin;
              if (!paStore.every((byte, index) => bytes[offset + index] === byte)) continue;
              if (candidates.has(address)) continue;
              candidates.set(address, await monitor.setExecuteCheckpoint(address));
            }
          }
          let scopedVector = priorVector;
          // Actual execution stops, not byte matches, establish the two instruction boundaries.
          for (const value of [0x7f, 0xff]) {
            const pending = monitor.waitForStop(20_000);
            await monitor.resume();
            const pc = await pending;
            expect(candidates.has(pc)).toBe(true);
            expect([...(await monitor.readMemory(pc, pc + 2))]).toEqual(paStore);
            expect((await monitor.readCpuRegisters()).a).toBe(value);
            scopedVector = await monitor.readMemory(0x318, 0x319);
            if (value === 0x7f) expect(scopedVector).toEqual(priorVector);
            else expect(scopedVector).not.toEqual(priorVector);
            await monitor.deleteCheckpoint(candidates.get(pc)!);
            candidates.delete(pc);
          }
          for (const id of candidates.values()) await monitor.deleteCheckpoint(id);
          expect(monitor.takeCheckpointHits().filter((id) => priorWrites.includes(id))).toEqual([]);
          const scoped = scopedVector[0]! | (scopedVector[1]! << 8);
          const selected = functions.flatMap((fn) =>
            fn.kind === "interrupt" &&
            typeof fn.qualifiedName === "string" &&
            profileRecords(fn.entryVariants).length === 1 &&
            libraryEntry(artifacts, fn.qualifiedName) === scoped
              ? [fn.qualifiedName]
              : [],
          );
          expect(selected).toHaveLength(1);
          const scopedLink = predecessor(libraryFunctionBytes(artifacts, selected[0]!), scoped);
          expect(await monitor.readMemory(scopedLink, scopedLink + 1)).toEqual(priorVector);
          const scopedWrites: number[] = [];
          for (const address of [scopedLink, scopedLink + 1])
            scopedWrites.push(await monitor.setAccessTracepoint(address, "store"));
          const linkWrites = [...priorWrites, ...scopedWrites];
          const pa = await monitor.setAccessTracepoint(0xdc00, "store");
          const marker = await monitor.setAccessTracepoint(0xc102, "store");
          const icr = await monitor.setAccessTracepoint(0xdd0d, "load");
          const icrWrite = await monitor.setAccessTracepoint(0xdd0d, "store");
          const effects = [pa, marker, icr, icrWrite];
          await monitor.writeIo(0xdd04, Uint8Array.of(2, 0));
          await monitor.writeIo(0xdd0d, Uint8Array.of(0x81));
          monitor.takeCheckpointHits();
          await monitor.writeIo(0xdd0e, Uint8Array.of(0x19));
          await stopAt(0xfe43);
          const accepted = await monitor.readCpuRegisters();
          const page = await monitor.readMemory(0x100, 0x1ff);
          const frame = [1, 2, 3].map((offset) => page[(accepted.sp + offset) & 0xff]!);
          const interrupted = frame[1]! | (frame[2]! << 8);
          expect(
            scanRanges.some((range) => interrupted >= range.start && interrupted < range.end),
          ).toBe(true);
          expect(frame[0]! & 0x14).toBe(4);
          expect(accepted.p & 4).toBe(4);
          expect(accepted.p & 8).toBe(frame[0]! & 8);
          expect(await monitor.readMemory(0x318, 0x319)).toEqual(scopedVector);
          const leading = monitor.takeCheckpointHits();
          const protectedIds = [marker, icr, icrWrite, ...linkWrites];
          expect(leading.filter((id) => protectedIds.includes(id))).toEqual([]);
          await stopAt(0xfe47);
          const chained = await monitor.readCpuRegisters();
          expect({ ...chained, p: chained.p & 0xcf }).toEqual({
            ...accepted,
            p: accepted.p & 0xcf,
          });
          const chainPage = await monitor.readMemory(0x100, 0x1ff);
          expect([1, 2, 3].map((offset) => chainPage[(accepted.sp + offset) & 0xff]!)).toEqual(
            frame,
          );
          const generated = monitor.takeCheckpointHits();
          expect(generated.filter((id) => effects.includes(id))).toEqual([pa, marker]);
          expect([...(await monitor.readIo(0xdc00, 0xdc00))]).toEqual([0x7f]);
          expect([...(await monitor.readMemory(0xc102, 0xc102))]).toEqual([1]);
          await stopAt(interrupted);
          const resumed = await monitor.readCpuRegisters();
          expect({ ...resumed, p: resumed.p & 0xcf }).toEqual({
            ...accepted,
            p: frame[0]! & 0xcf,
            sp: (accepted.sp + 3) & 0xff,
          });
          const stock = monitor.takeCheckpointHits();
          expect(stock.filter((id) => id === icr)).toHaveLength(1);
          expect(await monitor.readMemory(0x318, 0x319)).toEqual(scopedVector);
          const nmi = [...leading, ...generated, ...stock];
          // Both links are still live throughout this observed chain and return interval.
          expect(nmi.filter((id) => linkWrites.includes(id))).toEqual([]);
          await stopAt(libraryEntry(artifacts, "src/game.blend::Game.afterScan"));
          const after = await monitor.readCpuRegisters();
          expect({ p: after.p & 0x0c, sp: after.sp }).toEqual({
            p: before.p & 0x0c,
            sp: before.sp,
          });
          expect([...(await monitor.readMemory(0x320a, 0x320a))]).toEqual([1]);
          expect(await monitor.readMemory(0x318, 0x319)).toEqual(priorVector);
          expect(await monitor.readMemory(priorLink, priorLink + 1)).toEqual(stockVector);
          const throughScan = [...nmi, ...monitor.takeCheckpointHits()];
          // Only the outer route remains live here; neither link is observed after outer removal.
          expect(throughScan.filter((id) => priorWrites.includes(id))).toEqual([]);
          for (const id of linkWrites) await monitor.deleteCheckpoint(id);
          await stopAt(libraryStartup(artifacts, "startup.restore"));
          expect([...(await monitor.readMemory(0x3400, 0x3402))]).toEqual([2, 2, 2]);
          expect(await monitor.readMemory(0x318, 0x319)).toEqual(stockVector);
        },
        [false, false],
      );
    });
  },
  300_000,
);

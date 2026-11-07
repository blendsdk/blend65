import { join } from "node:path";
import { buildProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import { readProfileArtifacts, withProfileProject } from "./profile-fixture.js";
import { libraryEntry, libraryStartup, sourceLibraryProfiles } from "./source-library-fixture.js";
import {
  applyGdbInjection,
  prepareGdbInjection,
  startGdbVice,
  stopGdbVice,
} from "./gdb-vice-fixture.js";

const RAW = 0x6000;
const STRIDE = 11;
const NMI_STRIDE = 13;
const NMI_VECTOR_HIGH = 0x0319;
const STOCK_STOP_ENTRY = 0xfe66;

/** One installed acquisition followed by observable raw fields and a returning boundary. */
const liveNmiSource = `module Game;
import { readInputSnapshot, InputSnapshot, keyState, joystickState, Key, JoystickPort, JoystickControl } from c64.input;
place(at: $6000) let raw: byte[13];
function before(): void { asm_nop(); }
function after(): void { asm_nop(); }
function complete(): void { asm_nop(); }
function main(): void {
  asm_sei();
  before();
  let saved: InputSnapshot = readInputSnapshot();
  raw[0] = saved.rows[0];
  raw[1] = saved.rows[1];
  raw[2] = saved.rows[2];
  raw[3] = saved.rows[3];
  raw[4] = saved.rows[4];
  raw[5] = saved.rows[5];
  raw[6] = saved.rows[6];
  raw[7] = saved.rows[7];
  raw[8] = saved.joystick1;
  raw[9] = saved.joystick2;
  raw[10] = byte(saved.quality);
  raw[11] = byte(keyState(saved, Key.SPACE));
  raw[12] = byte(joystickState(saved, JoystickPort.PORT_1, JoystickControl.FIRE));
  after();
  complete();
  while (true) { asm_nop(); }
}`;

/** Save every raw observation field without deriving expectations from the compiler. */
function captureSource(cases: number): string {
  return `module Game;
import { readInputSnapshot, InputSnapshot } from c64.input;
place(at: $6000) let raw: byte[${cases * STRIDE}];
function begin(): void { asm_nop(); }
function end(): void { asm_nop(); }
function complete(): void { asm_nop(); }
function acquire(index: word): void {
  begin();
  let saved: InputSnapshot = readInputSnapshot();
  raw[index * ${STRIDE} + 0] = saved.rows[0];
  raw[index * ${STRIDE} + 1] = saved.rows[1];
  raw[index * ${STRIDE} + 2] = saved.rows[2];
  raw[index * ${STRIDE} + 3] = saved.rows[3];
  raw[index * ${STRIDE} + 4] = saved.rows[4];
  raw[index * ${STRIDE} + 5] = saved.rows[5];
  raw[index * ${STRIDE} + 6] = saved.rows[6];
  raw[index * ${STRIDE} + 7] = saved.rows[7];
  raw[index * ${STRIDE} + 8] = saved.joystick1;
  raw[index * ${STRIDE} + 9] = saved.joystick2;
  raw[index * ${STRIDE} + 10] = byte(saved.quality);
  end();
}
function main(): void {
  asm_sei();
  for (let i: word = 0; i < ${cases}; i += 1) { acquire(i); }
  complete();
  while (true) { asm_nop(); }
}`;
}

/** Build one active-low matrix entry for a physical column/row coordinate. */
function keyboardMatrix(column: number, row: number): readonly number[] {
  const matrix = new Array<number>(16).fill(0);
  matrix[column] = 1 << row;
  return matrix;
}

/** Resolve the private library marker that records one scoped acquisition interruption. */
function scanInterruptedAddress(
  artifacts: Awaited<ReturnType<typeof readProfileArtifacts>>,
): number {
  const match = [
    ...artifacts.labels.matchAll(
      /^\s*(b65_c64_input_scanInterrupted_[0-9a-f]+)\s*=\s*\$([0-9a-f]+)/gimu,
    ),
  ][0];
  if (match === undefined) throw new Error("Missing scanInterrupted library label");
  return Number.parseInt(match[2]!, 16);
}

/** Arm one wait before resuming so a short compiled window cannot race the monitor. */
async function resumeTo(
  monitor: Awaited<ReturnType<typeof startGdbVice>>["monitor"],
  address: number,
): Promise<void> {
  const stopped = monitor.waitForStop(30_000);
  await monitor.resume();
  expect(await stopped).toBe(address);
}

describe.sequential.each(sourceLibraryProfiles)(
  "native installed input acquisition on %s",
  (profile) => {
    it("should acquire every held keyboard matrix coordinate through readInputSnapshot", async () => {
      const cases = 64;
      await withProfileProject(captureSource(cases), profile, async (project, root) => {
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
        if (built.kind !== "success") throw new Error("Expected a complete native input build");
        const artifacts = await readProfileArtifacts(built);
        const begin = libraryEntry(artifacts, "src/game.blend::Game.begin");
        const complete = libraryEntry(artifacts, "src/game.blend::Game.complete");
        const session = await startGdbVice(
          join(built.generation.directory, built.generation.primaryArtifact),
          profile,
          {
            injection: join(root, "injection.json"),
            script: join(root, "inject.gdb"),
            log: join(root, "gdb.log"),
          },
          false,
        );
        try {
          const startupCheckpoint = await session.monitor.setExecuteCheckpoint(
            libraryStartup(artifacts, "startup.entry"),
          );
          await resumeTo(session.monitor, libraryStartup(artifacts, "startup.entry"));
          await session.monitor.deleteCheckpoint(startupCheckpoint);
          const beginCheckpoint = await session.monitor.setExecuteCheckpoint(begin);
          const completeCheckpoint = await session.monitor.setExecuteCheckpoint(complete);
          try {
            await resumeTo(session.monitor, begin);
            for (let index = 0; index < cases; index += 1) {
              const column = Math.floor(index / 8);
              const row = index % 8;
              const matrix = new Array<number>(16).fill(0);
              matrix[column] = 1 << row;
              await prepareGdbInjection(session, { matrix });
              await applyGdbInjection(session);
              await resumeTo(session.monitor, index + 1 === cases ? complete : begin);
            }
            const bytes = await session.monitor.readMemory(RAW, RAW + cases * STRIDE - 1);
            for (let index = 0; index < cases; index += 1) {
              const column = Math.floor(index / 8);
              const row = index % 8;
              const base = index * STRIDE;
              for (let sampled = 0; sampled < 8; sampled += 1) {
                const expected = sampled === column ? 0xff ^ (1 << row) : 0xff;
                expect(bytes[base + sampled], `case ${index} row ${sampled}`).toBe(expected);
              }
              // With no joystick device, both pulled-up ports read all ones.
              expect(bytes[base + 8], `case ${index} joystick1`).toBe(0xff);
              expect(bytes[base + 9], `case ${index} joystick2`).toBe(0xff);
              expect(bytes[base + 10], `case ${index} quality`).toBe(0);
            }
          } finally {
            await session.monitor.deleteCheckpoint(beginCheckpoint);
            await session.monitor.deleteCheckpoint(completeCheckpoint);
          }
        } finally {
          await stopGdbVice(session);
        }
      });
    }, 180_000);

    it("should acquire every simulated joystick state through readInputSnapshot", async () => {
      const cases = 64;
      await withProfileProject(captureSource(cases), profile, async (project, root) => {
        const built = await buildProject({ project, optimization: "none" });
        expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
        if (built.kind !== "success") throw new Error("Expected a complete native input build");
        const artifacts = await readProfileArtifacts(built);
        const begin = libraryEntry(artifacts, "src/game.blend::Game.begin");
        const complete = libraryEntry(artifacts, "src/game.blend::Game.complete");
        const session = await startGdbVice(
          join(built.generation.directory, built.generation.primaryArtifact),
          profile,
          {
            injection: join(root, "injection.json"),
            script: join(root, "inject.gdb"),
            log: join(root, "gdb.log"),
          },
          true,
        );
        try {
          const startupCheckpoint = await session.monitor.setExecuteCheckpoint(
            libraryStartup(artifacts, "startup.entry"),
          );
          await resumeTo(session.monitor, libraryStartup(artifacts, "startup.entry"));
          await session.monitor.deleteCheckpoint(startupCheckpoint);
          const beginCheckpoint = await session.monitor.setExecuteCheckpoint(begin);
          const completeCheckpoint = await session.monitor.setExecuteCheckpoint(complete);
          try {
            await resumeTo(session.monitor, begin);
            for (let index = 0; index < cases; index += 1) {
              const first = index < 32 ? index : 0x1f;
              const second = index < 32 ? 0x1f : index - 32;
              await session.monitor.setJoystick1(first);
              await session.monitor.setJoystick2(second);
              await prepareGdbInjection(session, { matrix: new Array<number>(16).fill(0) });
              await applyGdbInjection(session);
              await resumeTo(session.monitor, index + 1 === cases ? complete : begin);
            }
            const bytes = await session.monitor.readMemory(RAW, RAW + cases * STRIDE - 1);
            for (let index = 0; index < cases; index += 1) {
              const base = index * STRIDE;
              const first = index < 32 ? index : 0x1f;
              const second = index < 32 ? 0x1f : index - 32;
              expect(bytes[base + 8], `case ${index} joystick1`).toBe(first);
              expect(bytes[base + 9], `case ${index} joystick2`).toBe(second);
              expect(bytes[base + 10], `case ${index} quality`).toBe(0);
            }
          } finally {
            await session.monitor.deleteCheckpoint(beginCheckpoint);
            await session.monitor.deleteCheckpoint(completeCheckpoint);
          }
        } finally {
          await stopGdbVice(session);
        }
      });
    }, 180_000);
    const liveNmiScenarios = [
      {
        name: "a returning RESTORE",
        matrix: new Array<number>(16).fill(0),
        rows: new Array<number>(8).fill(0xff),
        expected: "after",
      },
      {
        name: "a false-STOP witness",
        matrix: keyboardMatrix(0, 7),
        rows: [0x7f, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff],
        expected: "after",
      },
      {
        name: "a genuine STOP",
        matrix: keyboardMatrix(7, 7),
        rows: null,
        expected: "timb",
      },
    ] as const;
    for (const scenario of liveNmiScenarios) {
      it(`should preserve ${scenario.name} through a live RESTORE`, async () => {
        await withProfileProject(liveNmiSource, profile, async (project, root) => {
          const built = await buildProject({ project, optimization: "none" });
          expect(built.kind, JSON.stringify(built.diagnostics)).toBe("success");
          if (built.kind !== "success") throw new Error("Expected a complete native input build");
          const artifacts = await readProfileArtifacts(built);
          const marker = scanInterruptedAddress(artifacts);
          const startup = libraryStartup(artifacts, "startup.entry");
          const before = libraryEntry(artifacts, "src/game.blend::Game.before");
          const after = libraryEntry(artifacts, "src/game.blend::Game.after");
          const session = await startGdbVice(
            join(built.generation.directory, built.generation.primaryArtifact),
            profile,
            {
              injection: join(root, "injection.json"),
              script: join(root, "inject.gdb"),
              log: join(root, "gdb.log"),
            },
            false,
          );
          try {
            const startupCheckpoint = await session.monitor.setExecuteCheckpoint(startup);
            await resumeTo(session.monitor, startup);
            await session.monitor.deleteCheckpoint(startupCheckpoint);
            const beforeCheckpoint = await session.monitor.setExecuteCheckpoint(before);
            const afterCheckpoint = await session.monitor.setExecuteCheckpoint(after);
            const timbCheckpoint = await session.monitor.setExecuteCheckpoint(STOCK_STOP_ENTRY);
            const trace = new Map<number, string>();
            try {
              await resumeTo(session.monitor, before);
              trace.set(await session.monitor.setAccessTracepoint(0xdc00, "store"), "PA");
              trace.set(await session.monitor.setAccessTracepoint(marker, "store"), "marker");
              session.monitor.takeCheckpointHits();
              await prepareGdbInjection(session, { matrix: scenario.matrix });
              await applyGdbInjection(session);
              const storeId = await session.monitor.setStoreCheckpoint(NMI_VECTOR_HIGH);
              const vectorStop = session.monitor.waitForStop(30_000);
              await session.monitor.resume();
              const vectorPc = await vectorStop;
              await session.monitor.deleteCheckpoint(storeId);
              // The store checkpoint stops after the high-byte store, so the vector is installed.
              expect(vectorPc).toBeLessThan(0xc000);
              // Ignore acquisition setup stores; only callback stores are evidence.
              session.monitor.takeCheckpointHits();
              const markerCheckpoint = await session.monitor.setStoreCheckpoint(marker);
              await prepareGdbInjection(session, { matrix: scenario.matrix, restore: 1 });
              await applyGdbInjection(session);
              const markerWait = session.monitor.waitForStop(30_000);
              await session.monitor.resume();
              const markerPc = await markerWait;
              expect(markerPc).toBeLessThan(0xc000);
              expect([...(await session.monitor.readMemory(marker, marker))]).toEqual([1]);
              await session.monitor.deleteCheckpoint(markerCheckpoint);
              const events = session.monitor.takeCheckpointHits().flatMap((id) => {
                const name = trace.get(id);
                return name === undefined ? [] : [name];
              });
              const markerIndex = events.indexOf("marker");
              expect(markerIndex).toBeGreaterThan(0);
              expect(events[markerIndex - 1]).toBe("PA");
              const stopWait = session.monitor.waitForStop(30_000);
              await session.monitor.resume();
              let stopPc: number;
              try {
                stopPc = await stopWait;
              } catch (error) {
                console.info("live NMI wait failed", await session.monitor.readCpuRegisters());
                throw error;
              }
              if (scenario.expected === "after") {
                expect(stopPc).toBe(after);
                const bytes = await session.monitor.readMemory(RAW, RAW + NMI_STRIDE - 1);
                expect(bytes[10]).toBe(1);
                expect([...bytes.slice(0, 8)]).toEqual(scenario.rows);
                expect(bytes[11]).toBe(2);
                expect(bytes[12]).toBe(2);
              } else {
                // STOP held across a returning RESTORE reaches the genuine stock STOP path.
                expect(stopPc).toBe(STOCK_STOP_ENTRY);
              }
            } finally {
              for (const id of trace.keys()) await session.monitor.deleteCheckpoint(id);
              await session.monitor.deleteCheckpoint(beforeCheckpoint);
              await session.monitor.deleteCheckpoint(afterCheckpoint);
              await session.monitor.deleteCheckpoint(timbCheckpoint);
            }
          } finally {
            await stopGdbVice(session);
          }
        });
      }, 180_000);
    }
  },
);

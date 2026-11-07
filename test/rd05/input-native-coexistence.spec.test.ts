import { buildProject } from "@blend65/compiler";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ViceMonitor } from "../m1/vice-monitor.js";
import {
  applyGdbInjection,
  prepareGdbInjection,
  startGdbVice,
  stopGdbVice,
} from "./gdb-vice-fixture.js";
import { readProfileArtifacts, withProfileProject } from "./profile-fixture.js";
import { libraryEntry, libraryStartup, sourceLibraryProfiles } from "./source-library-fixture.js";

/** Real-contact acquisition schedules, with scoped RESTORE events where required. */
type Schedule =
  | "mixed contacts"
  | "before publication"
  | "after publication"
  | "column sample"
  | "changing cursor at column sample"
  | "during removal"
  | "after direction restoration"
  | "genuine STOP"
  | "generated predecessor";

/** Make a held-key description without substituting saved rows or CPU frames. */
function contacts(schedule: Schedule, atPulse = false): number[] {
  const matrix = Array<number>(16).fill(0);
  if (schedule === "mixed contacts") {
    // Three closed rectangle edges leave DELETE open: shared grounds can still
    // make its row low. The named query must not turn that low into certainty.
    matrix[0] = 0x02;
    matrix[1] = 0x03;
  } else if (schedule === "genuine STOP") {
    matrix[7] = 0x80;
  } else if (schedule !== "changing cursor at column sample" || atPulse) {
    matrix[0] = 0x80;
  }
  return matrix;
}

/** Distinct balanced instruction sequences expose ordinary-source observation points. */
function observationPoint(name: string, depth: number): string {
  return `function ${name}(): void {
    ${"asm_php(); ".repeat(depth)}
    ${"asm_plp(); ".repeat(depth)}
  }`;
}

/** Express the byte and named-query oracle in the caller, not in patched memory. */
function sourceFor(schedule: Schedule): string {
  const interrupted = [
    "after publication",
    "column sample",
    "changing cursor at column sample",
    "genuine STOP",
    "generated predecessor",
  ].includes(schedule);
  const predicates = interrupted
    ? [
        "saved.quality == SnapshotQuality.INTERRUPTED",
        "keyState(saved, Key.RUN_STOP) == InputState.UNCERTAIN",
        "keyState(saved, Key.CURSOR_UP_DOWN) == InputState.UNCERTAIN",
        "joystickState(saved, JoystickPort.PORT_1, JoystickControl.UP) == InputState.UNCERTAIN",
        "joystickState(saved, JoystickPort.PORT_2, JoystickControl.UP) == InputState.UNCERTAIN",
      ]
    : schedule === "mixed contacts"
      ? [
          "saved.quality == SnapshotQuality.COMPLETE",
          ...Array.from({ length: 8 }, (_, column) => `saved.rows[${column}] == $1c`),
          "saved.joystick1 == $1c",
          "saved.joystick2 == $1c",
          "keyState(saved, Key.DELETE) == InputState.UNCERTAIN",
          "keyState(saved, Key.RETURN) == InputState.UNCERTAIN",
          "keyState(saved, Key.A) == InputState.OBSERVED_UP",
          "joystickState(saved, JoystickPort.PORT_1, JoystickControl.UP) == InputState.UNCERTAIN",
          "joystickState(saved, JoystickPort.PORT_2, JoystickControl.UP) == InputState.UNCERTAIN",
        ]
      : [
          "saved.quality == SnapshotQuality.COMPLETE",
          ...Array.from(
            { length: 8 },
            (_, column) => `saved.rows[${column}] == ${column === 0 ? "$7f" : "$ff"}`,
          ),
          "saved.joystick1 == $ff",
          "saved.joystick2 == $ff",
          "keyState(saved, Key.RUN_STOP) == InputState.OBSERVED_UP",
          "keyState(saved, Key.CURSOR_UP_DOWN) == InputState.OBSERVED_DOWN",
        ];
  const prior = schedule === "generated predecessor";
  return `module Game;
import { InputSnapshot, SnapshotQuality, InputState, Key, JoystickPort,
         JoystickControl, readInputSnapshot, keyState, joystickState } from c64.input;
${prior ? "import { setNMI, restoreNMI } from c64.system;" : ""}

${observationPoint("ready", 1)}
${observationPoint("afterScan", 2)}
${observationPoint("ownerRemoved", 3)}
${observationPoint("accepted", 4)}
${observationPoint("rejected", 5)}
${prior ? "interrupt function predecessor(): void { asm_sei(); }" : ""}

export function main(): void {
  asm_php();
  asm_sei();
  ${prior ? "setNMI(&predecessor);" : ""}
  ready();
  let saved: InputSnapshot = readInputSnapshot();
  afterScan();
  ${prior ? "restoreNMI();" : ""}
  ownerRemoved();
  if (${predicates.join(" &&\n      ")}) {
    accepted();
  } else {
    rejected();
  }
  asm_plp();
}
`;
}

/** Decode the complete published vector; a torn target must never be accepted. */
async function nmiVector(monitor: ViceMonitor): Promise<number> {
  const bytes = await monitor.readMemory(0x0318, 0x0319);
  expect(bytes).toHaveLength(2);
  const low = bytes[0];
  const high = bytes[1];
  if (low === undefined || high === undefined) throw new Error("Missing NMINV bytes");
  return low | (high << 8);
}

/** Arm the stop promise first, and retain checkpoint identities for ordered evidence. */
async function advance(monitor: ViceMonitor) {
  const stopped = monitor.waitForStop(30_000);
  await monitor.resume();
  const pc = await stopped;
  return { pc, hits: monitor.takeCheckpointHits() };
}

/**
 * Build an ordinary caller and observe native matrix, vector and RESTORE effects.
 * These are finite schedules, not a bound on external nesting, stack or ROM time.
 */
async function exercise(
  profile: (typeof sourceLibraryProfiles)[number],
  schedule: Schedule,
): Promise<void> {
  await withProfileProject(sourceFor(schedule), profile, async (project, root) => {
    const built = await buildProject({ project, optimization: "none" });
    if (built.kind !== "success") {
      throw new Error(
        `Native fixture build failed: ${built.diagnostics
          .map(({ code, message }) => `${code}: ${message}`)
          .join("; ")}`,
      );
    }
    const artifacts = await readProfileArtifacts(built);
    const markerMatches = [
      ...artifacts.labels.matchAll(
        /^\s*(b65_c64_input_scanInterrupted_[0-9a-f]+)\s*=\s*\$([0-9a-f]+)/gimu,
      ),
    ];
    expect(markerMatches, "one published scanner interruption marker").toHaveLength(1);
    const markerHex = markerMatches[0]?.[2];
    if (markerHex === undefined) throw new Error("Missing scanner marker label");
    const marker = Number.parseInt(markerHex, 16);
    const entry = (name: string) => libraryEntry(artifacts, `src/game.blend::Game.${name}`);
    const ready = entry("ready");
    const afterScan = entry("afterScan");
    const ownerRemoved = entry("ownerRemoved");
    const accepted = entry("accepted");
    const rejected = entry("rejected");
    expect(new Set([ready, afterScan, ownerRemoved, accepted, rejected]).size).toBe(5);
    const session = await startGdbVice(
      join(built.generation.directory, built.generation.primaryArtifact),
      profile,
      {
        injection: join(root, "coexistence-injection.json"),
        script: join(root, "coexistence-gdb.txt"),
        log: join(root, "coexistence-gdb.log"),
      },
      schedule === "mixed contacts",
    );
    try {
      const monitor = session.monitor;
      // Retain the attested input/machine/ROM identity in a failing native assertion.
      const context = JSON.stringify({ profile, schedule, identity: session.identity });
      const startup = libraryStartup(artifacts, "startup.entry");
      const startupCheckpoint = await monitor.setExecuteCheckpoint(startup);
      const readyCheckpoint = await monitor.setExecuteCheckpoint(ready);
      expect((await advance(monitor)).pc, context).toBe(startup);
      expect(await nmiVector(monitor), context).toBe(0xfe47);
      await monitor.deleteCheckpoint(startupCheckpoint);
      expect((await advance(monitor)).pc, context).toBe(ready);
      await monitor.deleteCheckpoint(readyCheckpoint);

      const prior = await nmiVector(monitor);
      if (schedule === "generated predecessor") expect(prior, context).not.toBe(0xfe47);
      else expect(prior, context).toBe(0xfe47);
      const originalDirections = await monitor.readIo(0xdc02, 0xdc03);
      await prepareGdbInjection(session, { matrix: contacts(schedule) });
      await applyGdbInjection(session);
      if (schedule === "mixed contacts") {
        // Both real simulated connectors ground UP. Their specified upper zero
        // bits and the three held contacts give $1C on both baseline ports and
        // every driven row, including the open DELETE position.
        await monitor.setJoystick1(0x1e);
        await monitor.setJoystick2(0x1e);
      }

      const paCheckpoint = await monitor.setStoreCheckpoint(0xdc00);
      const ddraCheckpoint = await monitor.setStoreCheckpoint(0xdc02);
      const ddrbCheckpoint = await monitor.setStoreCheckpoint(0xdc03);
      const lowCheckpoint = await monitor.setStoreCheckpoint(0x0318);
      const highCheckpoint = await monitor.setStoreCheckpoint(0x0319);
      const markerCheckpoint = await monitor.setStoreCheckpoint(marker);
      const priorCheckpoint = await monitor.setExecuteCheckpoint(prior);
      const stockCheckpoint =
        prior === 0xfe47 ? priorCheckpoint : await monitor.setExecuteCheckpoint(0xfe47);
      const stopCheckpoint = await monitor.setExecuteCheckpoint(0xfe66);
      const cia2ReadTrace = await monitor.setAccessTracepoint(0xdd0d, "load");
      const afterCheckpoint = await monitor.setExecuteCheckpoint(afterScan);
      const ownerCheckpoint = await monitor.setExecuteCheckpoint(ownerRemoved);
      const acceptedCheckpoint = await monitor.setExecuteCheckpoint(accepted);
      const rejectedCheckpoint = await monitor.setExecuteCheckpoint(rejected);

      let scanner: number | undefined;
      let scannerCheckpoint: number | undefined;
      let removed = false;
      let callerRestored = false;
      let callbackInFlight = false;
      let pulses = 0;
      let callbacks = 0;
      let markerWrites = 0;
      let priorEntries = 0;
      let stockEntries = 0;
      let scanReturned = false;
      let ownerReturned = false;
      let reachedStop = false;
      let reachedAccepted = false;
      const paWrites: number[] = [];
      const events: string[] = [];

      /** Feed a real hardware edge at the current stopped instruction boundary. */
      async function pulse(): Promise<void> {
        await prepareGdbInjection(session, {
          matrix: contacts(schedule, true),
          restore: 1,
        });
        await applyGdbInjection(session);
        pulses++;
      }

      // The bound protects the test driver, not the source or firmware deadline.
      for (let stops = 0; stops < 256; stops++) {
        const { pc, hits } = await advance(monitor);
        if (callbackInFlight) {
          expect(hits.includes(cia2ReadTrace), context).toBe(false);
        }
        if (scannerCheckpoint !== undefined && hits.includes(scannerCheckpoint)) {
          callbacks++;
          callbackInFlight = true;
        }
        if (hits.includes(priorCheckpoint)) {
          priorEntries++;
          callbackInFlight = false;
        }
        if (hits.includes(stockCheckpoint)) stockEntries++;

        if (hits.includes(paCheckpoint)) {
          const pa = (await monitor.readIo(0xdc00, 0xdc00))[0];
          if (pa === undefined) throw new Error("Missing PA observation");
          paWrites.push(pa);
          events.push(`PA:${pa}`);
          if (schedule === "before publication" && pulses === 0 && scanner === undefined) {
            expect(pa, context).toBe(0x7f);
            expect(await nmiVector(monitor), context).toBe(prior);
            await pulse();
          }
          const sampleSchedule = [
            "column sample",
            "changing cursor at column sample",
            "genuine STOP",
            "generated predecessor",
          ].includes(schedule);
          const requiredEarlierPulses = schedule === "generated predecessor" ? 1 : 0;
          if (
            sampleSchedule &&
            pa === 0xfe &&
            scanner !== undefined &&
            !removed &&
            pulses === requiredEarlierPulses
          ) {
            // A PA store checkpoint is after the column write and before its PB
            // load. Cursor U/D pulls PB7 low here, unlike the idle STOP column.
            if (schedule === "column sample" || schedule === "generated predecessor") {
              expect((await monitor.readIo(0xdc01, 0xdc01))[0], context).toBe(0x7f);
            } else if (schedule === "changing cursor at column sample") {
              expect((await monitor.readIo(0xdc01, 0xdc01))[0], context).toBe(0xff);
            }
            await pulse();
          }
        }

        if (hits.includes(markerCheckpoint)) {
          const value = (await monitor.readMemory(marker, marker))[0];
          if (value === 1) {
            expect(callbackInFlight, context).toBe(true);
            expect(events.at(-1), context).toBe(`PA:${0x7f}`);
            markerWrites++;
          } else {
            expect(value, context).toBe(0);
            expect(scanner, context).toBeUndefined();
          }
          events.push(`marker:${value}`);
        }

        if (hits.includes(lowCheckpoint) || hits.includes(highCheckpoint)) {
          const vector = await nmiVector(monitor);
          if (scanner === undefined && vector !== prior) {
            scanner = vector;
            scannerCheckpoint = await monitor.setExecuteCheckpoint(scanner);
            if (schedule === "after publication" || schedule === "generated predecessor") {
              await pulse();
            }
          } else if (scanner !== undefined && !removed && vector === prior) {
            // The last driven column and the scanner's separate final handoff
            // must both write idle PA before the predecessor becomes current.
            // With simulated joysticks, PA pin reads include external grounds
            // and cannot reveal the output latch. The no-joystick schedules
            // independently observe these two handoff writes.
            if (schedule !== "mixed contacts") {
              expect(paWrites.slice(-2), context).toEqual([0x7f, 0x7f]);
            }
            removed = true;
            if (schedule === "during removal") await pulse();
          } else {
            const permitted = callerRestored ? [prior, 0xfe47] : [prior, scanner];
            expect(permitted, context).toContain(vector);
          }
          events.push(`vector:${vector}`);
        }

        if (
          (hits.includes(ddraCheckpoint) || hits.includes(ddrbCheckpoint)) &&
          scanner !== undefined
        ) {
          expect(removed, "route removal precedes direction restoration").toBe(true);
        }
        if (hits.includes(afterCheckpoint)) {
          scanReturned = true;
          expect(removed, context).toBe(true);
          expect(await nmiVector(monitor), context).toBe(prior);
          expect(await monitor.readIo(0xdc02, 0xdc03), context).toEqual(originalDirections);
          if (schedule === "after direction restoration") await pulse();
          callerRestored = true;
        }
        if (hits.includes(ownerCheckpoint)) {
          ownerReturned = true;
          expect(await nmiVector(monitor), context).toBe(0xfe47);
        }
        if (hits.includes(stopCheckpoint)) {
          expect(schedule, context).toBe("genuine STOP");
          expect(pc, context).toBe(0xfe66);
          reachedStop = true;
          break;
        }
        if (hits.includes(rejectedCheckpoint)) {
          throw new Error(`Saved raw bytes, quality or named-query oracle failed: ${context}`);
        }
        if (hits.includes(acceptedCheckpoint)) {
          expect(schedule, "genuine STOP must reach the stock nonreturning path").not.toBe(
            "genuine STOP",
          );
          expect(pc, context).toBe(accepted);
          reachedAccepted = true;
          break;
        }
      }

      const expectedPulses =
        schedule === "mixed contacts" ? 0 : schedule === "generated predecessor" ? 2 : 1;
      const expectedCallbacks = [
        "after publication",
        "column sample",
        "changing cursor at column sample",
        "genuine STOP",
      ].includes(schedule)
        ? 1
        : schedule === "generated predecessor"
          ? 2
          : 0;
      expect(pulses, context).toBe(expectedPulses);
      expect(callbacks, context).toBe(expectedCallbacks);
      expect(markerWrites, context).toBe(expectedCallbacks);
      expect(priorEntries, "each event reaches the actual predecessor exactly once").toBe(
        expectedPulses,
      );
      expect(stockEntries, context).toBe(expectedPulses);
      expect(reachedStop, context).toBe(schedule === "genuine STOP");
      if (schedule !== "genuine STOP") {
        expect(scanReturned, context).toBe(true);
        expect(ownerReturned, context).toBe(true);
        expect(reachedAccepted, context).toBe(true);
        expect((await monitor.readMemory(marker, marker))[0], context).toBe(
          expectedCallbacks === 0 ? 0 : 1,
        );
      }
    } finally {
      await stopGdbVice(session);
    }
  });
}

describe.sequential("native combined input and NMI coexistence", () => {
  for (const profile of sourceLibraryProfiles) {
    describe(profile, () => {
      const schedules: readonly Schedule[] = [
        "mixed contacts",
        "before publication",
        "after publication",
        "column sample",
        "changing cursor at column sample",
        "during removal",
        "after direction restoration",
        "genuine STOP",
        "generated predecessor",
      ];
      for (const schedule of schedules) {
        it(schedule, () => exercise(profile, schedule), 180_000);
      }
    });
  }
});

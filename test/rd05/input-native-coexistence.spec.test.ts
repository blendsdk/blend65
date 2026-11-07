import { buildProject } from "@blend65/compiler";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ViceCpuRegisters, ViceMonitor } from "../m1/vice-monitor.js";
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
  | "final idle"
  | "overlapping entries"
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
    "final idle",
    "overlapping entries",
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

/**
 * PA values the scan writes to drive its eight column masks: each keeps exactly
 * one column-select line low. The last value, `$7F`, also serves as the idle
 * handoff because every column reads high, so the scan writes it twice: once as
 * column 7 and once as the separate final idle handoff after the sample.
 */
const ONE_LOW_COLUMN_MASKS = new Set([0xfe, 0xfd, 0xfb, 0xf7, 0xef, 0xdf, 0xbf, 0x7f]);

/** Decode the complete published vector; a torn target must never be accepted. */
async function nmiVector(monitor: ViceMonitor): Promise<number> {
  const bytes = await monitor.readMemory(0x0318, 0x0319);
  expect(bytes).toHaveLength(2);
  const low = bytes[0];
  const high = bytes[1];
  if (low === undefined || high === undefined) throw new Error("Missing NMINV bytes");
  return low | (high << 8);
}

/** Read the hardware frame as status, PC low, PC high, with page-one SP wrapping. */
async function readHardwareFrame(monitor: ViceMonitor, sp: number): Promise<number[]> {
  const stack: number[] = [];
  for (const offset of [1, 2, 3]) {
    const address = 0x0100 | ((sp + offset) & 0xff);
    const value = (await monitor.readMemory(address, address))[0];
    if (value === undefined) throw new Error("Missing interrupted stack byte");
    stack.push(value);
  }
  return stack;
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
        // Both VICE I/O-simulation connectors ground UP. This device drives all
        // eight joyport lines, so its raw byte holds the upper lines low rather
        // than the pull-up-high state of an ordinary five-line joystick. The
        // five driven bits and the named-query ambiguity are the contract
        // evidence; full-byte upper-line behavior stays hardware-unverified.
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
      let pulses = 0;
      let callbacks = 0;
      let frameChecks = 0;
      let markerWrites = 0;
      let markerPublished = false;
      let priorEntries = 0;
      let stockEntries = 0;
      let scanReturned = false;
      let ownerReturned = false;
      let reachedStop = false;
      let reachedAccepted = false;
      let finalIdleHandoff = false;
      // The scan's idle PA value appears twice after the scoped vector is
      // installed: first as column 7's low value, then as the library's
      // separate final idle handoff. Count only writes made while the scoped
      // route is installed and still current.
      let idleHandoffs = 0;
      // Every generated scanner entry owns one hardware frame until it reaches
      // the prior owner. A second genuine RESTORE can nest inside the first
      // entry, so pending frames form a LIFO stack instead of a single slot.
      const interruptedFrames: { registers: ViceCpuRegisters; stack: readonly number[] }[] = [];
      const paWrites: number[] = [];
      const events: string[] = [];

      /** Feed a real hardware edge at the current stopped instruction boundary. */
      async function pulse(overlapping = false): Promise<void> {
        if (overlapping) {
          // The outer generated entry is paused inside its callback and has not
          // chained to the prior owner yet. A second edge here must nest.
          expect(interruptedFrames, "the outer scanner entry is still active").toHaveLength(1);
        } else {
          expect(interruptedFrames, "previous scanner entry reached its predecessor").toHaveLength(
            0,
          );
        }
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
        if (scannerCheckpoint !== undefined && hits.includes(scannerCheckpoint)) {
          if (schedule === "overlapping entries") {
            // The first entry starts with nothing pending; the second must
            // still nest inside the first. An entry that arrives only after
            // the outer entry reached the prior owner would not be an overlap.
            expect(interruptedFrames.length, context).toBe(callbacks === 1 ? 1 : 0);
          } else {
            expect(interruptedFrames, "no unmatched scanner-entry frame").toHaveLength(0);
          }
          // Hardware NMI entry is complete, but the generated wrapper has not
          // started. Capture its actual incoming hardware frame;
          // the wrapper PC and current I cannot reconstruct the pushed PC/status.
          const registers = await monitor.readCpuRegisters();
          const stack = await readHardwareFrame(monitor, registers.sp);
          const pushedStatus = stack[0];
          if (pushedStatus === undefined) throw new Error("Missing NMI status byte");
          expect(pushedStatus & 0x30, "NMI stacks B clear and bit 5 set").toBe(0x20);
          const outer = interruptedFrames.at(-1);
          if (outer !== undefined) {
            // A nested entry pushes below the outer frame and must leave it
            // byte-for-byte intact. This is the observable proof that the
            // generated route re-enters without private activation storage.
            expect(
              (outer.registers.sp - registers.sp) & 0xff,
              "the inner entry nests below the outer hardware frame",
            ).toBeGreaterThan(0);
            expect(
              await readHardwareFrame(monitor, outer.registers.sp),
              "the outer hardware frame survives the inner entry",
            ).toEqual(outer.stack);
          }
          interruptedFrames.push({ registers, stack });
          callbacks++;
        }
        if (hits.includes(priorCheckpoint)) {
          const interrupted = interruptedFrames.pop();
          if (interrupted !== undefined) {
            const atPrior = await monitor.readCpuRegisters();
            expect(atPrior.a, context).toBe(interrupted.registers.a);
            expect(atPrior.x, context).toBe(interrupted.registers.x);
            expect(atPrior.y, context).toBe(interrupted.registers.y);
            // Compare N/V/D/Z/C. I is set on NMI entry; B and the unused bit are
            // synthesized status bits, not independent processor-state flags.
            expect(atPrior.p & 0xcb, context).toBe(interrupted.registers.p & 0xcb);
            expect(atPrior.p & 0x04, context).toBe(0x04);
            // All generated saves must be gone. The same hardware frame seen
            // at wrapper entry must remain byte-for-byte at the same SP.
            expect(atPrior.sp, `only the hardware frame remains: ${context}`).toBe(
              interrupted.registers.sp,
            );
            expect(await readHardwareFrame(monitor, atPrior.sp), context).toEqual(
              interrupted.stack,
            );
            frameChecks++;
          } else {
            // Direct stock-owner events have no generated scanner entry at
            // which to capture a frame. Their existing route checks still apply.
            expect(interruptedFrames, context).toHaveLength(0);
          }
          priorEntries++;
        }
        if (hits.includes(stockCheckpoint)) stockEntries++;

        if (hits.includes(paCheckpoint)) {
          const pa = (await monitor.readIo(0xdc00, 0xdc00))[0];
          if (pa === undefined) throw new Error("Missing PA observation");
          paWrites.push(pa);
          events.push(`PA:${pa}`);
          // Track idle handoff writes made after the scoped vector was
          // installed. The column-7 store and the library's separate final
          // idle store both write the same value.
          if (pa === 0x7f && scanner !== undefined) idleHandoffs++;
          if (schedule === "before publication" && pulses === 0 && scanner === undefined) {
            expect(pa, context).toBe(0x7f);
            expect(await nmiVector(monitor), context).toBe(prior);
            await pulse();
          }
          if (
            schedule === "final idle" &&
            pa === 0x7f &&
            scanner !== undefined &&
            !removed &&
            pulses === 0 &&
            idleHandoffs === 2
          ) {
            // This is the second $7F store after publication. The first was
            // column 7's own low value; this one is the library's separate
            // final idle handoff, after all eight columns were driven. A
            // returning NMI here must still be seen by the installed callback
            // and still make the snapshot interrupted.
            expect(
              new Set(paWrites.filter((value) => ONE_LOW_COLUMN_MASKS.has(value))),
              context,
            ).toEqual(ONE_LOW_COLUMN_MASKS);
            expect(await nmiVector(monitor), context).toBe(scanner);
            finalIdleHandoff = true;
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
            expect(interruptedFrames.length, context).toBeGreaterThan(0);
            expect(events.at(-1), context).toBe(`PA:${0x7f}`);
            // The callback body ends at this marker store: it writes idle PA,
            // then the marker, then chains to the prior owner. A real
            // predecessor may legitimately read CIA2 ICR, so the check is
            // scoped to the callback's own work observed up to this stop.
            expect(hits.includes(cia2ReadTrace), context).toBe(false);
            markerPublished = true;
            markerWrites++;
            if (schedule === "overlapping entries" && pulses === 1) {
              // The first generated entry has written PA then marker and has
              // not chained to the prior owner yet. A second genuine RESTORE
              // here overlaps that entry instead of following it.
              await pulse(true);
            }
          } else {
            expect(value, context).toBe(0);
            expect(markerPublished, "the interruption marker is monotonic while installed").toBe(
              false,
            );
            expect(scanner, context).toBeUndefined();
          }
          events.push(`marker:${value}`);
        }

        if (hits.includes(lowCheckpoint) || hits.includes(highCheckpoint)) {
          const vector = await nmiVector(monitor);
          if (scanner === undefined && vector !== prior) {
            scanner = vector;
            scannerCheckpoint = await monitor.setExecuteCheckpoint(scanner);
            if (
              schedule === "after publication" ||
              schedule === "generated predecessor" ||
              schedule === "overlapping entries"
            ) {
              await pulse();
            }
          } else if (scanner !== undefined && !removed && vector === prior) {
            // The last driven column and the scanner's separate final handoff
            // must both write idle PA before the predecessor becomes current.
            // With simulated joysticks, PA pin reads include external grounds
            // and cannot reveal the output latch. The no-joystick schedules
            // independently observe these two handoff writes.
            if (schedule === "final idle") {
              // The prior owner legitimately runs between the scan's own handoff
              // and route removal here, so a later firmware PA write must not be
              // mistaken for the scan's handoff. The handoff itself was observed
              // with the scoped route still installed at the final idle write.
              expect(finalIdleHandoff, context).toBe(true);
            } else if (schedule !== "mixed contacts") {
              expect(paWrites.slice(-2), context).toEqual([0x7f, 0x7f]);
            }
            removed = true;
            if (schedule === "during removal") {
              await pulse();
            }
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
          if (schedule === "after direction restoration") {
            await pulse();
          }
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
        schedule === "mixed contacts"
          ? 0
          : schedule === "generated predecessor" || schedule === "overlapping entries"
            ? 2
            : 1;
      const expectedCallbacks = [
        "after publication",
        "column sample",
        "changing cursor at column sample",
        "final idle",
        "genuine STOP",
      ].includes(schedule)
        ? 1
        : schedule === "generated predecessor" || schedule === "overlapping entries"
          ? 2
          : 0;
      expect(pulses, context).toBe(expectedPulses);
      expect(callbacks, context).toBe(expectedCallbacks);
      expect(frameChecks, context).toBe(expectedCallbacks);
      expect(markerWrites, context).toBe(expectedCallbacks);
      expect(priorEntries, "each event reaches the actual predecessor exactly once").toBe(
        expectedPulses,
      );
      expect(interruptedFrames, "every scanner entry has a checked predecessor frame").toHaveLength(
        0,
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
        "final idle",
        "overlapping entries",
        "genuine STOP",
        "generated predecessor",
      ];
      for (const schedule of schedules) {
        it(schedule, () => exercise(profile, schedule), 180_000);
      }
    });
  }
});

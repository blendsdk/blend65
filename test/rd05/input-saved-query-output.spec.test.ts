import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildProfileSource, profileRecords } from "./profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryGlobalAddress,
  sourceLibraryProfiles,
} from "./source-library-fixture.js";

describe.each(sourceLibraryProfiles)("saved input output on %s", (profile) => {
  it("fits the complete expert saved-query caller without copied snapshots or uncharged storage", async () => {
    const source = await readFile(
      new URL("./fixtures/input-saved-caller.blend", import.meta.url),
      "utf8",
    );
    const artifacts = await buildProfileSource(source, profile, "size");
    expectLibraryAccounting(artifacts);

    // One complete candidate: stub12 + startup102 + caller78 + queries533.
    // General suffix20 = platform captures7 + source snapshot11/results2.
    // Physical ZP14 includes sibling and dead-slot overlays, not a second scratch pool.
    // Its CPU path witnesses and placement are in input-whole-saved.a.
    expect(artifacts.prg.length - 2).toBeLessThanOrEqual(725);
    expect(artifacts.prg.readUInt16LE(0)).toBe(0x0801);
    expect([...artifacts.prg.subarray(2, 14)]).toEqual([
      0x0b, 0x08, 0x0a, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0, 0, 0,
    ]);

    const saved = libraryGlobalAddress(
      artifacts,
      source,
      "let saved: InputSnapshot;",
      11,
      "src/game.blend",
    );
    const key = libraryGlobalAddress(
      artifacts,
      source,
      "let keyResult: InputState;",
      1,
      "src/game.blend",
    );
    const joystick = libraryGlobalAddress(
      artifacts,
      source,
      "let joystickResult: InputState;",
      1,
      "src/game.blend",
    );
    expect(key < saved || key >= saved + 11).toBe(true);
    expect(joystick < saved || joystick >= saved + 11).toBe(true);
    expect(joystick).not.toBe(key);

    const intervals = profileRecords(artifacts.memory.intervals);
    expect(intervals.length).toBeGreaterThan(0);
    const allocated: { start: number; end: number; resource: string }[] = [];
    for (const interval of intervals) {
      const { start, end, size, payloadBytes, paddingBytes, reservedBytes } = interval;
      if (
        typeof start !== "number" ||
        typeof end !== "number" ||
        typeof size !== "number" ||
        typeof payloadBytes !== "number" ||
        typeof paddingBytes !== "number" ||
        typeof reservedBytes !== "number"
      )
        throw new TypeError("Complete physical interval arithmetic is required");
      expect(Number.isInteger(start) && Number.isInteger(end)).toBe(true);
      expect(size).toBe(end - start);
      expect(size).toBe(payloadBytes + paddingBytes + reservedBytes);
      expect(size).toBeGreaterThanOrEqual(0);
      // Stable qualification RAM is outside every allocated code/data/frame home.
      expect(end <= 0xc100 || start >= 0xc105).toBe(true);
      expect(end <= 0xc110 || start >= 0xc11b).toBe(true);
      if (interval.resourceClass === "zeroPage") {
        expect(start).toBeGreaterThanOrEqual(0x02);
        expect(end).toBeLessThanOrEqual(0x90);
      } else {
        expect(interval.resourceClass).toBe("general");
        expect(start).toBeGreaterThanOrEqual(0x0801);
        expect(end).toBeLessThanOrEqual(0xd000);
      }
      allocated.push({ start, end, resource: String(interval.resourceClass) });
    }
    // Logical sibling-frame aliases do not allocate the same physical bytes twice.
    const owned = { general: 0, zeroPage: 0 };
    for (const resource of ["general", "zeroPage"] as const) {
      const ranges = allocated
        .filter((entry) => entry.resource === resource)
        .sort((a, b) => a.start - b.start);
      let coveredEnd = -1;
      for (const range of ranges) {
        owned[resource] += Math.max(0, range.end - Math.max(range.start, coveredEnd));
        coveredEnd = Math.max(coveredEnd, range.end);
      }
    }
    expect(owned.general).toBeLessThanOrEqual(745);
    expect(owned.zeroPage).toBeLessThanOrEqual(14);
    expect(owned.general + owned.zeroPage).toBeLessThanOrEqual(759);
    expect(artifacts.memory).toMatchObject({ profileId: profile, acmeReconciled: true });
    expect(artifacts.memory.sfaClosureSha256).toMatch(/^[0-9a-f]{64}$/);

    const routes = profileRecords(artifacts.memory.stackDomains);
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      const { peakBytes, headroomBytes, capacityBytes } = route;
      if (
        typeof peakBytes !== "number" ||
        typeof headroomBytes !== "number" ||
        typeof capacityBytes !== "number"
      )
        throw new TypeError("Missing bounded stack route");
      expect(peakBytes + headroomBytes).toBe(capacityBytes);
      expect(peakBytes).toBeLessThanOrEqual(5);
      expect(headroomBytes).toBeGreaterThanOrEqual(0);
    }
    // Whole wall time/external IRQ/NMI remains Unknown. CPU path acceptance uses
    // the existing native debugger route, not invented monitor cycle methods.
  }, 120_000);
});

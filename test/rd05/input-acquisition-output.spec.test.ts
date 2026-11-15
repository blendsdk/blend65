import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildProfileSource, profileRecords } from "./profile-fixture.js";
import {
  expectLibraryAccounting,
  libraryGlobalAddress,
  sourceLibraryProfiles,
} from "./source-library-fixture.js";

describe.each(sourceLibraryProfiles)("input acquisition output on %s", (profile) => {
  it("charges the scoped NMI route and complete caller rather than a scan-only estimate", async () => {
    const source = await readFile(
      new URL("./fixtures/input-caller.blend", import.meta.url),
      "utf8",
    );
    const artifacts = await buildProfileSource(source, profile, "size");
    expectLibraryAccounting(artifacts);
    // This complete fast artifact includes startup, acquisition, both queries,
    // caller, helper code, callback and its thirteen serialized placement bytes.
    // The equal-contract expert looped form is 877 payload bytes / 898 general /
    // 912 combined and one fewer stack byte. That is the correct `size` byte
    // minimum; the current 943-byte output is 66 bytes above it because the
    // looped transform is not admitted to the size frontier.
    expect(artifacts.prg.length - 2).toBeLessThanOrEqual(963);
    const saved = libraryGlobalAddress(
      artifacts,
      source,
      "let saved: InputSnapshot;",
      11,
      "src/game.blend",
    );
    expect(saved).toBeGreaterThanOrEqual(0x0801 + artifacts.prg.length - 2);

    expect(artifacts.memory).toMatchObject({
      profileId: profile,
      acmeReconciled: true,
      runtimeMemorySafety: "unproven",
    });
    // Unrestricted external NMI re-entry cannot become a finite whole-machine
    // stack promise merely because each emitted route has a bounded component.
    expect(profileRecords(artifacts.memory.unboundedEffects).length).toBeGreaterThan(0);
    const stack = profileRecords(artifacts.memory.stackDomains);
    expect(stack.length).toBeGreaterThan(0);
    for (const route of stack) {
      const { peakBytes, headroomBytes, capacityBytes } = route;
      if (
        typeof peakBytes !== "number" ||
        typeof headroomBytes !== "number" ||
        typeof capacityBytes !== "number"
      )
        throw new TypeError("Missing generated stack route");
      expect(peakBytes + headroomBytes).toBe(capacityBytes);
      expect(peakBytes).toBeLessThanOrEqual(10);
      expect(headroomBytes).toBeGreaterThanOrEqual(0);
    }

    const entries = profileRecords(artifacts.costs.entries);
    expect(entries.length).toBeGreaterThan(0);
    const byteCosts = entries.filter((entry) => entry.kind === "bytes");
    expect(byteCosts.length).toBeGreaterThan(0);
    for (const entry of byteCosts) {
      expect(entry.bytes).toBeTypeOf("number");
      expect(Number.isInteger(entry.bytes)).toBe(true);
      expect(entry.bytes as number).toBeGreaterThanOrEqual(0);
      expect(entry.accounting).toBeOneOf([
        "program",
        "residentRam",
        "zeroPage",
        "sfa",
        "scratch",
        "existingRom",
      ]);
      expect(profileRecords(entry.sourceSites)).toBeInstanceOf(Array);
      expect(Array.isArray(entry.dependencyIds)).toBe(true);
    }
    const cycles = entries.filter((entry) => entry.kind === "cycles");
    expect(cycles.length).toBeGreaterThan(0);
    for (const entry of cycles) {
      expect(typeof entry.pathId).toBe("string");
      expect(profileRecords(entry.traffic)).toBeInstanceOf(Array);
      expect(profileRecords(entry.sourceSites)).toBeInstanceOf(Array);
      expect(Array.isArray(entry.dependencyIds)).toBe(true);
      // ROM/retained-owner Unknown is not coerced to zero or a finite deadline.
      const measured = entry.cycles;
      if (measured === null || typeof measured !== "object" || Array.isArray(measured))
        throw new TypeError("Missing measured CPU cycle evidence");
      const measurement = measured as Record<string, unknown>;
      expect(measurement.kind).toBeOneOf(["unknown", "exact", "range", "symbolic"]);
      if (measurement.kind === "unknown") {
        expect(measurement.value).toBeUndefined();
        expect(measurement.minimum).toBeUndefined();
        expect(measurement.maximum).toBeUndefined();
      }
    }
    // Exact volatile14-read/15-write scan paths, callback order/flags/link and
    // full CPU witnesses are independently observable through existing runtime
    // tests/debugger evidence. No monitor timing API is added by this file.
  }, 120_000);
});

import { describe, expect, it } from "vitest";
import { selectTargetProfile } from "./profile.js";

// These expectations come from the selected machine contracts, not a production facts table.
const profiles = [
  ["c64-pal-prg-kernal-6581", "c64-pal-kernal-901227-03-6581", 19656],
  ["c64-pal-prg-kernal-8580", "c64-pal-kernal-901227-03-8580", 19656],
  ["c64-ntsc-prg-kernal-6581", "c64-ntsc-kernal-901227-03-6581", 17095],
  ["c64-ntsc-prg-kernal-8580", "c64-ntsc-kernal-901227-03-8580", 17095],
] as const;

const takeover = [
  ["c64-pal-prg-takeover-6581", "c64-pal-takeover-6581", 19656, 312, 6581],
  ["c64-pal-prg-takeover-8580", "c64-pal-takeover-8580", 19656, 312, 8580],
  ["c64-ntsc-prg-takeover-6581", "c64-ntsc-takeover-6581", 17095, 263, 6581],
  ["c64-ntsc-prg-takeover-8580", "c64-ntsc-takeover-8580", 17095, 263, 8580],
] as const;

const unsupported = [
  "c64-pal",
  "C64-PAL-PRG-KERNAL-6581",
  "c64-pal-prg-kernal-6581; echo profile-injection",
  "$(echo c64-pal-prg-kernal-6581)",
] as const;

describe("closed cooperative C64 backend selection", () => {
  // Video and SID selection change identity while the CPU, container and owned memory stay common.
  it.each(profiles)(
    "should compose exact machine and storage facts for %s",
    (id, machine, cycles) => {
      const result = selectTargetProfile(id);
      expect(result.kind, JSON.stringify(result)).toBe("complete");
      if (result.kind !== "complete") throw new Error(`Target ${id} was rejected`);
      expect(result.profile.id).toBe(id);
      expect(result.profile.machine).toMatchObject({
        id: machine,
        cyclesPerFrame: cycles,
        frameWaitRasterLine: 0xfb,
      });
      expect(result.profile.cpu.id).toBe("nmos6510");
      expect(result.profile.serializer.id).toBe("acme-0.97");
      expect(result.profile.packager).toEqual({
        id: "cbm-prg",
        loadAddress: 0x0801,
        startupAddress: 0x080d,
        residentStart: 0x0801,
        residentEnd: 0xcfff,
      });
      expect(result.profile.storage).toMatchObject({
        profileId: id,
        zeroPage: [{ start: 0x02, end: 0x8f }],
        hardwareStackCapacity: 256,
        hardwareStackReserve: 20,
      });
      const zeroPageBytes = result.profile.storage.zeroPage.reduce(
        (sum, range) => sum + range.end - range.start + 1,
        0,
      );
      expect(zeroPageBytes).toBe(142);
      expect(result.profile.packager.residentEnd - result.profile.packager.residentStart + 1).toBe(
        51199,
      );
    },
  );

  // The D64 profile keeps the PAL/6581 machine facts and selects the disk packager.
  it("should compose the D64 profile with the disk packager", () => {
    const result = selectTargetProfile("c64-pal-d64-kernal-6581");
    expect(result.kind, JSON.stringify(result)).toBe("complete");
    if (result.kind !== "complete") throw new Error("D64 target was rejected");
    expect(result.profile.id).toBe("c64-pal-d64-kernal-6581");
    expect(result.profile.machine).toMatchObject({
      id: "c64-pal-kernal-901227-03-6581",
      cyclesPerFrame: 19656,
    });
    expect(result.profile.packager).toMatchObject({
      id: "cbm-d64",
      loadAddress: 0x0801,
      startupAddress: 0x080d,
      residentStart: 0x0801,
      residentEnd: 0xcfff,
      imageBytes: 174_848,
      allocationPolicyId: "cbm-dos-1541-interleave-v1",
    });
  });

  // Takeover profiles own the raw vector map and reserve no firmware stack bytes.
  it.each(takeover)(
    "should compose takeover machine and interrupt facts for %s",
    (id, machine, cycles, rasterLines, sidModel) => {
      const result = selectTargetProfile(id);
      expect(result.kind, JSON.stringify(result)).toBe("complete");
      if (result.kind !== "complete") throw new Error(`Target ${id} was rejected`);
      expect(result.profile.machine).toMatchObject({
        id: machine,
        ownership: "takeover",
        processorPortMapping: 0x05,
        rawIrqVector: 0xfffe,
        rawNmiVector: 0xfffa,
        cyclesPerFrame: cycles,
      });
      expect(result.profile.storage).toMatchObject({
        profileId: id,
        hardwareStackCapacity: 256,
        hardwareStackReserve: 0,
      });
      expect(result.profile.interrupts.variants.map(({ id: variant }) => variant)).toEqual([
        "c64_raw_irq",
      ]);
      expect(result.profile.interrupts.sinks).toEqual([
        {
          capability: "c64.system.setRawIRQ",
          acceptedSourceKind: "interrupt-handler",
          variant: "c64_raw_irq",
          domain: "irq",
          source: "irq",
          masksSelfOnEntry: true,
          externalReentryBound: "unbounded",
          vector: 0xfffe,
        },
      ]);
      expect(result.profile.packager.id).toBe("cbm-prg");
      expect(rasterLines).toBeGreaterThan(0);
      expect(sidModel).toBeGreaterThan(0);
    },
  );

  // Rejection must identify the literal request and the complete deterministic executable allowlist.
  it.each(unsupported)(
    "should reject unsupported or nonliteral target %s without fallback",
    (id) => {
      const result = selectTargetProfile(id);
      expect(result.kind).toBe("error");
      if (result.kind !== "error") throw new Error(`Unexpected target admission: ${id}`);
      expect(result.diagnostics).toHaveLength(1);
      const diagnostic = result.diagnostics[0]!;
      expect(diagnostic.code).toBe("E10279");
      const text = `${diagnostic.message}\n${diagnostic.help ?? ""}`;
      expect(text).toContain(id);
      let previous = -1;
      for (const [allowed] of profiles) {
        // Start after the quoted request so a supported-looking prefix cannot stand in for the list.
        const position = text.indexOf(
          allowed,
          Math.max(previous + 1, text.indexOf(id) + id.length),
        );
        expect(position, `Missing ordered allowed target ${allowed}: ${text}`).toBeGreaterThan(
          previous,
        );
        previous = position;
      }
    },
  );
});

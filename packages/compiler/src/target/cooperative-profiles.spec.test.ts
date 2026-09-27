import { describe, expect, it } from "vitest";
import { selectTargetProfile } from "./profile.js";

// These expectations come from the selected machine contracts, not a production facts table.
const profiles = [
  ["c64-pal-prg-kernal-6581", "c64-pal-kernal-901227-03-6581", 19656],
  ["c64-pal-prg-kernal-8580", "c64-pal-kernal-901227-03-8580", 19656],
  ["c64-ntsc-prg-kernal-6581", "c64-ntsc-kernal-901227-03-6581", 17095],
  ["c64-ntsc-prg-kernal-8580", "c64-ntsc-kernal-901227-03-8580", 17095],
] as const;

const unsupported = [
  "c64-pal-prg-takeover-6581",
  "c64-pal-prg-takeover-8580",
  "c64-ntsc-prg-takeover-6581",
  "c64-ntsc-prg-takeover-8580",
  "c64-pal-d64-kernal-6581",
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

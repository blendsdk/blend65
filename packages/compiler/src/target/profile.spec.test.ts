import { describe, expect, it } from "vitest";
import { selectTargetProfile } from "./profile.js";

describe("target profile selection", () => {
  // The admitted C64 profile composes four independently identified toolchain facts.
  it("should select the exact C64 PAL PRG profile facts", () => {
    const result = selectTargetProfile("c64-pal-prg-kernal-6581");

    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected the admitted target profile");
    expect(result.profile.id).toBe("c64-pal-prg-kernal-6581");
    expect(result.profile.cpu.id).toBe("nmos6510");
    expect(result.profile.machine.id).toBe("c64-pal-kernal-901227-03-6581");
    expect(result.profile.serializer.id).toBe("acme-0.97");
    expect(result.profile.packager.id).toBe("cbm-prg");
    expect(result.profile.storage.profileId).toBe("c64-pal-prg-kernal-6581");
    expect(result.profile.cpu).not.toBe(result.profile.machine);
    expect(result.profile.machine).not.toBe(result.profile.serializer);
    expect(result.profile.serializer).not.toBe(result.profile.packager);
  });

  // An unknown profile is terminal and must never select a fallback target.
  it("should reject an unknown profile without returning partial target facts", () => {
    const result = selectTargetProfile("c64-unknown-profile");

    expect(result.kind).toBe("error");
    expect(result).not.toHaveProperty("profile");
    expect(result).toHaveProperty("diagnostics");
    expect(JSON.stringify(result)).toContain("c64-unknown-profile");
  });
});

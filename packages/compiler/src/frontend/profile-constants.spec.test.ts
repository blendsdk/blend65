import { describe, expect, it } from "vitest";
import { firmwareVectorSink, selectFrontendProfile } from "./profile.js";

const profiles = [
  { id: "c64-pal-prg-kernal-6581", pal: true, sid: 6581n },
  { id: "c64-pal-prg-kernal-8580", pal: true, sid: 8580n },
  { id: "c64-ntsc-prg-kernal-6581", pal: false, sid: 6581n },
  { id: "c64-ntsc-prg-kernal-8580", pal: false, sid: 8580n },
] as const;

/** Compare public semantic types by their source spelling. */
function typeName(type: { readonly kind: string; readonly name?: string }): string {
  return type.kind === "scalar" ? (type.name ?? "<missing>") : type.kind;
}

describe.each(profiles)("frontend facts for $id", ({ id, pal, sid }) => {
  // Every selection exposes exactly the independently specified scalar facts in name order.
  it("should expose exactly fourteen typed constants in stable qualified-name order", () => {
    const result = selectFrontendProfile(id);
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected complete profile selection");
    expect(result.profile.id).toBe(id);
    expect(
      result.profile.constants.map(({ name, type, value }) => [name, typeName(type), value]),
    ).toEqual([
      ["c64.profile.cpuClockHzRemainder", "word", pal ? 248n : 730n],
      ["c64.profile.cpuClockKilohertz", "word", pal ? 985n : 1022n],
      ["c64.profile.cyclesPerFrame", "word", pal ? 19656n : 17095n],
      ["c64.profile.cyclesPerLine", "byte", pal ? 63n : 65n],
      ["c64.profile.frameRateFractionDenominator", "word", pal ? 273n : 3419n],
      ["c64.profile.frameRateFractionNumerator", "word", pal ? 34n : 2825n],
      ["c64.profile.frameRateWhole", "byte", pal ? 50n : 59n],
      ["c64.profile.hasRawInterrupts", "boolean", false],
      ["c64.profile.isNtsc", "boolean", !pal],
      ["c64.profile.isPal", "boolean", pal],
      ["c64.profile.rasterLines", "word", pal ? 312n : 263n],
      ["c64.profile.sidAddress", "word", 0xd400n],
      ["c64.profile.sidModel", "word", sid],
      ["c64.profile.usesKernal", "boolean", true],
    ]);
  });

  // Adding facts preserves the full existing source operation contract for every selected ID.
  it("should preserve all seventeen operation signatures and effects", () => {
    const result = selectFrontendProfile(id);
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error("Expected complete profile selection");
    expect(
      result.profile.capabilities.map(({ name, parameters, returnType, effect }) => [
        name,
        parameters.map(typeName),
        typeName(returnType),
        effect,
      ]),
    ).toEqual([
      ["c64.input.joystickFire", ["byte"], "boolean", "pure"],
      ["c64.input.joystickLeft", ["byte"], "boolean", "pure"],
      ["c64.input.joystickRight", ["byte"], "boolean", "pure"],
      ["c64.input.readJoystick2", [], "byte", "volatile-read"],
      ["c64.system.restoreIRQ", [], "void", "volatile-write"],
      ["c64.system.restoreNMI", [], "void", "volatile-write"],
      ["c64.system.setIRQ", ["interrupt-handler"], "void", "volatile-write"],
      ["c64.system.setIRQExclusive", ["interrupt-handler"], "void", "volatile-write"],
      ["c64.system.setNMI", ["interrupt-handler"], "void", "volatile-write"],
      ["c64.system.setNMIExclusive", ["interrupt-handler"], "void", "volatile-write"],
      ["c64.vic.setBorderColor", ["byte"], "void", "volatile-write"],
      ["c64.vic.setSpriteColor", ["byte", "byte"], "void", "volatile-write"],
      ["c64.vic.setSpriteEnabled", ["byte", "boolean"], "void", "volatile-write"],
      ["c64.vic.setSpritePointer", ["byte", "byte"], "void", "volatile-write"],
      ["c64.vic.setSpritePosition", ["byte", "word", "byte"], "void", "volatile-write"],
      ["c64.vic.vicSpriteBlock", ["word"], "byte", "pure"],
      ["c64.video.waitNextFrame", [], "void", "ordered-wait"],
    ]);
  });

  // Cooperative vector restrictions identify required installers without proving NMI safety.
  it.each([
    [0x0314n, "c64.system.setIRQ"],
    [0x0318n, "c64.system.setNMI"],
    [0x0400n, null],
  ])("should restrict firmware vector %s to %s", (address, sink) => {
    expect(firmwareVectorSink(id, address)).toBe(sink);
  });
});

describe("closed frontend profile selection", () => {
  // Unknown and partial IDs never inherit a supported profile's environment.
  it.each(["c64-pal-prg-kernal-9999", "c64-pal-prg-takeover-6581", "c64-pal", "unknown"])(
    "should reject %s with its exact requested identity and deterministic supported list",
    (id) => {
      const result = selectFrontendProfile(id);
      expect(result.kind).toBe("error");
      expect(result).not.toHaveProperty("profile");
      if (result.kind !== "error") throw new Error("Expected rejected profile selection");
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0]).toMatchObject({ code: "E10279", severity: "error" });
      const message = result.diagnostics[0]?.message ?? "";
      expect(message).toContain(`'${id}'`);
      expect(
        message
          .slice(message.indexOf("choose one of: ") + 15)
          .split(", ")
          .sort(),
      ).toEqual(profiles.map((profile) => profile.id).sort());
      expect(selectFrontendProfile(id)).toEqual(result);
    },
  );

  // No selected platform means no firmware-vector ownership restriction.
  it.each([0x0314n, 0x0318n, 0x0400n])(
    "should leave %s unrestricted without a profile",
    (address) => {
      expect(firmwareVectorSink(null, address)).toBeNull();
    },
  );
});

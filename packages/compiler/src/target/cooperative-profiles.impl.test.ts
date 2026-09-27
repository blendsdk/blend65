import { describe, expect, it } from "vitest";
import { validateAcmeInput } from "../artifacts/acme-validate.js";
import { layoutC64Program } from "../layout/c64-layout.js";
import { createC64Startup } from "../layout/startup.js";
import type { MachineProgram } from "../machine/machine-types.js";
import { C64_KERNAL_PROFILES } from "../profile/c64-kernal.js";
import type { StorageClosureCertificate } from "../storage/storage-types.js";
import { selectTargetProfile, type TargetProfile } from "./profile.js";

/** Build a legal minimal internal boundary input, without involving files or tools. */
function fixture(id: string) {
  const selected = selectTargetProfile(id);
  if (selected.kind !== "complete") throw new Error(`Expected admitted profile ${id}`);
  const profile = selected.profile;
  const startup = createC64Startup({ profile, initializerLabels: [], mainLabel: "main" });
  if (startup.kind !== "complete") throw new Error("Expected cooperative startup");
  const certificate: StorageClosureCertificate = {
    inventoryHash: "inventory",
    graphHash: "graph",
    profileId: id,
    homes: [],
    interference: [],
    helperCalls: [],
    staticBytes: { ram: 0, zeroPage: 0 },
    peakBytes: { ram: 0, zeroPage: 0 },
    hardwareStackPeak: 10,
    closed: true,
  };
  const program: MachineProgram = {
    startup: startup.startup,
    functions: [
      {
        id: "main",
        blocks: [
          {
            label: "main.entry",
            instructions: [],
            terminator: { kind: "return", opcode: "rts" },
          },
        ],
      },
    ],
    data: [],
    requiredStorage: [],
  };
  const layout = layoutC64Program({ profile, certificate, program });
  if (layout.kind !== "complete") throw new Error(`Expected layout: ${layout.reason}`);
  return { profile, certificate, program, layout };
}

/** Simulate a malformed runtime caller without weakening the production type declarations. */
function unsupportedProfile(profile: TargetProfile): TargetProfile {
  return Object.defineProperty({ ...profile }, "id", { value: "c64-unsupported" });
}

describe.each(C64_KERNAL_PROFILES)("cooperative boundary hardening for $id", (facts) => {
  it("keeps selection immutable, repeatable and aligned with its storage identity", () => {
    const { profile, layout, certificate } = fixture(facts.id);
    const repeated = selectTargetProfile(facts.id);
    expect(repeated).toEqual({ kind: "complete", profile });
    expect(Object.isFrozen(profile)).toBe(true);
    expect(Object.isFrozen(profile.machine)).toBe(true);
    expect(Object.isFrozen(profile.storage)).toBe(true);
    expect(Object.isFrozen(profile.storage.zeroPage)).toBe(true);
    expect(profile.storage.profileId).toBe(profile.id);
    expect(profile.machine.cyclesPerFrame).toBe(facts.cyclesPerFrame);
    expect(validateAcmeInput({ profile, certificate, layout })).toEqual({ kind: "complete" });
  });

  it.each(["open", "other-admitted-profile"])("rejects a %s certificate", (failure) => {
    const input = fixture(facts.id);
    const other = C64_KERNAL_PROFILES.find(({ id }) => id !== facts.id)!;
    const certificate = {
      ...input.certificate,
      closed: failure !== "open",
      profileId: failure === "open" ? facts.id : other.id,
    };
    expect(layoutC64Program({ ...input, certificate })).toMatchObject({
      kind: "error",
      reason: "profile-or-certificate",
    });
    expect(validateAcmeInput({ ...input, certificate })).toMatchObject({
      kind: "error",
      reason: "invalid-program",
    });
  });

  it.each(["serializer", "packager"] as const)("rejects an alien %s", (owner) => {
    const input = fixture(facts.id);
    const invalidOwner = Object.defineProperty({ ...input.profile[owner] }, "id", {
      value: "unsupported",
    });
    const profile = { ...input.profile, [owner]: invalidOwner };
    expect(validateAcmeInput({ ...input, profile })).toMatchObject({
      kind: "error",
      reason: "invalid-layout",
    });
  });

  it("rejects an unknown profile at all three independently callable boundaries", () => {
    const input = fixture(facts.id);
    const profile = unsupportedProfile(input.profile);
    expect(createC64Startup({ profile, initializerLabels: [], mainLabel: "main" }).kind).toBe(
      "error",
    );
    expect(layoutC64Program({ ...input, profile })).toMatchObject({
      kind: "error",
      reason: "profile-or-certificate",
    });
    expect(validateAcmeInput({ ...input, profile })).toMatchObject({
      kind: "error",
      reason: "invalid-layout",
    });
  });
});

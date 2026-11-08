import { describe, expect, it } from "vitest";
import {
  AUDIO_PLAYER_CONTRACTS,
  audioDomainOverlap,
  findAudioPlayerContract,
  validateAudioOperation,
  type AudioPlayerContract,
} from "./audio-contract.js";

/** Build one complete synthetic contract for validation tests. */
function contract(overrides: Partial<AudioPlayerContract> = {}): AudioPlayerContract {
  return Object.freeze({
    identity: Object.freeze({ family: "fixture", version: "1", sha256: "a".repeat(64) }),
    assetSha256: Object.freeze(["b".repeat(64)]),
    placement: "fixed",
    entries: Object.freeze({ init: 0, tick: 3 }),
    writableRanges: Object.freeze([]),
    selfModifyingRanges: Object.freeze([]),
    banking: Object.freeze([]),
    effects: Object.freeze({
      registers: "A,X,Y",
      flags: "N,Z,C",
      decimal: "binary-required",
      interruptState: "preserved",
      port01: "preserved",
      stackBytes: 2,
      ramBytes: 0,
      zeroPageBytes: 0,
      mmioRanges: Object.freeze([]),
    }),
    songs: Object.freeze({
      count: 1,
      defaultSong: 0,
      names: Object.freeze(["main"]),
      dynamicNumeric: false,
    }),
    effectsInventory: Object.freeze({
      names: Object.freeze(["shoot"]),
      priority: "first",
      replacement: "oldest",
      resume: "next-frame",
      sameFrame: "ordered",
    }),
    voices: Object.freeze([{ logical: 0, channelOffset: 0 }]),
    video: Object.freeze(["PAL"]),
    sidChips: Object.freeze([{ address: 0xd400, model: 6581 }]),
    cadence: "once-per-frame",
    callDomains: Object.freeze(["mainline"]),
    interruptOwnership: "none",
    ciaOwnership: "none",
    sidFilterOwnership: "none",
    reentrant: false,
    featureSizes: Object.freeze([]),
    costs: Object.freeze({
      codeBytes: Object.freeze({ kind: "exact", value: 0 }),
      dataBytes: Object.freeze({ kind: "exact", value: 0 }),
      cycles: Object.freeze({ kind: "unknown" }),
    }),
    ...overrides,
  });
}

describe("audio player contracts", () => {
  // The baseline inventory is empty and no plain PSID can obtain a contract.
  it("should keep the baseline contract inventory empty", () => {
    expect(AUDIO_PLAYER_CONTRACTS.size).toBe(0);
    expect(findAudioPlayerContract("b".repeat(64))).toBeNull();
  });

  // Contract lookup is bound to the exact input digest.
  it("should find a contract only for its exact asset digest", () => {
    const map = new Map([["fixture", contract()]]);
    expect(findAudioPlayerContract("b".repeat(64), map)).not.toBeNull();
    expect(findAudioPlayerContract("c".repeat(64), map)).toBeNull();
  });

  // An operation missing from the exact feature set reports every available form.
  it("should reject an unavailable operation with the available inventory", () => {
    const failure = validateAudioOperation(contract(), { operation: "sfx" });
    expect(failure?.code).toBe("E10257");
    expect(failure?.message).toContain("'init'");
    expect(failure?.message).toContain("'tick'");
  });

  // Optional cues and logical voices are validated against the contract.
  it("should reject an unavailable cue and voice", () => {
    const withSfx = contract({ entries: Object.freeze({ init: 0, tick: 3, sfx: 6 }) });
    expect(validateAudioOperation(withSfx, { operation: "sfx", cue: "jump" })?.code).toBe("E10257");
    expect(
      validateAudioOperation(withSfx, { operation: "sfx", cue: "shoot", voice: 2 })?.code,
    ).toBe("E10257");
    expect(
      validateAudioOperation(withSfx, { operation: "sfx", cue: "shoot", voice: 0 }),
    ).toBeNull();
  });

  // Named and numeric song selection is validated against the contract inventory.
  it("should validate named and numeric song selection", () => {
    expect(validateAudioOperation(contract(), { operation: "init", song: "main" })).toBeNull();
    expect(validateAudioOperation(contract(), { operation: "init", song: "victory" })?.code).toBe(
      "E10257",
    );
    expect(validateAudioOperation(contract(), { operation: "init", song: 0 })?.code).toBe("E10257");
    const numeric = contract({
      songs: Object.freeze({
        count: 2,
        defaultSong: 0,
        names: Object.freeze(["main"]),
        dynamicNumeric: true,
        numericRange: Object.freeze({ min: 0, max: 1 }),
      }),
    });
    expect(validateAudioOperation(numeric, { operation: "init", song: 1 })).toBeNull();
    expect(validateAudioOperation(numeric, { operation: "init", song: 2 })?.code).toBe("E10257");
  });

  // A non-reentrant operation reachable from two concurrent domains is rejected.
  it("should report the first pair of concurrent call domains", () => {
    expect(audioDomainOverlap([["mainline"], ["mainline"]])).toBeNull();
    expect(audioDomainOverlap([["mainline"], ["mainline", "irq"]])).toEqual({
      first: "mainline",
      second: "irq",
    });
  });

  // Resource and timing costs remain explicit records, never a fabricated number.
  it("should retain unavailable timing as an explicit evidence value", () => {
    const costs = contract().costs;
    expect(costs.cycles).toEqual({ kind: "unknown" });
    expect(costs.codeBytes).toEqual({ kind: "exact", value: 0 });
  });
});

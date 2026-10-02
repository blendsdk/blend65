import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic } from "../project/types.js";
import { C64_KERNAL_PROFILES, selectC64KernalFacts } from "../profile/c64-kernal.js";
import type { C64KernalProfileFacts, C64KernalProfileId } from "../profile/c64-kernal.js";
import { SCALAR_TYPES } from "./constants.js";
import type { ProfileEffect, SemanticType } from "./semantic-types.js";
import { LITERAL_ITEM_KIND } from "./tokens.js";
import type { LiteralItem } from "./tokens.js";

/** Explicit PAL compatibility default for callers that do not pass an encoding profile. */
export const SELECTED_PROFILE_ID = "c64-pal-prg-kernal-6581" as const;

/**
 * Name the typed installer required by a known firmware vector on the selected profile.
 * Other addresses and profile-independent analysis have no such platform restriction.
 * The caller uses this only when the stored value is a raw interrupt-function address.
 */
export function firmwareVectorSink(profileId: string | null, address: bigint): string | null {
  if (profileId === null || selectC64KernalFacts(profileId) === null) return null;
  if (address === 0x0314n) return "c64.system.setIRQ";
  if (address === 0x0318n) return "c64.system.setNMI";
  return null;
}

/** One source-visible function supplied by a selected frontend profile. */
export interface ProfileCapability {
  /** Stable fully qualified source name. */
  readonly name: string;
  /** Parameters in source order. */
  readonly parameters: readonly SemanticType[];
  /** Source-language result type. */
  readonly returnType: SemanticType;
  /** Ordering behavior preserved by later semantic stages. */
  readonly effect: ProfileEffect;
}

/** One immutable, storage-free scalar declaration supplied by the selected profile. */
export interface ProfileConstant {
  /** Stable fully qualified source name. */
  readonly name: string;
  /** Ordinary source scalar type. */
  readonly type: SemanticType;
  /** Exact compile-time value; never narrowed through host bitwise arithmetic. */
  readonly value: bigint | boolean;
}

/** Target-neutral declarations exposed to source analysis for one profile. */
export interface FrontendProfile {
  /** Complete qualified profile identity. */
  readonly id: C64KernalProfileId;
  /** Exact source operation set in deterministic name order. */
  readonly capabilities: readonly ProfileCapability[];
  /** Exact scalar constants in deterministic qualified-name order. */
  readonly constants: readonly ProfileConstant[];
  /** Per-mutable-array RAM advisory threshold; null disables this warning. */
  readonly warnArraySize: number | null;
  /** Resolved per-struct zero-page advisory threshold. */
  readonly warnStructZpSize: number;
}

/** Named character encodings available to source literals in the selected C64 profile. */
export type C64Encoding = "screen_codes" | "petscii";

/** Immutable character-set interpretations offered by each C64 encoding. */
export type C64CharacterMap = "upper_graphics" | "lower_upper";

/** One exact encoded byte sequence, or the first unmapped source unit. */
export type EncodedC64Literal =
  | { readonly kind: "complete"; readonly bytes: readonly number[] }
  | { readonly kind: "error"; readonly diagnostic: ProjectDiagnostic };

/** Map one Unicode scalar according to the finite, selected C64 table. */
function c64ScalarByte(scalar: string, encoding: C64Encoding, map: C64CharacterMap): number | null {
  const code = scalar.codePointAt(0);
  if (code === undefined) return null;
  if (code >= 0x20 && code <= 0x3f) return code;
  if (encoding === "screen_codes") {
    if (code === 0x40) return 0;
    if (code >= 0x41 && code <= 0x5a) {
      return code - 0x40 + (map === "lower_upper" ? 0x40 : 0);
    }
    if (code >= 0x61 && code <= 0x7a && map === "lower_upper") return code - 0x60;
    if (code === 0x5b) return 0x1b;
    if (code === 0xa3) return 0x1c;
    if (code === 0x5d) return 0x1d;
    if (code === 0x2191) return 0x1e;
    if (code === 0x2190) return 0x1f;
    return null;
  }
  if (code === 0x40) return 0x40;
  if (code >= 0x41 && code <= 0x5a) {
    return code + (map === "lower_upper" ? 0x80 : 0);
  }
  if (code >= 0x61 && code <= 0x7a && map === "lower_upper") return code - 0x20;
  if (code === 0x5b) return 0x5b;
  if (code === 0xa3) return 0x5c;
  if (code === 0x5d) return 0x5d;
  if (code === 0x2191) return 0x5e;
  if (code === 0x2190) return 0x5f;
  return null;
}

/** Encode lexical literal units without changing the machine's active character set. */
export function encodeC64Literal(
  items: readonly LiteralItem[],
  encoding: C64Encoding,
  map: C64CharacterMap,
  profileId: string = SELECTED_PROFILE_ID,
): EncodedC64Literal {
  const bytes: number[] = [];
  for (const item of items) {
    if (item.kind === LITERAL_ITEM_KIND.byte) {
      bytes.push(item.value);
      continue;
    }
    if (item.kind === LITERAL_ITEM_KIND.escape && item.value === "\\0") {
      bytes.push(0);
      continue;
    }
    let value: number | null;
    if (item.kind === LITERAL_ITEM_KIND.escape && (item.value === "\\n" || item.value === "\\r")) {
      value = encoding === "petscii" ? 0x0d : null;
    } else if (item.kind === LITERAL_ITEM_KIND.escape && item.value === "\\t") {
      value = null;
    } else {
      const scalar = item.kind === LITERAL_ITEM_KIND.scalar ? item.value : item.value.slice(1);
      value = c64ScalarByte(scalar, encoding, map);
    }
    if (value === null) {
      return Object.freeze({
        kind: "error",
        diagnostic: projectDiagnostic(
          "E10249",
          `Encoding '${encoding}' cannot represent literal character or escape '${item.value}' as the required byte on platform '${profileId}' — select an available named encoding or use '\\xNN' for an exact byte`,
          item.span,
        ),
      });
    }
    bytes.push(value);
  }
  return Object.freeze({ kind: "complete", bytes: Object.freeze(bytes) });
}

/** Complete profile selection or a proving diagnostic with no fallback. */
export type FrontendProfileResult =
  | { readonly kind: "complete"; readonly profile: FrontendProfile }
  | { readonly kind: "error"; readonly diagnostics: readonly ProjectDiagnostic[] };

/** Freeze one capability so callers cannot alter the declaration environment. */
function capability(
  name: string,
  parameters: readonly SemanticType[],
  returnType: SemanticType,
  effect: ProfileEffect,
): ProfileCapability {
  return Object.freeze({ name, parameters: Object.freeze([...parameters]), returnType, effect });
}

/** Source operations and advisories shared by the cooperative family. */
const COOPERATIVE_DECLARATIONS = Object.freeze({
  warnArraySize: 256,
  warnStructZpSize: 35,
  capabilities: Object.freeze([
    capability(
      "c64.cia1.configureTimerA",
      [SCALAR_TYPES.byte],
      SCALAR_TYPES.void,
      "volatile-write",
    ),
    capability(
      "c64.cia1.configureTimerB",
      [SCALAR_TYPES.byte],
      SCALAR_TYPES.void,
      "volatile-write",
    ),
    capability(
      "c64.cia1.disableInterruptSources",
      [SCALAR_TYPES.byte],
      SCALAR_TYPES.void,
      "volatile-write",
    ),
    capability(
      "c64.cia1.enableInterruptSources",
      [SCALAR_TYPES.byte],
      SCALAR_TYPES.void,
      "volatile-write",
    ),
    capability("c64.cia1.readAndClearPendingSources", [], SCALAR_TYPES.byte, "volatile-read"),
    capability("c64.cia1.readTimerACounter", [], SCALAR_TYPES.word, "volatile-read"),
    capability("c64.cia1.readTimerBCounter", [], SCALAR_TYPES.word, "volatile-read"),
    capability(
      "c64.cia1.writeTimerALatch",
      [SCALAR_TYPES.word],
      SCALAR_TYPES.void,
      "volatile-write",
    ),
    capability(
      "c64.cia1.writeTimerBLatch",
      [SCALAR_TYPES.word],
      SCALAR_TYPES.void,
      "volatile-write",
    ),
    capability(
      "c64.cia2.configureTimerA",
      [SCALAR_TYPES.byte],
      SCALAR_TYPES.void,
      "volatile-write",
    ),
    capability(
      "c64.cia2.configureTimerB",
      [SCALAR_TYPES.byte],
      SCALAR_TYPES.void,
      "volatile-write",
    ),
    capability(
      "c64.cia2.disableInterruptSources",
      [SCALAR_TYPES.byte],
      SCALAR_TYPES.void,
      "volatile-write",
    ),
    capability(
      "c64.cia2.enableInterruptSources",
      [SCALAR_TYPES.byte],
      SCALAR_TYPES.void,
      "volatile-write",
    ),
    capability("c64.cia2.readAndClearPendingSources", [], SCALAR_TYPES.byte, "volatile-read"),
    capability("c64.cia2.readTimerACounter", [], SCALAR_TYPES.word, "volatile-read"),
    capability("c64.cia2.readTimerBCounter", [], SCALAR_TYPES.word, "volatile-read"),
    capability(
      "c64.cia2.writeTimerALatch",
      [SCALAR_TYPES.word],
      SCALAR_TYPES.void,
      "volatile-write",
    ),
    capability(
      "c64.cia2.writeTimerBLatch",
      [SCALAR_TYPES.word],
      SCALAR_TYPES.void,
      "volatile-write",
    ),
    /** Test active-low down (bit 1) in a saved sample; no hardware is read. */
    capability("c64.input.joystickDown", [SCALAR_TYPES.byte], SCALAR_TYPES.boolean, "pure"),
    capability("c64.input.joystickFire", [SCALAR_TYPES.byte], SCALAR_TYPES.boolean, "pure"),
    capability("c64.input.joystickLeft", [SCALAR_TYPES.byte], SCALAR_TYPES.boolean, "pure"),
    capability("c64.input.joystickRight", [SCALAR_TYPES.byte], SCALAR_TYPES.boolean, "pure"),
    /** Test active-low up (bit 0) in a saved sample; no hardware is read. */
    capability("c64.input.joystickUp", [SCALAR_TYPES.byte], SCALAR_TYPES.boolean, "pure"),
    /** Sample the whole CIA1 port-B byte once, without configuring shared pins or masking IRQs. */
    capability("c64.input.readJoystick1", [], SCALAR_TYPES.byte, "volatile-read"),
    capability("c64.input.readJoystick2", [], SCALAR_TYPES.byte, "volatile-read"),
    capability("c64.system.restoreIRQ", [], SCALAR_TYPES.void, "volatile-write"),
    capability("c64.system.restoreNMI", [], SCALAR_TYPES.void, "volatile-write"),
    capability(
      "c64.system.setIRQ",
      [Object.freeze({ kind: "interrupt-handler" })],
      SCALAR_TYPES.void,
      "volatile-write",
    ),
    capability(
      "c64.system.setIRQExclusive",
      [Object.freeze({ kind: "interrupt-handler" })],
      SCALAR_TYPES.void,
      "volatile-write",
    ),
    capability(
      "c64.system.setNMI",
      [Object.freeze({ kind: "interrupt-handler" })],
      SCALAR_TYPES.void,
      "volatile-write",
    ),
    capability(
      "c64.system.setNMIExclusive",
      [Object.freeze({ kind: "interrupt-handler" })],
      SCALAR_TYPES.void,
      "volatile-write",
    ),
    /**
     * Sample sprite/background participants and clear only that hardware collision latch.
     * Every call reads once, even if discarded; it does not acknowledge the collision IRQ.
     * @example let participants: byte = c64.vic.readAndClearSpriteBackgroundCollisions();
     */
    capability(
      "c64.vic.readAndClearSpriteBackgroundCollisions",
      [],
      SCALAR_TYPES.byte,
      "volatile-read",
    ),
    /**
     * Sample sprite/sprite participants, not collision pairs, and clear only that latch.
     * Return all eight bits unchanged; repeated calls can observe newly latched collisions.
     * This read does not acknowledge the collision IRQ or mask interrupts.
     * @example let participants: byte = c64.vic.readAndClearSpriteSpriteCollisions();
     */
    capability(
      "c64.vic.readAndClearSpriteSpriteCollisions",
      [],
      SCALAR_TYPES.byte,
      "volatile-read",
    ),
    capability("c64.vic.setBorderColor", [SCALAR_TYPES.byte], SCALAR_TYPES.void, "volatile-write"),
    capability(
      "c64.vic.setSpriteColor",
      [SCALAR_TYPES.byte, SCALAR_TYPES.byte],
      SCALAR_TYPES.void,
      "volatile-write",
    ),
    capability(
      "c64.vic.setSpriteEnabled",
      [SCALAR_TYPES.byte, SCALAR_TYPES.boolean],
      SCALAR_TYPES.void,
      "volatile-write",
    ),
    capability(
      "c64.vic.setSpritePointer",
      [SCALAR_TYPES.byte, SCALAR_TYPES.byte],
      SCALAR_TYPES.void,
      "volatile-write",
    ),
    capability(
      "c64.vic.setSpritePosition",
      [SCALAR_TYPES.byte, SCALAR_TYPES.word, SCALAR_TYPES.byte],
      SCALAR_TYPES.void,
      "volatile-write",
    ),
    capability("c64.vic.vicSpriteBlock", [SCALAR_TYPES.word], SCALAR_TYPES.byte, "pure"),
    capability("c64.video.waitNextFrame", [], SCALAR_TYPES.void, "ordered-wait"),
  ]),
});

/** Timer modes and latched-source bits are immutable compile-time bytes on every C64 profile. */
const CIA_CONSTANT_ROWS = [
  ["sourceAll", 0x1fn],
  ["sourceFlag", 0x10n],
  ["sourceIrq", 0x80n],
  ["sourceSerial", 0x08n],
  ["sourceTimerA", 0x01n],
  ["sourceTimerB", 0x02n],
  ["sourceTodAlarm", 0x04n],
  ["timerBCountAUnderflows", 0x40n],
  ["timerLoad", 0x10n],
  ["timerOneShot", 0x08n],
  ["timerStart", 0x01n],
] as const;

/** Represent exact timing with ordinary scalars, without a wider source integer or runtime. */
function profileConstants(facts: C64KernalProfileFacts): readonly ProfileConstant[] {
  const rows = [
    ["cpuClockHzRemainder", SCALAR_TYPES.word, BigInt(facts.clockHz % 1000)],
    ["cpuClockKilohertz", SCALAR_TYPES.word, BigInt(Math.floor(facts.clockHz / 1000))],
    ["cyclesPerFrame", SCALAR_TYPES.word, BigInt(facts.cyclesPerFrame)],
    ["cyclesPerLine", SCALAR_TYPES.byte, BigInt(facts.cyclesPerLine)],
    ["frameRateFractionDenominator", SCALAR_TYPES.word, BigInt(facts.frameRateFractionDenominator)],
    ["frameRateFractionNumerator", SCALAR_TYPES.word, BigInt(facts.frameRateFractionNumerator)],
    ["frameRateWhole", SCALAR_TYPES.byte, BigInt(facts.frameRateWhole)],
    ["hasRawInterrupts", SCALAR_TYPES.boolean, false],
    ["isNtsc", SCALAR_TYPES.boolean, facts.video === "ntsc"],
    ["isPal", SCALAR_TYPES.boolean, facts.video === "pal"],
    ["rasterLines", SCALAR_TYPES.word, BigInt(facts.rasterLines)],
    ["sidAddress", SCALAR_TYPES.word, 0xd400n],
    ["sidModel", SCALAR_TYPES.word, BigInt(facts.sidModel)],
    ["usesKernal", SCALAR_TYPES.boolean, true],
  ] as const;
  return Object.freeze([
    ...CIA_CONSTANT_ROWS.map(([name, value]) =>
      Object.freeze({ name: `c64.cia1.${name}`, type: SCALAR_TYPES.byte, value }),
    ),
    ...rows.map(([name, type, value]) =>
      Object.freeze({ name: `c64.profile.${name}`, type, value }),
    ),
  ]);
}

/**
 * Select the exact frontend declaration environment for a qualified profile ID.
 * Hardware addresses, opcodes, layout and packaging facts are deliberately absent.
 */
export function selectFrontendProfile(profileId: string): FrontendProfileResult {
  const facts = selectC64KernalFacts(profileId);
  if (facts !== null) {
    return Object.freeze({
      kind: "complete",
      profile: Object.freeze({
        ...COOPERATIVE_DECLARATIONS,
        id: facts.id,
        constants: profileConstants(facts),
      }),
    });
  }
  return Object.freeze({
    kind: "error",
    diagnostics: Object.freeze([
      projectDiagnostic(
        "E10279",
        `Target profile '${profileId}' is not a complete qualified profile ID — choose one of: ${C64_KERNAL_PROFILES.map(({ id }) => id).join(", ")}`,
      ),
    ]),
  });
}

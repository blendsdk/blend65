import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic } from "../project/types.js";
import { SCALAR_TYPES } from "./constants.js";
import type { ProfileEffect, SemanticType } from "./semantic-types.js";
import { LITERAL_ITEM_KIND } from "./tokens.js";
import type { LiteralItem } from "./tokens.js";

/** The only complete target profile admitted by the first end-to-end compiler slice. */
export const SELECTED_PROFILE_ID = "c64-pal-prg-kernal-6581" as const;

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

/** Target-neutral declarations exposed to source analysis for one profile. */
export interface FrontendProfile {
  /** Complete qualified profile identity. */
  readonly id: typeof SELECTED_PROFILE_ID;
  /** Exact source operation set in deterministic name order. */
  readonly capabilities: readonly ProfileCapability[];
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
          `Character '${item.value}' is unavailable in ${encoding}/${map} — choose an available encoding or use an exact \\xNN byte`,
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

const SELECTED_PROFILE: FrontendProfile = Object.freeze({
  id: SELECTED_PROFILE_ID,
  capabilities: Object.freeze([
    capability("c64.input.joystickFire", [SCALAR_TYPES.byte], SCALAR_TYPES.boolean, "pure"),
    capability("c64.input.joystickLeft", [SCALAR_TYPES.byte], SCALAR_TYPES.boolean, "pure"),
    capability("c64.input.joystickRight", [SCALAR_TYPES.byte], SCALAR_TYPES.boolean, "pure"),
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

/**
 * Select the exact frontend declaration environment for a qualified profile ID.
 * Hardware addresses, opcodes, layout and packaging facts are deliberately absent.
 */
export function selectFrontendProfile(profileId: string): FrontendProfileResult {
  if (profileId === SELECTED_PROFILE_ID) {
    return Object.freeze({ kind: "complete", profile: SELECTED_PROFILE });
  }
  return Object.freeze({
    kind: "error",
    diagnostics: Object.freeze([
      projectDiagnostic(
        "E10279",
        `Target profile '${profileId}' is not a complete qualified profile ID — choose one of: ${SELECTED_PROFILE_ID}`,
      ),
    ]),
  });
}

import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic } from "../project/types.js";
import { SCALAR_TYPES } from "./constants.js";
import type { ProfileEffect, SemanticType } from "./semantic-types.js";

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

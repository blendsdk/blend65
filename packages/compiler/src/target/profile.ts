import { projectDiagnostic, PROJECT_CODES } from "../project/diagnostics.js";
import type { ProjectDiagnostic } from "../project/types.js";
import type { StorageProfile } from "../storage/storage-types.js";
import { ACME_097, C64_PAL_KERNAL_6581, CBM_PRG } from "./c64-pal-kernal.js";
import type { C64MachineFacts, PackagerFacts, SerializerFacts } from "./c64-pal-kernal.js";
import { NMOS_6510 } from "./nmos6510.js";
import type { CpuFacts } from "./nmos6510.js";

/** Fully composed facts for the one target qualified by the current compiler slice. */
export interface TargetProfile {
  /** Qualified profile identity. */
  readonly id: "c64-pal-prg-kernal-6581";
  /** Selected processor facts. */
  readonly cpu: CpuFacts;
  /** Selected C64 machine and firmware facts. */
  readonly machine: C64MachineFacts;
  /** Selected terminal assembly serializer. */
  readonly serializer: SerializerFacts;
  /** Selected loadable artifact packager. */
  readonly packager: PackagerFacts;
  /** Resources available to static function-storage allocation. */
  readonly storage: StorageProfile;
}

/** Complete selected target, or a terminal unknown-profile diagnostic. */
export type TargetProfileResult =
  | { readonly kind: "complete"; readonly profile: TargetProfile }
  | { readonly kind: "error"; readonly diagnostics: readonly ProjectDiagnostic[] };

const PROFILE: TargetProfile = Object.freeze({
  id: "c64-pal-prg-kernal-6581",
  cpu: NMOS_6510,
  machine: C64_PAL_KERNAL_6581,
  serializer: ACME_097,
  packager: CBM_PRG,
  storage: Object.freeze({
    profileId: "c64-pal-prg-kernal-6581",
    zeroPage: Object.freeze([Object.freeze({ start: 0x02, end: 0x8f })]),
    // Static function homes grow in high RAM so low resident code/data can remain contiguous.
    ram: Object.freeze([Object.freeze({ start: 0xc000, end: 0xcfff })]),
    hardwareStackCapacity: 0x100,
    hardwareStackReserve: 20,
    interruptStackBytes: 6,
    startupStackBytes: 10,
  }),
});

/**
 * Select the exact admitted target without fallback or partial composition.
 * @param profileId Complete qualified profile identifier.
 * @returns The composed profile, or one terminal diagnostic.
 * @example selectTargetProfile("c64-pal-prg-kernal-6581").kind === "complete"
 */
export function selectTargetProfile(profileId: string): TargetProfileResult {
  if (profileId === PROFILE.id) return Object.freeze({ kind: "complete", profile: PROFILE });
  return Object.freeze({
    kind: "error",
    diagnostics: Object.freeze([
      projectDiagnostic(
        PROJECT_CODES.profile,
        `Target profile '${profileId}' is not a complete qualified profile ID — choose one of: ${PROFILE.id}`,
        null,
      ),
    ]),
  });
}

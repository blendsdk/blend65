import { projectDiagnostic, PROJECT_CODES } from "../project/diagnostics.js";
import type { ProjectDiagnostic } from "../project/types.js";
import type { StorageProfile } from "../storage/storage-types.js";
import { C64_RESIDENT_PROFILES } from "../profile/c64-kernal.js";
import type { C64KernalProfileId } from "../profile/c64-kernal.js";
import { ACME_097, createC64KernalMachine, CBM_D64, CBM_PRG } from "./c64-kernal.js";
import type { C64MachineFacts, PackagerFacts, SerializerFacts } from "./c64-kernal.js";
import { NMOS_6510 } from "./nmos6510.js";
import type { CpuFacts } from "./nmos6510.js";

/** The firmware entry contracts qualified for the selected C64 profile. */
export type InterruptVariantId =
  | "c64_kernal_cinv_chain"
  | "c64_kernal_cinv_exclusive"
  | "c64_kernal_nminv_chain"
  | "c64_kernal_nminv_exclusive"
  | "c64_raw_irq";

/** Fixed entry and exit duties for one interrupt handler variant. */
export interface InterruptVariantFacts {
  /** Profile-stable variant identity. */
  readonly id: InterruptVariantId;
  /** Owner of the A/X/Y save on this route. */
  readonly registerSaveOwner: "firmware" | "compiler";
  /** Live hardware-stack bytes when the source body begins. */
  readonly handlerEntryStackBytes: 6 | 7;
  /** Blend65 statements always begin with decimal mode clear. */
  readonly decimalModeOnBodyEntry: "binary";
  /** Whether entry status is restored before chaining or by final RTI. */
  readonly entryStatusPolicy: "preserve-before-chain" | "restore-by-rti";
  /** Outgoing route after the source body finishes. */
  readonly terminal: "jump-saved-vector" | "jump-firmware-tail" | "rti";
  /** Exact firmware restore entry, when the terminal uses one. */
  readonly terminalAddress?: number;
  /** Static predecessor-link size; zero when the prior vector is not chained. */
  readonly staticLinkBytes: 0 | 2;
  /** Largest legal low byte for a two-byte NMOS indirect-jump link. */
  readonly staticLinkLowByteMax?: 0xfe;
}

/** One typed platform operation which consumes an interrupt handler address. */
export interface InterruptSinkFacts {
  /** Source-visible qualified capability name. */
  readonly capability: string;
  /** Exact source value kind accepted by this operation. */
  readonly acceptedSourceKind: "interrupt-handler";
  /** Handler entry ABI selected by this sink. */
  readonly variant: InterruptVariantId;
  /** Domain in which the installed handler may run. */
  readonly domain: "irq" | "nmi";
  /** Hardware source participating in preemption proof. */
  readonly source: "irq" | "nmi";
  /** Whether hardware masks this same source before the handler can execute. */
  readonly masksSelfOnEntry: boolean;
  /** External upper bound when the source can retrigger during one entry. */
  readonly externalReentryBound: "unbounded";
  /** Firmware or raw hardware vector updated by this sink. */
  readonly vector: 0x0314 | 0x0318 | 0xfffe;
}

/** Closed interrupt routes in the selected profile's ownership mode. */
export interface InterruptProfileFacts {
  /** Machine entry/exit variants; only reachable ownership routes are present. */
  readonly variants: readonly InterruptVariantFacts[];
  /** Typed source operations selecting those variants. */
  readonly sinks: readonly InterruptSinkFacts[];
}

/** Fully composed facts for one of the nine C64 resident build targets. */
export interface TargetProfile {
  /** Qualified profile identity. */
  readonly id: C64KernalProfileId;
  /** Selected processor facts. */
  readonly cpu: CpuFacts;
  /** Selected C64 machine and firmware facts. */
  readonly machine: C64MachineFacts;
  /** Selected terminal assembly serializer. */
  readonly serializer: SerializerFacts;
  /** Selected loadable artifact packager. */
  readonly packager: PackagerFacts;
  /** Resources available to static function-storage allocation. */
  readonly storage: StorageProfile & {
    /** Exact closed target identity carried through allocation and certification. */
    readonly profileId: C64KernalProfileId;
  };
  /** Finite firmware interrupt routes available on this target. */
  readonly interrupts: InterruptProfileFacts;
}

/** Complete selected target, or a terminal unknown-profile diagnostic. */
export type TargetProfileResult =
  | { readonly kind: "complete"; readonly profile: TargetProfile }
  | { readonly kind: "error"; readonly diagnostics: readonly ProjectDiagnostic[] };

/** CPU and tool contracts shared by every complete selected identity. */
const COMMON_PROFILE: Omit<TargetProfile, "id" | "machine" | "storage" | "interrupts"> =
  Object.freeze({
    cpu: NMOS_6510,
    serializer: ACME_097,
    packager: CBM_PRG,
  });

/** Cooperative KERNAL interrupt routing maps. */
const COOPERATIVE_INTERRUPTS: InterruptProfileFacts = Object.freeze({
  variants: Object.freeze([
    Object.freeze({
      id: "c64_kernal_cinv_chain",
      registerSaveOwner: "firmware",
      handlerEntryStackBytes: 7,
      decimalModeOnBodyEntry: "binary",
      entryStatusPolicy: "preserve-before-chain",
      terminal: "jump-saved-vector",
      staticLinkBytes: 2,
      staticLinkLowByteMax: 0xfe,
    }),
    Object.freeze({
      id: "c64_kernal_cinv_exclusive",
      registerSaveOwner: "firmware",
      handlerEntryStackBytes: 6,
      decimalModeOnBodyEntry: "binary",
      entryStatusPolicy: "restore-by-rti",
      terminal: "jump-firmware-tail",
      terminalAddress: 0xea81,
      staticLinkBytes: 0,
    }),
    Object.freeze({
      id: "c64_kernal_nminv_chain",
      registerSaveOwner: "compiler",
      handlerEntryStackBytes: 7,
      decimalModeOnBodyEntry: "binary",
      entryStatusPolicy: "preserve-before-chain",
      terminal: "jump-saved-vector",
      staticLinkBytes: 2,
      staticLinkLowByteMax: 0xfe,
    }),
    Object.freeze({
      id: "c64_kernal_nminv_exclusive",
      registerSaveOwner: "compiler",
      handlerEntryStackBytes: 6,
      decimalModeOnBodyEntry: "binary",
      entryStatusPolicy: "restore-by-rti",
      terminal: "rti",
      staticLinkBytes: 0,
    }),
  ]),
  sinks: Object.freeze([
    Object.freeze({
      capability: "c64.system.setIRQ",
      acceptedSourceKind: "interrupt-handler",
      variant: "c64_kernal_cinv_chain",
      domain: "irq",
      source: "irq",
      masksSelfOnEntry: true,
      externalReentryBound: "unbounded",
      vector: 0x0314,
    }),
    Object.freeze({
      capability: "c64.system.setIRQExclusive",
      acceptedSourceKind: "interrupt-handler",
      variant: "c64_kernal_cinv_exclusive",
      domain: "irq",
      source: "irq",
      masksSelfOnEntry: true,
      externalReentryBound: "unbounded",
      vector: 0x0314,
    }),
    Object.freeze({
      capability: "c64.system.setNMI",
      acceptedSourceKind: "interrupt-handler",
      variant: "c64_kernal_nminv_chain",
      domain: "nmi",
      source: "nmi",
      masksSelfOnEntry: false,
      externalReentryBound: "unbounded",
      vector: 0x0318,
    }),
    Object.freeze({
      capability: "c64.system.setNMIExclusive",
      acceptedSourceKind: "interrupt-handler",
      variant: "c64_kernal_nminv_exclusive",
      domain: "nmi",
      source: "nmi",
      masksSelfOnEntry: false,
      externalReentryBound: "unbounded",
      vector: 0x0318,
    }),
  ]),
});

/**
 * Raw takeover routing replaces the cooperative maps. Only the raw IRQ source sink is
 * exposed; the startup default NMI entry is compiler-owned and has no source installer.
 */
const TAKEOVER_INTERRUPTS: InterruptProfileFacts = Object.freeze({
  variants: Object.freeze([
    Object.freeze({
      id: "c64_raw_irq",
      registerSaveOwner: "compiler",
      handlerEntryStackBytes: 6,
      decimalModeOnBodyEntry: "binary",
      entryStatusPolicy: "restore-by-rti",
      terminal: "rti",
      staticLinkBytes: 0,
    }),
  ]),
  sinks: Object.freeze([
    Object.freeze({
      capability: "c64.system.setRawIRQ",
      acceptedSourceKind: "interrupt-handler",
      variant: "c64_raw_irq",
      domain: "irq",
      source: "irq",
      masksSelfOnEntry: true,
      externalReentryBound: "unbounded",
      vector: 0xfffe,
    }),
  ]),
});

/** Compose the closed fact rows once; selection never creates mutable or partial profiles. */
const PROFILES: readonly TargetProfile[] = Object.freeze(
  C64_RESIDENT_PROFILES.map((facts) =>
    Object.freeze({
      ...COMMON_PROFILE,
      id: facts.id,
      machine: createC64KernalMachine(facts),
      packager: facts.profileKind === "d64" ? CBM_D64 : CBM_PRG,
      storage: Object.freeze({
        zeroPage: Object.freeze([Object.freeze({ start: 0x02, end: 0x8f })]),
        // Provisional homes use the shared range. Platform layout supplies its
        // remaining non-emitted suffix before the final storage certificate is used.
        ram: Object.freeze([Object.freeze({ start: 0x0801, end: 0xcfff })]),
        hardwareStackCapacity: 0x100,
        hardwareStackReserve: facts.ownership === "cooperative" ? 20 : 0,
        startupStackBytes: 1,
        // Takeover always installs a default IRQ frame (4 bytes: 3 CPU + PHA)
        // and a default NMI frame (3 CPU bytes). The closure adds the NMI frame
        // unconditionally and the IRQ frame only while no source route replaces it.
        ...(facts.ownership === "takeover"
          ? { defaultIrqStackBytes: 4, defaultNmiStackBytes: 3 }
          : {}),
        profileId: facts.id,
      }),
      interrupts: facts.ownership === "cooperative" ? COOPERATIVE_INTERRUPTS : TAKEOVER_INTERRUPTS,
    }),
  ),
);

/**
 * Select the exact admitted target without fallback or partial composition.
 * @param profileId Complete qualified profile identifier.
 * @returns The composed profile, or one terminal diagnostic.
 * @example selectTargetProfile("c64-pal-prg-kernal-6581").kind === "complete"
 */
export function selectTargetProfile(profileId: string): TargetProfileResult {
  const profile = PROFILES.find(({ id }) => id === profileId);
  if (profile !== undefined) return Object.freeze({ kind: "complete", profile });
  return Object.freeze({
    kind: "error",
    diagnostics: Object.freeze([
      projectDiagnostic(
        PROJECT_CODES.profile,
        `Target profile '${profileId}' is not a complete qualified profile ID — choose one of: ${PROFILES.map(({ id }) => id).join(", ")}`,
        null,
      ),
    ]),
  });
}

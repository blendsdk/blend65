import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import type { ValueLifetime, WholeProgram } from "../semantic/whole-program.js";

/** Function-execution storage categories owned by static frame allocation. */
export type StorageClass =
  | "parameter"
  | "return-stage"
  | "local"
  | "argument-stage"
  | "temporary"
  | "pointer"
  | "spill"
  | "helper-scratch";

/** Placement requirement known before a concrete address is selected. */
export type StorageRegionRequirement = "zero-page-required" | "zero-page-preferred" | "ram";

/** One function-owned value which requires a static memory home. */
export interface StorageRequest {
  /** Stable semantic identity of this storage demand. */
  readonly id: string;
  /** Purpose of the requested storage. */
  readonly storageClass: StorageClass;
  /** Source function which owns the value. */
  readonly owner: BindingId;
  /** Source binding when the request represents declared storage. */
  readonly binding: BindingId | null;
  /** Semantic value identity when the request represents a computed value. */
  readonly value: string | null;
  /** Exact source type, or null for target-created scratch with no source type. */
  readonly type: SemanticType | null;
  /** Required byte width. */
  readonly bytes: number;
  /** Required power-of-two address alignment. */
  readonly alignment: number;
  /** Required or preferred memory region. */
  readonly region: StorageRegionRequirement;
  /** Exact or conservative lifetime used for interference. */
  readonly lifetime: ValueLifetime;
  /** Source location which explains the request, when one exists. */
  readonly source: SourceSpan | null;
  /** Stable human-readable reason for the demand. */
  readonly reason: string;
}

/** ABI location of one completed function result. */
export type ResultLocation =
  | { readonly kind: "a" }
  | { readonly kind: "ax" }
  | { readonly kind: "storage"; readonly requestId: string };

/** ABI result decision for one reachable source function. */
export interface FunctionResultLocation {
  /** Source function. */
  readonly function: BindingId;
  /** Selected result location. */
  readonly location: ResultLocation;
}

/** Complete provisional function-storage inventory. */
export interface StorageInventory {
  /** Closed semantic program which owns the requests. */
  readonly program: WholeProgram;
  /** Deterministically ordered static storage requests. */
  readonly requests: readonly StorageRequest[];
  /** Result ABI decisions in semantic function order. */
  readonly results: readonly FunctionResultLocation[];
}

/** One inclusive address window available to SFA. */
export interface StorageRange {
  /** First usable address. */
  readonly start: number;
  /** Last usable address. */
  readonly end: number;
}

/** Memory and stack resources supplied by the selected target. */
export interface StorageProfile {
  /** Stable selected profile identity used by closure evidence. */
  readonly profileId?: string;
  /** Inclusive zero-page windows available to compiler-owned storage. */
  readonly zeroPage: readonly StorageRange[];
  /** Inclusive ordinary-RAM windows available to compiler-owned storage. */
  readonly ram: readonly StorageRange[];
  /** Raw hardware-stack capacity, when this phase is asked to prove it. */
  readonly hardwareStackCapacity?: number;
  /** Stack bytes reserved by the selected platform contract. */
  readonly hardwareStackReserve?: number;
  /** Simultaneous interrupt entry/save bytes owned by the platform contract. */
  readonly interruptStackBytes?: number;
}

/** One selected direct helper call and its complete storage/stack overlap facts. */
export interface HelperCallDemand {
  /** Stable helper-call identity from machine binding. */
  readonly id: string;
  /** Source execution context which invokes the helper. */
  readonly caller: BindingId;
  /** Requests live across the helper call. */
  readonly liveRequestIds: readonly string[];
  /** Scratch requests owned by the helper invocation. */
  readonly helperRequestIds: readonly string[];
  /** Complete additional hardware-stack peak while the helper executes. */
  readonly stackBytes: number;
}

/** No-addition discovery callback used for direct stable checks. */
export type StorageDiscovery = (
  placement: StoragePlacement,
  round: number,
) => readonly StorageRequest[];

/** Finite machine-binding seam used when closure may discover new storage. */
export interface StorageBinder {
  /** Complete finite set of request identities which binding may introduce. */
  readonly candidateRequestIds: readonly string[];
  /** Selected direct helper calls with explicit storage and stack effects. */
  readonly helperCalls: readonly HelperCallDemand[];
  /** Discover the selected requests for one provisional placement. */
  readonly discover: StorageDiscovery;
}

/** One undirected storage-conflict edge. */
export interface InterferenceEdge {
  /** Lexically smaller request identity. */
  readonly left: string;
  /** Lexically larger request identity. */
  readonly right: string;
  /** Durable explanation of the overlap proof. */
  readonly reason: "lifetime" | "call-overlap";
}

/** One concrete static memory home. */
export interface StorageHome {
  /** Request assigned to this home. */
  readonly requestId: string;
  /** Inclusive first byte address. */
  readonly address: number;
  /** Number of contiguous bytes. */
  readonly bytes: number;
  /** Selected address region. */
  readonly region: "zero-page" | "ram";
}

/** Complete provisional placement for one inventory. */
export interface StoragePlacement {
  /** One home for every inventory request. */
  readonly homes: readonly StorageHome[];
}

/** Deterministic placement or a resource failure without partial homes. */
export type StorageAllocationResult =
  | { readonly kind: "complete"; readonly placement: StoragePlacement }
  | { readonly kind: "error"; readonly reason: "resource"; readonly requestId: string };

/** RAM and zero-page byte totals. */
export interface ResourceTotals {
  /** Distinct ordinary RAM bytes. */
  readonly ram: number;
  /** Distinct zero-page bytes. */
  readonly zeroPage: number;
}

/** Provisional proof that all currently known storage has a home. */
export interface StorageClosureCertificate {
  /** Hash of the final ordered storage inventory. */
  readonly inventoryHash: string;
  /** Hash of the final ordered interference graph. */
  readonly graphHash: string;
  /** Selected profile identity, or a stable unspecified marker. */
  readonly profileId: string;
  /** Final provisional homes. */
  readonly homes: readonly StorageHome[];
  /** Final provisional interference graph. */
  readonly interference: readonly InterferenceEdge[];
  /** Selected helper calls included in interference and stack proof. */
  readonly helperCalls: readonly HelperCallDemand[];
  /** Distinct physical bytes occupied by the selected homes. */
  readonly staticBytes: ResourceTotals;
  /** Maximum simultaneous logical demand proved by the interference graph. */
  readonly peakBytes: ResourceTotals;
  /** Proved call/interrupt hardware-stack peak. */
  readonly hardwareStackPeak: number;
  /** Marker preventing a partial record from masquerading as a certificate. */
  readonly closed: true;
}

/** Stable storage closure or a terminal failure with no certificate. */
export type StorageClosureResult =
  | {
      readonly kind: "complete";
      readonly inventory: StorageInventory;
      readonly placement: StoragePlacement;
      readonly certificate: StorageClosureCertificate;
    }
  | {
      readonly kind: "error";
      readonly reason: "resource" | "nonconvergent" | "stack";
      readonly requestId?: string;
    };

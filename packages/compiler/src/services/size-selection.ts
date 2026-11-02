import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { C64_STARTUP_STATE_ID, type C64StartupPolicy } from "../layout/startup.js";
import { bindMachineProgram } from "../machine/bind.js";
import { deriveByteComplementFacts } from "../machine/byte-value-availability.js";
import { lowerMachineProgram } from "../machine/lower.js";
import { deadTemporaryHomes } from "../machine/optimization-cleanup.js";
import type { FixedLoopPolicy, MachineSourceFacts } from "../machine/machine-types.js";
import { deriveOptimizationFacts, type OptimizationFacts } from "../machine/optimization-facts.js";
import { hasDisplayIndependentStartup } from "../machine/lower-startup.js";
import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, ProjectSnapshot, SourceSpan } from "../project/types.js";
import { deriveClosedObjectFacts } from "../semantic/closed-object-facts.js";
import { deriveLocalStorageLifetimes } from "../semantic/local-storage-lifetimes.js";
import { overlappingIrqRootWarnings } from "../semantic/interrupt-domains.js";
import {
  deriveFixedLoopFacts,
  fixedLoopValueBounds,
  type SourceLoopNesting,
} from "../semantic/fixed-loop-facts.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import { allocateStorage } from "../storage/allocate.js";
import { closeStorage } from "../storage/closure.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { nmiPrivateStorageRoute } from "../storage/nmi-private-storage.js";
import { selectClosedObjectStorage } from "../storage/selection.js";
import type {
  StorageInventory,
  StoragePlacement,
  StorageRequest,
} from "../storage/storage-types.js";
import type { TargetProfile } from "../target/profile.js";
import {
  embeddedPayloadOverflow,
  layoutResourceWarnings,
  residentDataOverflow,
  sharedRamAllocationFailure,
  sourcePlacementFailure,
  sourceZeroPageOverflow,
  storageResourceWarnings,
} from "./resource-diagnostics.js";
import { sizeCostVector, type SizeCostVector } from "./evidence.js";
import { validateSizeObservers } from "./size-observers.js";
import type { ObserverValidation } from "./size-observers.js";
import { closeSharedStorage } from "./shared-storage.js";
import type { SharedStorageResult } from "./shared-storage.js";
import type { FailureCategory, ServiceFailure } from "./types.js";
import { reserveZeroPageGlobals } from "./zero-page-globals.js";

/** Checked source retained independently of any successful machine allocation. */
export interface CheckedSourceInput {
  /** Complete immutable source identity, including the selected invocation options. */
  readonly snapshot: ProjectSnapshot;
  /** Exact target facts used by every representation of this source. */
  readonly profile: TargetProfile;
  /** Reachable typed program before canonical function-storage placement. */
  readonly program: WholeProgram;
  /** Source-only lexical context stamped with this original checked program. */
  readonly loopNesting?: SourceLoopNesting;
  /** Display names carried to lowering without changing semantic identity. */
  readonly bindingNames: ReadonlyMap<string, string>;
  /** Source-associated names and placement locations for resource diagnostics. */
  readonly resourceSpans: ReadonlyMap<string, SourceSpan>;
  /** Read already loaded source bytes without another filesystem observation. */
  readonly sourceText: (span: SourceSpan) => string;
  /** Loading and semantic observations, before machine-specific warnings. */
  readonly diagnostics: readonly ProjectDiagnostic[];
}

/** Successful direct lowering and storage binding, before platform layout. */
export interface CanonicalPipeline extends Omit<CheckedSourceInput, "loopNesting"> {
  /** Source and selected-machine observations in their established service order. */
  readonly diagnostics: readonly ProjectDiagnostic[];
  /** Original symbolic machine operations and their finite storage discovery owner. */
  readonly lowered: Extract<ReturnType<typeof lowerMachineProgram>, { readonly kind: "complete" }>;
  /** Closed provisional function storage; final shared layout may rebind its homes. */
  readonly certificate: Extract<ReturnType<typeof closeStorage>, { readonly kind: "complete" }>;
  /** Machine operations bound against that provisional certificate. */
  readonly machine: Extract<ReturnType<typeof bindMachineProgram>, { readonly kind: "complete" }>;
  /** Reference-proved private temporary homes whose stores every layout omits. */
  readonly deadHomes?: ReadonlySet<string>;
}

/** Only the facts actually produced before a resource rejection; absence means unknown. */
export interface CanonicalPartialFacts {
  /** Source-derived requests, when inventory completed. */
  readonly inventory?: StorageInventory;
  /** Provisional homes, never a substitute for unavailable final intervals. */
  readonly placement?: StoragePlacement;
  /** Complete lowering, when every required operation could be selected. */
  readonly lowered?: CanonicalPipeline["lowered"];
  /** Complete provisional closure, when it was reached. */
  readonly certificate?: CanonicalPipeline["certificate"];
  /** Exact failing request or platform object, when the producer identifies it. */
  readonly objectId?: string | null;
  /** Measured finite demand, only when the rejecting producer reports it. */
  readonly measured?: number;
  /** Available capacity on that same measurement basis. */
  readonly available?: number;
}

/** A specifically identified resource failure, not an unsupported operation or invariant error. */
export interface CanonicalResourceRejection {
  /** The reference is unavailable; another proved representation may still fit. */
  readonly kind: "resource-rejected";
  /** Existing producer which established the resource constraint. */
  readonly stage: "zero-page" | "allocation" | "storage" | "stack" | "payload" | "layout";
  /** Exact existing service result to preserve for direct compilation. */
  readonly failure: ServiceFailure;
  /** Available observations; no invented vector, empty layout or missing-home assumption. */
  readonly facts: CanonicalPartialFacts;
}

/** Direct storage binding or an explicitly classified failure. */
export type CanonicalStorageOutcome =
  | { readonly kind: "complete"; readonly value: CanonicalPipeline }
  | CanonicalResourceRejection
  | { readonly kind: "failure"; readonly failure: ServiceFailure };

/** Canonical layout reference, retained before any optional representation is constructed. */
export type CanonicalReferenceOutcome =
  | {
      /** A complete physical reference is available for later cost and observer comparison. */
      readonly kind: "feasible";
      /** Direct machine and source facts which produced this layout. */
      readonly checked: CanonicalPipeline;
      /** Actual final layout, bound machine and regenerated storage certificate. */
      readonly shared: Extract<SharedStorageResult, { readonly kind: "complete" }>;
      /** Original diagnostic order, including final resource advisories. */
      readonly diagnostics: readonly ProjectDiagnostic[];
    }
  | CanonicalResourceRejection
  | { readonly kind: "failure"; readonly failure: ServiceFailure };

/** Input for the finite whole-program construction frontier. */
export interface SizeSelectionInput {
  /** Checked source and its source-only loop context, independent of allocation. */
  readonly checked: CheckedSourceInput;
}

/** One admitted whole-program construction recipe before any cost decision. */
export interface SizeSelectionPlan {
  /** Stable source and recipe identity derived without executed cost guesses. */
  readonly id: string;
  /** Direct canonical bundle or the complete proved Closed bundle. */
  readonly nonLoopBundle: "direct" | "closed";
  /** One admitted finite loop policy; Original is the only inactive-axis choice. */
  readonly loopPolicy: FixedLoopPolicy;
  /** Full, compact unrolled or compact looped cooperative startup. */
  readonly startupPolicy: C64StartupPolicy;
  /** Complete immutable facts and axis choices consumed by the existing lowerer. */
  readonly sourceFacts: MachineSourceFacts;
  /** Physical, raw, alias and asynchronous obligations remain for final validation. */
  readonly pendingObservers: true;
}

/** One fully closed selected representation, before closed-cost comparison. */
export interface ClosedSizeCandidate {
  /** Exact admitted recipe which produced this representation. */
  readonly plan: SizeSelectionPlan;
  /** Real selected lowering and provisional storage closure. */
  readonly pipeline: CanonicalPipeline;
  /** Final shared layout, re-closed storage and bound machine operations. */
  readonly shared: Extract<SharedStorageResult, { readonly kind: "complete" }>;
  /** Exact final observer acceptance, not an inferred exemption. */
  readonly observers: Extract<ObserverValidation, { readonly kind: "complete" }>;
  /** Closed B/R/T vector from that final layout and certificate. */
  readonly cost: SizeCostVector;
}

/** Complete candidate, a whole-tuple rejection, or a terminal internal failure. */
export type SizeCandidateResult =
  | { readonly kind: "complete"; readonly value: ClosedSizeCandidate }
  | {
      /** This recipe cannot be selected; the reference or another tuple may still be. */
      readonly kind: "rejected";
      readonly plan: SizeSelectionPlan;
      /** Validator-compatible hard rejection family. */
      readonly rejectionKind: string;
      readonly reason: string;
      readonly source: SourceSpan | null;
      readonly objectId: string | null;
    }
  | {
      /** Invalid producer state or an incomplete mandatory stage is terminal. */
      readonly kind: "failure";
      readonly plan: SizeSelectionPlan;
      readonly failure: ServiceFailure;
    };

/** Construct the unchanged public failure without exposing a partial internal result. */
function terminal(category: FailureCategory, diagnostics: readonly ProjectDiagnostic[]) {
  return Object.freeze({
    kind: "failure" as const,
    failure: Object.freeze({
      kind: "failure" as const,
      category,
      diagnostics: Object.freeze([...diagnostics]),
    }),
  });
}

/** Preserve the established compiler-stage diagnostic for an incomplete mandatory operation. */
function incomplete(stage: string) {
  return terminal("compiler", [
    projectDiagnostic(
      "COMPILER_INCOMPLETE",
      `The ${stage} stage is not complete for this program`,
      null,
    ),
  ]);
}

/** Retain real partial observations without manufacturing a successful reference. */
function rejected(
  stage: CanonicalResourceRejection["stage"],
  failure: ServiceFailure,
  facts: CanonicalPartialFacts = {},
): CanonicalResourceRejection {
  return Object.freeze({ kind: "resource-rejected", stage, failure, facts: Object.freeze(facts) });
}

/**
 * Check the allocator's structural demand contract before interpreting its resource tag.
 * Both source inventory and the complete finite lowering demand must pass: a malformed
 * request is an internal failure, never evidence that another representation might fit.
 * @param requests Complete request array at one producer boundary.
 * @returns Whether every byte count and power-of-two alignment is well formed.
 */
export function validStorageDemands(requests: readonly StorageRequest[]): boolean {
  return requests.every(
    (request) =>
      Number.isInteger(request.bytes) &&
      request.bytes >= 0 &&
      Number.isInteger(request.alignment) &&
      request.alignment > 0 &&
      (request.alignment & (request.alignment - 1)) === 0,
  );
}

/**
 * Assemble one complete selected pipeline with the established diagnostic order.
 * This helper performs no allocation or selection; it only packages already bound owners.
 */
function completedPipeline(
  input: CheckedSourceInput,
  program: WholeProgram,
  profile: TargetProfile,
  lowered: CanonicalPipeline["lowered"],
  certificate: CanonicalPipeline["certificate"],
  machine: CanonicalPipeline["machine"],
  deadHomes?: ReadonlySet<string>,
): CanonicalPipeline {
  const irqWarnings = overlappingIrqRootWarnings(program, certificate.irqOverlap);
  const previousWarnings = program.diagnostics ?? [];
  return Object.freeze({
    snapshot: input.snapshot,
    profile,
    resourceSpans: input.resourceSpans,
    bindingNames: input.bindingNames,
    sourceText: input.sourceText,
    program,
    lowered,
    certificate,
    machine,
    ...(deadHomes === undefined ? {} : { deadHomes }),
    diagnostics: Object.freeze([
      ...input.diagnostics,
      ...previousWarnings,
      ...irqWarnings.filter(
        (warning) =>
          !previousWarnings.some(
            (previous) =>
              previous.code === warning.code &&
              previous.message.split(" has ")[0]?.split(" can ")[0] ===
                warning.message.split(" has ")[0]?.split(" can ")[0],
          ),
      ),
      ...lowered.diagnostics,
      ...storageResourceWarnings(program, profile, certificate.certificate, input.resourceSpans),
    ]),
  });
}

/**
 * Run the existing direct lowering and storage proof from an already checked program.
 * Resource failures remain distinguishable from incomplete lowering, unsafe routes and
 * invalid certificates. Direct callers return the retained failure unchanged.
 * @param input Immutable checked source, independent of canonical allocation success.
 * @returns Bound direct machine operations, a resource rejection, or a terminal failure.
 */
export function closeCanonicalStorage(
  input: CheckedSourceInput,
  optimizationFacts?: OptimizationFacts,
): CanonicalStorageOutcome {
  const { program, profile, resourceSpans, snapshot } = input;
  const zeroPageOverflow = sourceZeroPageOverflow(program, profile, resourceSpans);
  if (zeroPageOverflow !== null)
    return rejected("zero-page", terminal("source", [zeroPageOverflow]).failure);
  const reserved = reserveZeroPageGlobals(program, profile.storage);
  if (reserved.kind === "error") {
    const owner = reserved.conflict;
    return terminal("source", [
      projectDiagnostic(
        "E10273",
        `Cannot place '${owner.name?.split(".").at(-1) ?? "zero-page object"}' — explicit placement constraints conflict with occupied storage or the selected zero-page window; change or remove the explicit constraint`,
        resourceSpans.get(`placement:${bindingIdentityKey(owner.id)}`) ??
          resourceSpans.get(bindingIdentityKey(owner.id)) ??
          owner.source,
      ),
    ]);
  }
  const allocationProfile = Object.freeze({
    ...profile,
    storage: Object.freeze({ ...reserved.storage, profileId: profile.id }),
  });
  const preferZeroPage = input.snapshot.manifest.optimization === "size";
  const inventory = inventoryStorage(reserved.program, { preferZeroPage });
  if (!validStorageDemands(inventory.requests)) return incomplete("static storage allocation");
  const provisional = allocateStorage(inventory, buildInterference(inventory), reserved.storage);
  if (provisional.kind === "error")
    return rejected("allocation", incomplete("static storage allocation").failure, {
      inventory,
      objectId: provisional.requestId,
    });
  const placement = provisional.placement;
  const lower = (facts: OptimizationFacts | undefined) =>
    lowerMachineProgram({
      ...(snapshot.manifest.optimization === "size" ? { observerEvidence: true } : {}),
      ...(facts === undefined ? {} : { optimizationFacts: facts }),
      preferZeroPage: input.snapshot.manifest.optimization === "size",
      bindingNames: input.bindingNames,
      program: reserved.program,
      placement,
      profile: allocationProfile,
      boundsCheck: snapshot.manifest.boundsCheck,
      divisionZeroCheck: snapshot.manifest.divisionZeroCheck,
      sourceText: input.sourceText,
    });
  let lowered = lower(optimizationFacts);
  if (lowered.kind === "error")
    return terminal("compiler", [projectDiagnostic("COMPILER_LOWERING", lowered.reason, null)]);
  // The canonical reference decides which private temporary homes no rule keeps
  // readable. Every admitted representation receives that same set, so removing a
  // dead store can never make two layouts structurally disagree.
  let deadHomes: ReadonlySet<string> | undefined;
  if (optimizationFacts !== undefined) {
    const dead = deadTemporaryHomes(lowered.program);
    if (dead.size > 0) {
      const cleaned = lower(Object.freeze({ ...optimizationFacts, deadHomes: dead }));
      if (cleaned.kind === "error")
        return terminal("compiler", [projectDiagnostic("COMPILER_LOWERING", cleaned.reason, null)]);
      lowered = cleaned;
      deadHomes = dead;
    }
  }
  // The lowering binder returns this exact predeclared array on every discovery
  // round. Validate it before closure can interpret an allocation rejection.
  if (!validStorageDemands(lowered.program.requiredStorage))
    return incomplete("static storage closure");
  const certificate = closeStorage(inventory, reserved.storage, lowered.binder);
  if (certificate.kind === "error") {
    if (certificate.reason === "stack" && certificate.measured !== undefined) {
      if (!Number.isFinite(certificate.measured)) {
        const witness = certificate.route ?? [];
        const reentered = witness.findLast((part) => part.startsWith("reentered:"))?.slice(10);
        const handler = program.semantic.functions.find(
          (fn) => bindingIdentityKey(fn.id) === reentered,
        );
        const routeFunctions = new Set(witness);
        const related = (program.interruptRoutes ?? [])
          .filter(
            (route) =>
              routeFunctions.has(bindingIdentityKey(route.handler)) ||
              (handler !== undefined &&
                route.installation.span.sourceId === handler.source.sourceId &&
                route.installation.span.start >= handler.source.start &&
                route.installation.span.end <= handler.source.end),
          )
          .map((route) => ({
            span: route.installation.span,
            message: "Handler selected on this unbounded IRQ route",
          }));
        return terminal("source", [
          projectDiagnostic(
            "E10245",
            "Execution path 'IRQ re-entry' can overlap or consume hardware stack without a static bound — use a bounded interrupt/callback design",
            handler?.source ??
              resourceSpans.get(bindingIdentityKey(program.semantic.main)) ??
              program.semantic.main.span,
            null,
            related,
          ),
        ]);
      }
      const failure = terminal("source", [
        projectDiagnostic(
          "E10238",
          `Target resource budget exceeded for 'hardware stack' — used ${certificate.measured}, available ${certificate.available} on '${profile.id}'`,
          resourceSpans.get(bindingIdentityKey(program.semantic.main)) ??
            program.semantic.main.span,
        ),
      ]).failure;
      return rejected("stack", failure, {
        inventory,
        placement,
        lowered,
        measured: certificate.measured,
        ...(certificate.available === undefined ? {} : { available: certificate.available }),
      });
    }
    const failure = incomplete("static storage closure");
    return certificate.reason === "resource"
      ? rejected("storage", failure.failure, {
          inventory,
          placement,
          lowered,
          objectId: certificate.requestId ?? null,
        })
      : failure;
  }
  const privateNmi = nmiPrivateStorageRoute(certificate.inventory);
  if (privateNmi !== null)
    return terminal("source", [
      projectDiagnostic(
        "E10245",
        `Execution path '${privateNmi.sink.source}' has unbounded private-storage overlap, disallowed unbounded stack use, or unproved generated reentrancy`,
        privateNmi.installation.span,
      ),
    ]);
  const machine = bindMachineProgram(lowered.program, certificate.certificate);
  if (machine.kind === "error") return incomplete("machine storage binding");
  return Object.freeze({
    kind: "complete",
    value: completedPipeline(
      input,
      reserved.program,
      profile,
      lowered,
      certificate,
      machine,
      deadHomes,
    ),
  });
}

/**
 * Close the direct platform layout without invoking ACME or publishing artifacts.
 * Only named capacity/placement failures are nonterminal reference rejections;
 * malformed machine state, certificate failures and nonconvergence remain terminal.
 * @param checked Direct storage closure, completed before the driver's cancellation checkpoint.
 * @param candidate Treat a malformed selected startup recipe as a tuple rejection.
 * @returns A real physical reference or its exact failure and available partial facts.
 */
export function closeCanonicalReference(
  checked: CanonicalPipeline,
  candidate = false,
): CanonicalReferenceOutcome {
  const { profile, resourceSpans, lowered } = checked;
  const facts = {
    inventory: checked.certificate.inventory,
    placement: checked.certificate.placement,
    lowered,
    certificate: checked.certificate,
  };
  const payloadOverflow =
    embeddedPayloadOverflow(lowered.program, profile, resourceSpans) ??
    residentDataOverflow(lowered.program, profile, resourceSpans);
  if (payloadOverflow !== null)
    return rejected("payload", terminal("source", [payloadOverflow]).failure, facts);
  const shared = closeSharedStorage(lowered.program, lowered.binder, checked.certificate, profile);
  if (shared.kind === "resource-error")
    return rejected(
      "layout",
      terminal("source", [sharedRamAllocationFailure(shared.used, profile, shared.source)]).failure,
      { ...facts, measured: shared.used },
    );
  if (shared.kind === "error") {
    const failed = terminal("compiler", [
      shared.reason === "source-placement"
        ? sourcePlacementFailure(lowered.program, resourceSpans, shared.objectId)
        : projectDiagnostic(
            "COMPILER_LAYOUT",
            `Platform layout failed: ${shared.reason}${shared.objectId === null ? "" : ` (${shared.objectId})`}`,
            null,
          ),
    ]);
    // These are actual placement/capacity outcomes. Unknown reason strings cannot
    // turn an internal error into an optimization opportunity.
    return shared.reason === "resident-range" ||
      shared.reason === "source-placement" ||
      (shared.reason === "code-conflict" && shared.objectId === "startup.restore") ||
      (candidate && shared.reason === "invalid-data" && shared.objectId === C64_STARTUP_STATE_ID)
      ? rejected("layout", failed.failure, { ...facts, objectId: shared.objectId })
      : failed;
  }
  return Object.freeze({
    kind: "feasible",
    checked,
    shared,
    diagnostics: Object.freeze([
      ...checked.diagnostics,
      ...layoutResourceWarnings(shared.layout, checked.program, profile, resourceSpans),
    ]),
  });
}

/** Source facts derived once for every admitted bundle and loop policy. */
function deriveSizeSourceFacts(input: CheckedSourceInput) {
  const loops = deriveFixedLoopFacts(input.program, input.loopNesting);
  const objects = deriveClosedObjectFacts(
    input.program,
    input.profile.storage,
    fixedLoopValueBounds(input.program, loops),
  );
  const lifetimes = deriveLocalStorageLifetimes(input.program);
  const functions = new Map(
    input.program.semantic.functions.map((fn) => [
      fn,
      Object.freeze({
        function: fn,
        objects,
        loops: loops.filter((loop) => loop.function === fn),
        lifetimes: new Map([...lifetimes].filter(([, life]) => life.function === fn.id)),
      }),
    ]),
  );
  return {
    loops,
    objects,
    functions,
    displayIndependent: hasDisplayIndependentStartup(input.program, true),
  };
}

/**
 * Enumerate only the fixed whole-program recipe frontier. Missing source patterns keep
 * their ordinary axis choice; no per-site Cartesian product or recursive search is formed.
 * @param input Checked source with its source-only loop context.
 * @returns Deterministic Direct/Closed, loop and startup tuples, at most 36 plans.
 */
export function sizeSelectionPlans(input: SizeSelectionInput): Iterable<SizeSelectionPlan> {
  const checked = input.checked;
  const prepared = deriveSizeSourceFacts(checked);
  const loopPolicies: readonly FixedLoopPolicy[] =
    prepared.loops.length === 0
      ? ["original"]
      : ["original", "low-byte", "x-first", "y-first", "flat-eight-x-first", "flat-eight-y-first"];
  const startupPolicies: readonly C64StartupPolicy[] = prepared.displayIndependent
    ? ["full", "compact-unrolled", "compact-looped"]
    : ["full"];
  const closedStorage = selectClosedObjectStorage(prepared.objects);
  const functionsFor = (bundle: "direct" | "closed") =>
    new Map(
      [...prepared.functions].map(([fn, facts]) => {
        const storage = bundle === "closed" ? closedStorage.get(fn) : undefined;
        const packet = storage === undefined ? facts : Object.freeze({ ...facts, storage });
        return [
          fn,
          Object.freeze({
            ...packet,
            complements: deriveByteComplementFacts(packet, checked.profile),
          }),
        ] as const;
      }),
    );
  function* plans(): Generator<SizeSelectionPlan> {
    for (const nonLoopBundle of ["direct", "closed"] as const) {
      const functions = functionsFor(nonLoopBundle);
      for (const loopPolicy of loopPolicies) {
        for (const startupPolicy of startupPolicies) {
          yield Object.freeze({
            id: `${checked.snapshot.inputSha256}:${checked.profile.id}:${nonLoopBundle}:${loopPolicy}:${startupPolicy}`,
            nonLoopBundle,
            loopPolicy,
            startupPolicy,
            sourceFacts: Object.freeze({
              program: checked.program,
              functions,
              nonLoopBundle,
              loopPolicy,
              startupPolicy,
            }),
            pendingObservers: true as const,
          });
        }
      }
    }
  }
  return plans();
}

/** Inputs for closing one admitted construction recipe without selecting it. */
export interface SizeCandidateInput {
  /** Checked source shared by the reference and every tuple. */
  readonly checked: CheckedSourceInput;
  /** Canonical feasible or resource-rejected reference retained for final observers. */
  readonly reference: Exclude<CanonicalReferenceOutcome, { readonly kind: "failure" }>;
  /** Exact admitted recipe to build once. */
  readonly plan: SizeSelectionPlan;
  /** Immutable facts shared by every admitted recipe for this source. */
  readonly optimizationFacts?: OptimizationFacts;
}

/** Retain the exact source owner for a selected-tuple resource rejection. */
/** Map an existing resource stage to the costs validator's hard-reason family. */
function rejectionKindForStage(stage: CanonicalResourceRejection["stage"]): string {
  if (stage === "zero-page") return "zeroPage";
  if (stage === "storage") return "sfa";
  if (stage === "stack") return "stack";
  if (stage === "payload") return "memory";
  if (stage === "layout") return "layout";
  return "memory";
}

function candidateRejected(
  plan: SizeSelectionPlan,
  rejectionKind: string,
  reason: string,
  source: SourceSpan | null,
  objectId: string | null = null,
): SizeCandidateResult {
  return Object.freeze({ kind: "rejected", plan, rejectionKind, reason, source, objectId });
}

/**
 * Build and close one admitted recipe through the existing storage, layout and observer
 * owners. No cost is guessed and no rejected tuple is repaired into another representation.
 * @param input Checked source, canonical reference and one admitted plan.
 * @returns The complete closed candidate, one whole-tuple rejection, or a terminal failure.
 */
export function closeSizeCandidate(input: SizeCandidateInput): SizeCandidateResult {
  const { checked, plan } = input;
  const zeroPageOverflow = sourceZeroPageOverflow(
    checked.program,
    checked.profile,
    checked.resourceSpans,
  );
  if (zeroPageOverflow !== null)
    return Object.freeze({
      kind: "failure",
      plan,
      failure: terminal("source", [zeroPageOverflow]).failure,
    });
  const reserved = reserveZeroPageGlobals(checked.program, checked.profile.storage);
  if (reserved.kind === "error") {
    const owner = reserved.conflict;
    return Object.freeze({
      kind: "failure",
      plan,
      failure: terminal("source", [
        projectDiagnostic(
          "E10273",
          `Cannot place '${owner.name?.split(".").at(-1) ?? "zero-page object"}' — explicit placement constraints conflict with occupied storage or the selected zero-page window; change or remove the explicit constraint`,
          checked.resourceSpans.get(`placement:${bindingIdentityKey(owner.id)}`) ??
            checked.resourceSpans.get(bindingIdentityKey(owner.id)) ??
            owner.source,
        ),
      ]).failure,
    });
  }
  const allocationProfile = Object.freeze({
    ...checked.profile,
    storage: Object.freeze({ ...reserved.storage, profileId: checked.profile.id }),
  });
  const preferZeroPage = checked.snapshot.manifest.optimization === "size";
  const inventory = inventoryStorage(reserved.program, { preferZeroPage });
  if (!validStorageDemands(inventory.requests))
    return Object.freeze({
      kind: "failure",
      plan,
      failure: incomplete("static storage allocation").failure,
    });
  const lowered = lowerMachineProgram({
    observerEvidence: true,
    bindingNames: checked.bindingNames,
    program: reserved.program,
    profile: allocationProfile,
    logicalStorage: inventory,
    sourceFacts: plan.sourceFacts,
    optimizationFacts:
      input.optimizationFacts ?? deriveOptimizationFacts({ checked, mode: "size" }),
    preferZeroPage: checked.snapshot.manifest.optimization === "size",
    boundsCheck: checked.snapshot.manifest.boundsCheck,
    divisionZeroCheck: checked.snapshot.manifest.divisionZeroCheck,
    sourceText: checked.sourceText,
  });
  if (lowered.kind === "error")
    return candidateRejected(plan, "semantics", lowered.reason, lowered.source);
  if (!validStorageDemands(lowered.program.requiredStorage))
    return Object.freeze({
      kind: "failure",
      plan,
      failure: incomplete("static storage closure").failure,
    });
  const certificate = closeStorage(lowered.inventory, reserved.storage, lowered.binder);
  if (certificate.kind === "error") {
    if (certificate.reason === "stack" || certificate.reason === "resource")
      return candidateRejected(
        plan,
        certificate.reason === "stack" ? "stack" : "memory",
        certificate.reason === "stack"
          ? `hardware stack demand ${certificate.measured ?? "Unknown"} is unavailable`
          : "selected storage demand does not fit",
        checked.resourceSpans.get(bindingIdentityKey(checked.program.semantic.main)) ?? null,
        certificate.requestId ?? null,
      );
    return Object.freeze({
      kind: "failure",
      plan,
      failure: incomplete("static storage closure").failure,
    });
  }
  const privateNmi = nmiPrivateStorageRoute(certificate.inventory);
  if (privateNmi !== null)
    return candidateRejected(
      plan,
      "sfa",
      "selected private-storage route has unbounded overlap",
      privateNmi.installation.span,
    );
  const machine = bindMachineProgram(lowered.program, certificate.certificate);
  if (machine.kind === "error")
    return Object.freeze({
      kind: "failure",
      plan,
      failure: incomplete("machine storage binding").failure,
    });
  const pipeline = completedPipeline(
    checked,
    reserved.program,
    checked.profile,
    lowered,
    certificate,
    machine,
    input.optimizationFacts?.deadHomes,
  );
  const reference = closeCanonicalReference(pipeline, true);
  if (reference.kind === "failure")
    return Object.freeze({ kind: "failure", plan, failure: reference.failure });
  if (reference.kind === "resource-rejected") {
    const objectId = reference.facts.objectId ?? null;
    return candidateRejected(
      plan,
      rejectionKindForStage(reference.stage),
      `${reference.stage} resource rejection`,
      objectId === null ? null : (checked.resourceSpans.get(objectId) ?? null),
      objectId,
    );
  }
  const settledPipeline = Object.freeze({ ...pipeline, diagnostics: reference.diagnostics });
  const observers = validateSizeObservers({
    checked,
    reference: input.reference,
    candidate: { lowered: settledPipeline.lowered, shared: reference.shared },
  });
  if (observers.kind !== "complete") {
    if (observers.kind === "error")
      return Object.freeze({
        kind: "failure",
        plan,
        failure: terminal("compiler", [
          projectDiagnostic("COMPILER_INCOMPLETE", observers.reason, observers.source),
        ]).failure,
      });
    return candidateRejected(
      plan,
      "layout",
      observers.reason,
      observers.source,
      observers.objectId,
    );
  }
  return Object.freeze({
    kind: "complete",
    value: Object.freeze({
      plan,
      pipeline: settledPipeline,
      shared: reference.shared,
      observers,
      cost: sizeCostVector(reference.shared.layout, reference.shared.certificate.certificate),
    }),
  });
}

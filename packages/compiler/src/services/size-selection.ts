import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { bindMachineProgram } from "../machine/bind.js";
import { lowerMachineProgram } from "../machine/lower.js";
import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, ProjectSnapshot, SourceSpan } from "../project/types.js";
import { overlappingIrqRootWarnings } from "../semantic/interrupt-domains.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import type { SourceLoopNesting } from "../semantic/fixed-loop-facts.js";
import { allocateStorage } from "../storage/allocate.js";
import { closeStorage } from "../storage/closure.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { nmiPrivateStorageRoute } from "../storage/nmi-private-storage.js";
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
 * Run the existing direct lowering and storage proof from an already checked program.
 * Resource failures remain distinguishable from incomplete lowering, unsafe routes and
 * invalid certificates. Direct callers return the retained failure unchanged.
 * @param input Immutable checked source, independent of canonical allocation success.
 * @returns Bound direct machine operations, a resource rejection, or a terminal failure.
 */
export function closeCanonicalStorage(input: CheckedSourceInput): CanonicalStorageOutcome {
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
  const inventory = inventoryStorage(reserved.program);
  if (!validStorageDemands(inventory.requests)) return incomplete("static storage allocation");
  const provisional = allocateStorage(inventory, buildInterference(inventory), reserved.storage);
  if (provisional.kind === "error")
    return rejected("allocation", incomplete("static storage allocation").failure, {
      inventory,
      objectId: provisional.requestId,
    });
  const placement = provisional.placement;
  const lowered = lowerMachineProgram({
    ...(snapshot.manifest.optimization === "size" ? { observerEvidence: true } : {}),
    bindingNames: input.bindingNames,
    program: reserved.program,
    placement,
    profile: allocationProfile,
    boundsCheck: snapshot.manifest.boundsCheck,
    divisionZeroCheck: snapshot.manifest.divisionZeroCheck,
    sourceText: input.sourceText,
  });
  if (lowered.kind === "error")
    return terminal("compiler", [projectDiagnostic("COMPILER_LOWERING", lowered.reason, null)]);
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
  const irqWarnings = overlappingIrqRootWarnings(reserved.program, certificate.irqOverlap);
  const previousWarnings = reserved.program.diagnostics ?? [];
  return Object.freeze({
    kind: "complete",
    value: Object.freeze({
      snapshot,
      profile,
      resourceSpans,
      bindingNames: input.bindingNames,
      sourceText: input.sourceText,
      program: reserved.program,
      lowered,
      certificate,
      machine,
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
        ...storageResourceWarnings(
          reserved.program,
          profile,
          certificate.certificate,
          resourceSpans,
        ),
      ]),
    }),
  });
}

/**
 * Close the direct platform layout without invoking ACME or publishing artifacts.
 * Only named capacity/placement failures are nonterminal reference rejections;
 * malformed machine state, certificate failures and nonconvergence remain terminal.
 * @param checked Direct storage closure, completed before the driver's cancellation checkpoint.
 * @returns A real physical reference or its exact failure and available partial facts.
 */
export function closeCanonicalReference(checked: CanonicalPipeline): CanonicalReferenceOutcome {
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
      (shared.reason === "code-conflict" && shared.objectId === "startup.restore")
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

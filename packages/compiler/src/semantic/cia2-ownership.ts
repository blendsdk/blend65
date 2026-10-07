import { projectDiagnostic } from "../project/diagnostics.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import type { MemoryWriteOperation, PlatformOperation } from "./operations.js";
import type { InterruptWriteAddress } from "./interrupt-address-facts.js";
import type { SelectedEntry, VectorState } from "./interrupt-context-facts.js";
import { cia2OperationKind, mutateCia2Owner, rawCia2Effect } from "./cia2-ownership-facts.js";
import type { Cia2Facts } from "./cia2-ownership-facts.js";

/** One local transition; the existing caller owns scheduling, joins and termination. */
export interface Cia2Transition {
  /** Device facts for the resulting ordered vector state. */
  readonly facts: Cia2Facts;
  /** True only for a proved final configuration-changing stock release. */
  readonly stockHandback: boolean;
  /** A canonical source error prevents consuming the discovered lowering facts. */
  readonly diagnostic: ProjectDiagnostic | null;
}

/** Keep the ownership failure attached to the source operation which needs its proof. */
function invalid(
  operation: string,
  detail: string,
  span: SourceSpan,
  related: ProjectDiagnostic["related"] = [],
): ProjectDiagnostic {
  return projectDiagnostic(
    "E10278",
    `Interrupt ownership for sink 'c64.system.setNMIExclusive' is invalid at '${operation}' — ${detail}`,
    span,
    null,
    related,
  );
}

/** Return a transition without inventing a hardware snapshot or a runtime test. */
function transition(facts: Cia2Facts, diagnostic: ProjectDiagnostic | null = null): Cia2Transition {
  return { facts, stockHandback: false, diagnostic };
}

/**
 * Find the actual exclusive consumer through immutable chain continuations.
 * The entry's physical installation word identifies the device lease; its
 * shared wrapper label is not enough to distinguish nested equal callbacks.
 */
export function cia2DeviceOwner(state: Pick<VectorState, "vectors" | "words">): string | null {
  let entry = state.vectors.nmi;
  const seen = new Set<string>();
  while (entry !== null) {
    const slot = entry.context.entrySlot;
    if (slot === undefined) throw new Error("Selected NMI entry lacks its physical binding");
    if (entry.route.variant.id === "c64_kernal_nminv_exclusive") return slot;
    if (entry.tail === undefined || seen.has(entry.tail)) return null;
    seen.add(entry.tail);
    entry = state.words.get(entry.tail)?.entry ?? null;
  }
  return null;
}

/** Attach finite device obligations to the already-proved physical capture. */
export function installCia2Lease(
  facts: Cia2Facts,
  slot: string,
  exclusive: boolean,
  stockPredecessor: boolean,
  operation: PlatformOperation,
): Cia2Transition {
  if (exclusive && stockPredecessor && !facts.idleStock)
    return transition(
      facts,
      invalid(
        operation.capability,
        "qualified idle CIA2 firmware provenance is lost",
        operation.span,
      ),
    );
  const previous = facts.leases.get(slot);
  // Equal live capture reuses an existing physical binding. External arrivals
  // cannot reset its mutation history or push an unbounded device-state frame.
  if (previous !== undefined) {
    if (previous.exclusive !== exclusive) throw new Error("Live CIA2 lease changes entry policy");
    return transition(facts);
  }
  const leases = new Map(facts.leases);
  leases.set(slot, {
    exclusive,
    mutation: "clean",
    timerChanged: false,
    priorMask: facts.maskKnown && facts.maskExact ? facts.possibleSources : null,
  });
  return transition({ ...facts, leases });
}

/**
 * Check one typed device operation against its actual incoming vector relation.
 * Mainline and ordinary helpers use the same facts as selected IRQ/NMI entries;
 * an I-bit, a device mask, or a syntactic handler name never proves ownership.
 * The reaching call explains rejected flags without claiming it supplied a converted value.
 */
export function applyCia2Operation(
  facts: Cia2Facts,
  state: Pick<VectorState, "vectors" | "words">,
  activeEntry: SelectedEntry | undefined,
  operation: PlatformOperation,
  exact: bigint | undefined,
  actualCall?: SourceSpan,
): Cia2Transition {
  const kind = cia2OperationKind(operation.capability);
  if (kind === null || kind === "counter") return transition(facts);
  const slot = cia2DeviceOwner(state);
  if (slot === null || !facts.leases.get(slot)?.exclusive)
    return transition(
      facts,
      invalid(
        operation.capability,
        "CIA2 operations require a proved exclusive NMI device owner",
        operation.span,
      ),
    );
  if (kind === "consume") {
    const chainedCaller =
      activeEntry?.route.sink.domain === "nmi" &&
      activeEntry.route.variant.id === "c64_kernal_nminv_chain";
    return transition(
      facts,
      chainedCaller
        ? invalid(
            operation.capability,
            "a chained callback cannot consume its downstream owner's pending sources",
            operation.span,
          )
        : null,
    );
  }
  const allowed =
    kind === "control"
      ? operation.capability.endsWith("configureTimerA")
        ? 0x19
        : 0x59
      : kind === "enable"
        ? 0x03
        : kind === "disable"
          ? 0x1f
          : null;
  if (allowed !== null && exact !== undefined && (exact & ~BigInt(allowed)) !== 0n)
    return transition(
      facts,
      invalid(
        operation.capability,
        `constant flags contain bits outside the owned $${allowed.toString(16).toUpperCase()} set`,
        operation.span,
        actualCall === undefined
          ? []
          : [
              {
                span: actualCall,
                message: `This call reaches rejected flags $${exact.toString(16).toUpperCase().padStart(2, "0")}`,
              },
            ],
      ),
    );
  if (kind === "enable" && !facts.maskKnown)
    return transition(
      facts,
      invalid(
        operation.capability,
        "CIA2's prior source mask is unreadable; disable all five sources before enabling a timer source",
        operation.span,
      ),
    );
  if (kind === "enable" || kind === "disable") {
    const bits = exact === undefined ? (kind === "enable" ? 3 : 0) : Number(exact);
    const sources =
      kind === "enable" ? facts.possibleSources | bits : facts.possibleSources & ~bits;
    const unchanged = facts.maskExact && exact !== undefined && sources === facts.possibleSources;
    const mutated = unchanged ? facts : mutateCia2Owner(facts, slot, "typed");
    const fullClear = kind === "disable" && exact === 0x1fn;
    return transition({
      ...mutated,
      maskKnown: facts.maskKnown || fullClear,
      maskExact: fullClear || (facts.maskExact && exact !== undefined),
      possibleSources: sources,
    });
  }
  // Control strobes and latch writes affect the timer epoch even when their
  // literal bytes repeat. A counter observation cannot recover a reload latch
  // or the prior running phase needed to resume an older device owner.
  return transition(mutateCia2Owner(facts, slot, "typed", true));
}

/** Invalidate only proved overlapping device/firmware history, not unrelated raw writes. */
export function applyCia2RawWrite(
  facts: Cia2Facts,
  state: Pick<VectorState, "vectors" | "words">,
  operation: MemoryWriteOperation,
  address: InterruptWriteAddress | undefined,
  value: bigint | undefined,
): Cia2Facts {
  const effect = rawCia2Effect(operation, address, value);
  if (!effect.device && !effect.firmware) return facts;
  const slot = cia2DeviceOwner(state);
  const mutated = slot === null ? facts : mutateCia2Owner(facts, slot, "raw");
  return {
    ...mutated,
    idleStock: false,
    ...(effect.device ? { maskKnown: false, maskExact: false, possibleSources: 0x1f } : {}),
  };
}

/**
 * End one logical owner. A clean successor leaves the predecessor's
 * device epoch unchanged. Only the exact qualified stock route can discard a
 * typed epoch; an unreadable or running prior state is never reconstructed.
 */
export function releaseCia2Lease(
  facts: Cia2Facts,
  slot: string,
  stockPredecessor: boolean,
  operation: PlatformOperation,
  retainCapture = false,
): Cia2Transition {
  const lease = facts.leases.get(slot);
  if (lease === undefined) throw new Error("CIA2 release lacks its proved physical lease");
  const final = lease.exclusive && stockPredecessor;
  // A mask-only inner epoch can prove its own net restoration. This is not a
  // guessed mask or an emitted reconstruction: all paths must end at the exact
  // software-proved incoming mask, with no changed timer/latch or raw history.
  const restoredMask =
    !lease.timerChanged &&
    lease.priorMask !== null &&
    facts.maskKnown &&
    facts.maskExact &&
    facts.possibleSources === lease.priorMask;
  if (
    lease.mutation === "raw" ||
    (final && !facts.idleStock) ||
    (!final && lease.mutation !== "clean" && !restoredMask)
  )
    return transition(
      facts,
      invalid(
        operation.capability,
        "CIA2 prior timer/mask state or qualified idle stock handback cannot be proved",
        operation.span,
      ),
    );
  const stockHandback = final && lease.mutation === "typed";
  const leases = new Map(facts.leases);
  // Equal capture reuse can suspend another owner of this same physical word.
  // Its original device history must survive until that owner's restore ends.
  if (!retainCapture) leases.delete(slot);
  return {
    facts: {
      ...facts,
      leases,
      ...(stockHandback ? { maskKnown: true, maskExact: true, possibleSources: 0 } : {}),
    },
    stockHandback,
    diagnostic: null,
  };
}

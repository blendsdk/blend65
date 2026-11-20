import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import type { ProjectDiagnostic, SourceSpan } from "../project/types.js";
import { resolveTargetSets } from "./function-targets.js";
import type { IndirectTargetSets } from "./function-targets.js";
import type {
  IndirectCallOperation,
  SemanticBlock,
  SemanticProgram,
  ValueId,
} from "./operations.js";
import { callablePaths } from "./callable-paths.js";
import {
  callableLeaves,
  constantValue,
  definitionsOf,
  throughAddressConversions,
} from "./raw-write-kills.js";
import type { Definitions, PlacedRange } from "./raw-write-kills.js";
import { reachableBlocks } from "./value-lifetimes.js";
import { unresolvedCallDiagnostic } from "./whole-program.js";
import type { UnresolvedCallCause, WholeProgram } from "./whole-program.js";

/** Outcome of re-proving call targets against the addresses a layout actually chose. */
export type FinalPlacementProof =
  | {
      /** Every reachable call keeps a finite target set under the chosen addresses. */
      readonly kind: "valid";
    }
  | {
      /** At least one reachable call lost its proof; the program must not publish. */
      readonly kind: "invalid";
      /** Canonical finite-target errors in reachable source order. */
      readonly diagnostics: readonly ProjectDiagnostic[];
    }
  | {
      /** The producers disagree, which is a compiler fault rather than a source error. */
      readonly kind: "invariant";
      /** Plain description of the disagreement for an internal failure. */
      readonly reason: string;
    };

/**
 * One source-declared storage root this proof can reason about and name.
 *
 * Module variables and function-frame storage differ in where their addresses
 * come from, but the proof needs the same three facts about either one: which
 * root a write lands on, where callable bytes sit inside it, and the place to
 * point at when a call loses its target.
 */
export interface StorageDescriptor {
  /** Binding identity of the storage, as the byte analysis keys its roots. */
  readonly root: string;
  /** Declared type, which decides where callable bytes sit inside the root. */
  readonly type: SemanticType;
  /** Declaration shown to the author as the storage behind a lost proof. */
  readonly declaration: SourceSpan;
}

/** Describe every module variable, keeping the program's own order. */
function globalDescriptors(program: SemanticProgram): readonly StorageDescriptor[] {
  return program.globals.map((global) => ({
    root: bindingIdentityKey(global.id),
    type: global.type,
    declaration: global.id.span,
  }));
}

/** One executable body reached from the program's closed roots, walked once. */
interface ExecutableBody {
  /** Blocks this body can actually reach. */
  readonly blocks: readonly SemanticBlock[];
  /** Value definitions of those blocks, built on first use and then shared. */
  readonly definitions: () => Definitions;
}

/** One raw write whose constant address covers callable bytes of a stored root. */
interface CorruptingWrite {
  /** Binding identity of the storage the write lands on. */
  readonly root: string;
  /** Source span of the write itself. */
  readonly span: SourceSpan;
  /** First callable byte it covers, in the chosen address space. */
  readonly start: number;
  /** Half-open end of those callable bytes. */
  readonly end: number;
}

/**
 * Keep the chosen intervals of the storage that can actually hold a callable value.
 *
 * Only those bytes can carry a call target, and the analysis that receives this map
 * treats every entry as physically adjacent to its neighbours. Passing storage that
 * cannot hold a callable would therefore cost a great deal and prove nothing.
 */
function callableRanges(
  descriptors: readonly StorageDescriptor[],
  ranges: ReadonlyMap<string, PlacedRange>,
): ReadonlyMap<string, PlacedRange> {
  const selected = new Map<string, PlacedRange>();
  for (const descriptor of descriptors) {
    if (callablePaths(descriptor.type).length === 0) continue;
    const range = ranges.get(descriptor.root);
    if (range !== undefined) selected.set(descriptor.root, range);
  }
  return selected;
}

/** Collect the reachable function and initializer bodies in their closed order. */
function executableBodies(program: WholeProgram): readonly ExecutableBody[] {
  const reachable = new Set(program.reachableFunctions.map((id) => bindingIdentityKey(id)));
  const prepare = (entry: string, all: readonly SemanticBlock[]): ExecutableBody => {
    const blocks = reachableBlocks(entry, all);
    let definitions: Definitions | undefined;
    return {
      blocks,
      definitions: () => (definitions ??= definitionsOf(blocks)),
    };
  };
  const bodies: ExecutableBody[] = [];
  for (const fn of program.semantic.functions) {
    if (reachable.has(bindingIdentityKey(fn.id))) bodies.push(prepare(fn.entry, fn.blocks));
  }
  const globals = new Map(
    program.semantic.globals.map((global) => [bindingIdentityKey(global.id), global] as const),
  );
  for (const id of program.semantic.initializerOrder) {
    const global = globals.get(bindingIdentityKey(id));
    if (global !== undefined && global.entry !== null)
      bodies.push(prepare(global.entry, global.blocks));
  }
  return bodies;
}

/** Resolve the stored root a call reads its target from, when the source names one. */
function callTargetRoot(target: ValueId, definitions: Definitions): string | null {
  const operation = definitions.get(target);
  if (operation?.kind === "load") return bindingIdentityKey(operation.place.root);
  if (operation?.kind === "convert") return callTargetRoot(operation.operand, definitions);
  return null;
}

/**
 * Find every constant-address write that lands on callable bytes of a stored root.
 * These are the sites a lost proof must show, so the author can see which write
 * reaches the callable value rather than only the failing call.
 */
function corruptingWrites(
  bodies: readonly ExecutableBody[],
  ranges: ReadonlyMap<string, PlacedRange>,
  descriptors: readonly StorageDescriptor[],
): readonly CorruptingWrite[] {
  const callableBytes = new Map<string, readonly { start: number; end: number }[]>();
  for (const descriptor of descriptors) {
    const range = ranges.get(descriptor.root);
    if (range === undefined) continue;
    const leaves = callableLeaves(descriptor.type).map((leaf) => ({
      start: range.start + leaf.start,
      end: range.start + leaf.end,
    }));
    if (leaves.length > 0) callableBytes.set(descriptor.root, leaves);
  }
  const writes: CorruptingWrite[] = [];
  for (const body of bodies) {
    for (const block of body.blocks) {
      for (const operation of block.operations) {
        if (operation.kind !== "memory-write") continue;
        const definitions = body.definitions();
        const address = constantValue(
          throughAddressConversions(operation.address, definitions),
          definitions,
        );
        if (address === null) continue;
        for (const [root, leaves] of callableBytes) {
          for (const leaf of leaves) {
            if (address < leaf.end && leaf.start < address + operation.width)
              writes.push({ root, span: operation.span, start: leaf.start, end: leaf.end });
          }
        }
      }
    }
  }
  return writes;
}

/** Render one 16-bit address the way source and other diagnostics spell it. */
function address(value: number): string {
  return `$${value.toString(16).padStart(4, "0")}`;
}

/** Whether two source spans cover at least one byte in common. */
function spansTouch(left: SourceSpan, right: SourceSpan): boolean {
  return left.sourceId === right.sourceId && left.start < right.end && right.start < left.end;
}

/**
 * Keep the sites that can explain this call, with a stable de-duplicated order.
 *
 * A callable packed inside a struct or array names its field, so the declaration of
 * the stored value itself is shown as well when that is a different place. The write
 * note carries the chosen addresses, because the compiler picked them and nothing in
 * the source shows which bytes the author's literal address actually reaches. When
 * the call reads its target through storage these notes cannot name, every covering
 * write is shown rather than none.
 */
function causesFor(
  call: IndirectCallOperation,
  definitions: Definitions,
  writes: readonly CorruptingWrite[],
  storageDeclarations: ReadonlyMap<string, SourceSpan>,
): readonly UnresolvedCallCause[] {
  const root = callTargetRoot(call.target, definitions);
  const causes: UnresolvedCallCause[] = [];
  const declaration = root === null ? undefined : storageDeclarations.get(root);
  if (
    declaration !== undefined &&
    (call.calleeDeclaration === undefined || !spansTouch(declaration, call.calleeDeclaration))
  ) {
    causes.push({
      span: declaration,
      message: "Storage holding the callable value is declared here",
    });
  }
  const matching = root === null ? writes : writes.filter((write) => write.root === root);
  const selected = matching.length > 0 ? matching : writes;
  const seen = new Set<string>();
  for (const write of selected) {
    const key = `${write.span.sourceId}:${write.span.start}:${write.span.end}:${write.start}`;
    if (seen.has(key)) continue;
    seen.add(key);
    causes.push({
      span: write.span,
      message: `A raw memory write replaces the callable bytes placed at ${address(write.start)}–${address(write.end - 1)} here`,
    });
  }
  return causes;
}

/**
 * Whether any raw write in this body could reach one of the chosen callable ranges.
 *
 * A write to a typed place, or to an address this analysis cannot read, keeps its
 * existing conservative treatment and therefore always counts. A constant address
 * that lands nowhere near callable storage adds nothing the earlier closure missed,
 * which is what lets an ordinary program skip the whole re-proof.
 */
function mayReachCallable(body: ExecutableBody, ranges: ReadonlyMap<string, PlacedRange>): boolean {
  for (const block of body.blocks) {
    for (const operation of block.operations) {
      if (operation.kind !== "memory-write") continue;
      const definitions = body.definitions();
      const address = constantValue(
        throughAddressConversions(operation.address, definitions),
        definitions,
      );
      if (address === null) return true;
      for (const range of ranges.values()) {
        if (address < range.end && range.start < address + operation.width) return true;
      }
    }
  }
  return false;
}

/** Whether the later proof only removed candidates the earlier proof already allowed. */
function withinClosedTargets(
  call: IndirectCallOperation,
  closed: IndirectTargetSets | undefined,
  final: readonly BindingId[],
): boolean {
  const previous = closed?.get(call);
  if (previous === undefined) return true;
  const known = new Set(previous.map((id) => bindingIdentityKey(id)));
  return final.every((id) => known.has(bindingIdentityKey(id)));
}

/**
 * Re-prove every reachable call against the addresses a real layout chose.
 * Supplying those addresses can only remove target candidates, so a call that
 * keeps a candidate needs no further work and a call that loses all of them is
 * reported with the canonical finite-target error.
 * @param program Closed whole program whose reachable set and target sets are fixed.
 * @param ranges Absolute half-open intervals of the materialized globals.
 * @param handlerSinkCapabilities Platform sinks the shared target resolution recognizes, so it
 * reproduces the earlier closure. Handler arguments keep that earlier proof: a handler value has
 * no storable type, so no placed bytes of one can be written over.
 * @param frameStorage Function-frame storage whose chosen home is already known, described the
 * same way as a module variable. Omitting it proves module storage alone.
 * @returns Validity, the source errors that prevent publication, or a producer fault.
 * @example finalPlacementProof(program, ranges, new Set(["c64.system.setIRQ"]))
 */
export function finalPlacementProof(
  program: WholeProgram,
  ranges: ReadonlyMap<string, PlacedRange>,
  handlerSinkCapabilities: ReadonlySet<string>,
  frameStorage: readonly StorageDescriptor[] = [],
): FinalPlacementProof {
  const descriptors = [...globalDescriptors(program.semantic), ...frameStorage];
  const callable = callableRanges(descriptors, ranges);
  if (callable.size === 0) return { kind: "valid" };
  const bodies = executableBodies(program);
  // Chosen addresses can only change a proof through a raw write that reaches
  // them, so a program without one keeps the result the earlier closure proved.
  if (!bodies.some((body) => mayReachCallable(body, callable))) return { kind: "valid" };
  const targets = resolveTargetSets(program.semantic, handlerSinkCapabilities, callable).indirect;
  // The accepted path never needs these, so they are derived on the first failure.
  let writes: readonly CorruptingWrite[] | undefined;
  let storageDeclarations: ReadonlyMap<string, SourceSpan> | undefined;
  const diagnostics: ProjectDiagnostic[] = [];
  for (const body of bodies) {
    for (const block of body.blocks) {
      for (const operation of block.operations) {
        if (operation.kind !== "indirect-call") continue;
        const proved = targets.get(operation) ?? [];
        if (!withinClosedTargets(operation, program.indirectTargets, proved)) {
          return {
            kind: "invariant",
            reason: "Final placement widened a closed call target set",
          };
        }
        if (proved.length > 0) continue;
        writes ??= corruptingWrites(bodies, callable, descriptors);
        storageDeclarations ??= new Map(
          descriptors.map((descriptor) => [descriptor.root, descriptor.declaration]),
        );
        diagnostics.push(
          unresolvedCallDiagnostic(
            {
              callee: Object.freeze({ sourceId: "unresolved-indirect", span: operation.span }),
              span: operation.span,
              ...(operation.targetDisplay === undefined
                ? {}
                : { targetDisplay: operation.targetDisplay }),
              ...(operation.calleeDeclaration === undefined
                ? {}
                : { calleeDeclaration: operation.calleeDeclaration }),
              signature: operation.signature,
            },
            causesFor(operation, body.definitions(), writes, storageDeclarations),
          ),
        );
      }
    }
  }
  return diagnostics.length === 0
    ? { kind: "valid" }
    : { kind: "invalid", diagnostics: Object.freeze(diagnostics) };
}

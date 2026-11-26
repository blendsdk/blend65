/**
 * Direct addressing for packed aggregate elements: the absolute and absolute-indexed
 * forms that reach an element without building a 16-bit pointer, and the checks that
 * decide when an element access may take them.
 */
import { bindingIdentityKey, type SemanticType } from "../frontend/semantic-types.js";
import type { SemanticFunction, SemanticOperation, SemanticPlace } from "../semantic/operations.js";
import type { SourceSpan } from "../project/types.js";
import { selectedStoragePlace } from "../storage/selection.js";
import {
  machineInstruction,
  modeForValue,
  operandForValue,
  type LoweredValue,
} from "./lower-control.js";
import type { MachineInstruction, MachineOperand, MachineObserverOrigin } from "./machine-types.js";
import { aggregateAddressPlan } from "./lower-aggregate-place.js";
import {
  isReturnedLocalPlace,
  loadA,
  loweredPlace,
  type FunctionLoweringState,
  typeBytes,
} from "./lower-state.js";
import { hasNoAsynchronousInterleaving } from "./byte-capture-observers.js";
import { narrowableCounters } from "./word-assignment-forwarding.js";

/** A compile-time byte offset or an unsigned byte ordinal that needs no pointer pair. */
export type DirectAggregateAccess =
  | {
      /** Every byte sits at a compile-time offset from the root. */
      readonly kind: "fixed";
      /** The object's own home or link-time label, never a pointer to it. */
      readonly root: Extract<LoweredValue, { readonly kind: "storage" | "label" }>;
      /** Byte offset of the accessed element from the root. */
      readonly offset: number;
    }
  | {
      /** The element is selected at run time by a byte ordinal in an index register. */
      readonly kind: "indexed";
      /** The object's own home or link-time label, never a pointer to it. */
      readonly root: Extract<LoweredValue, { readonly kind: "storage" | "label" }>;
      /** The one-byte ordinal that selects the element. */
      readonly index: LoweredValue;
      /** Compile-time byte offset added to the root before indexing. */
      readonly offset: number;
      /** Bytes between consecutive elements; one needs no scaling. */
      readonly stride: number;
      /** A proved held counter needs no Y setup and may index through X. */
      readonly register?: "x" | "y";
    };

/** Prove the scaled byte index of one direct indexed access from existing ordinal bounds. */
export function directIndexMaximum(
  operation: Extract<SemanticOperation, { readonly kind: "load" | "store" }>,
  direct: DirectAggregateAccess | null,
  state: FunctionLoweringState,
): number | undefined {
  if (direct?.kind !== "indexed" || state.ordinalBounds === undefined || direct.stride < 1)
    return undefined;
  const values = operation.place.path.flatMap((path) =>
    path.kind === "index" ? [path.value] : [],
  );
  if (values.length !== 1) return undefined;
  const maximum = state.ordinalBounds.get(values[0]!);
  if (maximum === undefined || maximum < 0n) return undefined;
  const scaled = maximum * BigInt(direct.stride);
  return scaled <= 0xffn ? Number(scaled) : undefined;
}

/**
 * Retain the actual typed construction without inventing a numeric pointer or widening its bound.
 *
 * The final observers read this record to tie an emitted access back to the source place it
 * serves, the addressing recipe chosen for it and the proved range of its index. Canonical
 * lowering records nothing, because nothing observes it.
 * @param instruction The emitted access.
 * @param operation The source load or store it implements.
 * @param state Current lowering context.
 * @param byte Which byte of the element this instruction touches.
 * @param direct The direct access chosen, or null for the pointer form.
 * @param displacement Compile-time byte offset applied by the pointer form.
 * @param indexValueMaximum Proved maximum of the scaled index, when known.
 * @returns The instruction carrying its observer origin.
 */
export function observeTypedAccess(
  instruction: MachineInstruction,
  operation: Extract<SemanticOperation, { readonly kind: "load" | "store" }>,
  state: FunctionLoweringState,
  byte: number,
  direct: DirectAggregateAccess | null,
  displacement = 0,
  indexValueMaximum?: number,
): MachineInstruction {
  if (!state.input.observerEvidence) return instruction;
  const origin: MachineObserverOrigin = {
    kind: "typed",
    operation,
    position: byte,
    byte,
    length: typeBytes(operation.type),
    recipe:
      direct === null
        ? "typed-indirect"
        : direct.kind === "indexed"
          ? "typed-indexed"
          : "typed-fixed",
    place: selectedStoragePlace(operation.place, state.sourceFacts?.storage),
    indexRegister:
      direct?.kind === "indexed" ? (direct.register ?? "y") : direct === null ? "y" : null,
    displacement: direct?.offset ?? displacement,
    stride: direct?.kind === "indexed" ? direct.stride : 0,
    ...(state.ordinalBounds === undefined ? {} : { indexBounds: state.ordinalBounds }),
    ...(indexValueMaximum === undefined ? {} : { indexValueMaximum }),
  };
  return Object.freeze({ ...instruction, observerOrigins: Object.freeze([Object.freeze(origin)]) });
}

/** Retain a relocation or certified home while adding a compile-time packed offset. */
export function directOperand(access: DirectAggregateAccess, byteOffset = 0): MachineOperand {
  const offset = access.offset + (access.kind === "fixed" ? byteOffset : 0);
  return access.root.kind === "storage"
    ? Object.freeze({ kind: "storage", requestId: access.root.requestId, offset })
    : Object.freeze({ kind: "label", label: access.root.label, offset });
}

/** Keep the physical mode consistent for every byte of one direct access. */
export function directMode(
  access: DirectAggregateAccess,
): "storage" | "zero-page" | "absolute" | "absolute-y" | "absolute-x" {
  return access.kind === "indexed"
    ? access.register === "x"
      ? "absolute-x"
      : "absolute-y"
    : access.root.kind === "storage"
      ? "storage"
      : access.root.zeroPage
        ? "zero-page"
        : "absolute";
}

/** Keep simple static array accesses in the 6502's native absolute indexed mode. */
export function directAggregateAccess(
  place: SemanticPlace,
  type: SemanticType,
  state: FunctionLoweringState,
  source: SourceSpan,
): DirectAggregateAccess | null {
  if (
    place.rootType === undefined ||
    (type.kind !== "scalar" && type.kind !== "enum") ||
    typeBytes(type) > 2
  ) {
    return null;
  }
  const root = loweredPlace(place, typeBytes(place.rootType), false, state);
  if (root.kind !== "storage" && root.kind !== "label") return null;
  // A pointer home names the address, not the object bytes. Returned-local
  // members that resolve to the caller's direct global use the label path.
  if (
    root.kind === "storage" &&
    (root.requestId.includes(":parameter:") || root.requestId.includes(":pointer:"))
  )
    return null;
  const plan = aggregateAddressPlan(place, state, source);
  if (plan.indices.length === 0) {
    return Object.freeze({ kind: "fixed", root, offset: plan.staticOffset });
  }
  if (plan.indices.length !== 1) return null;
  const term = plan.indices[0]!;
  if (term.stride > 1 && (!state.input.boundsCheck || term.extent * term.stride > 256)) return null;
  const retained = state.values.get(plan.indices[0]!.value);
  const held = state.fixedLoops?.indexViews.get(term.value);
  if (
    held !== undefined &&
    held.counter.register !== null &&
    retained !== undefined &&
    (held.consumer.kind === "load" || held.consumer.kind === "store") &&
    held.consumer.place === place &&
    term.stride === 1 &&
    typeBytes(type) === 1
  ) {
    state.fixedLoops?.consumedIndices.add(term.value);
    return Object.freeze({
      kind: "indexed",
      root,
      index: retained,
      offset: plan.staticOffset,
      stride: 1,
      register: held.counter.register,
    });
  }
  const rootKey = state.loadOrigins.get(term.value);
  const counter = rootKey === undefined ? undefined : state.fixedLoops?.counters.get(rootKey);
  /**
   * A bounded word ordinal can use its low byte directly. The loop certificate
   * already proves the high byte is zero, so `absolute-y` addresses the same
   * byte without materializing a 16-bit pointer.
   */
  const ordinalMaximum = state.ordinalBounds?.get(term.value);
  const boundedWord =
    retained?.kind === "storage" &&
    retained.bytes === 2 &&
    retained.signed !== true &&
    ordinalMaximum !== undefined &&
    ordinalMaximum >= 0n &&
    ordinalMaximum < 256n;
  const borrowedGlobal =
    root.kind === "label" &&
    (isReturnedLocalPlace(place, state) ||
      state.input.program.semantic.functions.some(
        (fn) =>
          bindingIdentityKey(fn.id) === bindingIdentityKey(state.owner) &&
          fn.parameters.some(
            (parameter) =>
              bindingIdentityKey(parameter.id) === bindingIdentityKey(place.root) &&
              (parameter.type.kind === "array" || parameter.type.kind === "struct"),
          ),
      ));
  /**
   * The same bounded view serves an ordinary byte element of any static object.
   *
   * Nothing new is assumed. The pointer construction this replaces already
   * reads only the ordinal's low byte on the strength of that same maximum, then
   * adds it to the 16-bit base with the carry joining both bytes. `absolute-y`
   * performs exactly that addition in the address unit, so the byte addressed is
   * the same one. What disappears is the pointer itself, so its zero-page home is
   * never requested and storage closes without it.
   *
   * The bus traffic around that byte is not identical, and only matters at a
   * page crossing. The pointer form adds the whole offset before the access and
   * then indexes by zero, so a store's discarded read lands on the element
   * itself. `absolute-y` forms the low address byte first, so on a crossing its
   * discarded read lands one page below the element, and a load pays one extra
   * cycle. That read is harmless on RAM or ROM and could matter only on a
   * device register, which is why the final observer computes every access
   * envelope, discarded reads included, and refuses the construction unless all
   * of it is ordinary RAM.
   *
   * Held to a unit stride and a one-byte element, which is the shape measured;
   * a scaled ordinal and a two-byte element keep the pointer for now. Only the
   * optimized candidate selects it: canonical direct lowering is the reference
   * a build is measured against, so improving it would move the baseline.
   *
   * The ordinal must also be a plain read of a variable, and where a
   * fixed-loop construction could narrow that variable the view is taken only
   * in the construction that narrows nothing. The held-counter constructions
   * are checked against the canonical lowering's pointer form as their
   * reference, so neither they nor that reference may change shape for a loop
   * they can take over; when they win they are cheaper still, and when every
   * one of them is refused the plain construction still competes with the view.
   * An ordinal whose origin is unknown keeps the pointer.
   */
  const indexRoot = state.loadOrigins.get(term.value);
  const owner = owningFunction(state);
  const narrowable = narrowableCounters(
    state.input,
    owner,
    owner === undefined ? undefined : state.input.sourceFacts?.functions.get(owner)?.loops,
  );
  const ordinaryByteElement =
    term.stride === 1 &&
    typeBytes(type) === 1 &&
    indexRoot !== undefined &&
    narrowable !== undefined &&
    (!narrowable.has(indexRoot) || state.input.sourceFacts?.loopPolicy === "original");
  const index =
    retained?.kind === "zero-extended" && !retained.signed
      ? retained.low.kind === "storage" && retained.low.bytes === 1 && retained.low.signed !== true
        ? retained.low
        : counter?.home === retained.low
          ? retained.low
          : retained
      : boundedWord && (borrowedGlobal || ordinaryByteElement)
        ? Object.freeze({ ...retained, bytes: 1 })
        : retained;
  if (index?.kind !== "storage" || index.bytes !== 1 || index.signed === true) {
    return null;
  }
  return Object.freeze({
    kind: "indexed",
    root,
    index,
    offset: plan.staticOffset,
    stride: term.stride,
  });
}

/**
 * Scale a range-checked byte ordinal in A, then leave its packed byte offset in Y.
 * Each binary digit doubles the current value and optionally adds the original ordinal.
 * The caller admits this path only when the checked maximum offset fits one byte.
 */
export function directIndexInstructions(
  access: Extract<DirectAggregateAccess, { readonly kind: "indexed" }>,
  state: FunctionLoweringState,
  source: SourceSpan,
): readonly MachineInstruction[] {
  const cpu = state.input.profile.cpu;
  if (access.register !== undefined) return Object.freeze([]);
  if (access.stride === 1) {
    return Object.freeze([
      machineInstruction(
        cpu,
        "ldy",
        modeForValue(access.index),
        operandForValue(access.index),
        [],
        source,
      ),
    ]);
  }
  const instructions: MachineInstruction[] = [loadA(access.index, 0, state, source)];
  const bits = access.stride.toString(2).slice(1);
  for (const bit of bits) {
    instructions.push(machineInstruction(cpu, "asl", "accumulator", null, [], source));
    if (bit === "1") {
      instructions.push(
        machineInstruction(cpu, "clc", "implied", null, [], source),
        machineInstruction(
          cpu,
          "adc",
          modeForValue(access.index),
          operandForValue(access.index),
          [],
          source,
        ),
      );
    }
  }
  instructions.push(machineInstruction(cpu, "tay", "implied", null, [], source));
  return Object.freeze(instructions);
}

/**
 * Check the exact typed byte access before lending a counter register to it.
 * Its proved range removes any guard that would need a materialized ordinal.
 * @param place Original typed source place.
 * @param type Scalar element type of the actual consumer.
 * @param value Exact ordinal source value consumed once at this place.
 * @param maximum Nonnegative source maximum under retained loop premises.
 * @param state Current fixed-object and storage representations.
 * @param source Owning source access, retained for invariant diagnostics.
 * @returns Whether direct absolute indexing uses the held register without setup.
 */
export function canUseFixedCounterIndex(
  place: SemanticPlace,
  type: SemanticType,
  value: string,
  maximum: bigint | undefined,
  state: FunctionLoweringState,
  source: SourceSpan,
): boolean {
  if (
    maximum === undefined ||
    maximum < 0n ||
    place.rootType === undefined ||
    typeBytes(type) !== 1 ||
    (isReturnedLocalPlace(place, state) &&
      selectedStoragePlace(place, state.sourceFacts?.storage) === place)
  )
    return false;
  const root = loweredPlace(place, typeBytes(place.rootType), false, state);
  if (
    (root.kind !== "storage" && root.kind !== "label") ||
    (root.kind === "storage" && root.requestId.includes(":parameter:"))
  )
    return false;
  const plan = aggregateAddressPlan(place, state, source);
  const index = plan.indices[0];
  return (
    plan.indices.length === 1 &&
    index?.value === value &&
    index.stride === 1 &&
    maximum < BigInt(index.extent)
  );
}

/** The checked source body being lowered, found by binding identity. */
function owningFunction(state: FunctionLoweringState): SemanticFunction | undefined {
  return state.input.program.semantic.functions.find(
    (fn) => bindingIdentityKey(fn.id) === bindingIdentityKey(state.owner),
  );
}

/** The one plain byte a load of this value reads, or null when it is not a single home byte. */
function homeByte(value: LoweredValue): Extract<LoweredValue, { readonly kind: "storage" }> | null {
  const byte = value.kind === "zero-extended" ? value.low : value;
  return byte.kind === "storage" ? byte : null;
}

/**
 * Decide whether the byte being stored is the very byte that selects the element.
 *
 * `data[i] = byte(i)` reads one home byte twice, once into Y as the index and
 * once into A as the value. `LDA home; TAY` reads it once and leaves A, Y, N and
 * Z exactly as `LDY home; LDA home` would, while carry and overflow are touched
 * by neither, so no continuation has anything to prove: it is two bytes and two
 * cycles cheaper and indistinguishable afterwards.
 *
 * Equality is a statement about storage, not spelling. Both reads must name the
 * same home at the same offset, a single byte each, and nothing may write that
 * home between two adjacent instructions. Only an interrupt could, so the whole
 * program must have no asynchronous entry at all; a volatile or raw read never
 * reaches here, because neither resolves to a plain home. A held counter
 * register, a scaled ordinal and a wider element keep their own setup.
 *
 * Only the optimized candidate selects it, for the same reason as the bounded
 * view above.
 * @param access The selected direct access.
 * @param value The lowered value being stored.
 * @param type Element type of the store.
 * @param state Current lowering context.
 * @returns Whether `LDA home; TAY` may replace `LDY home` followed by `LDA home`.
 */
export function storesItsOwnIndex(
  access: Extract<DirectAggregateAccess, { readonly kind: "indexed" }>,
  value: LoweredValue,
  type: SemanticType,
  state: FunctionLoweringState,
): boolean {
  if (
    state.input.optimizationFacts === undefined ||
    access.register !== undefined ||
    access.stride !== 1 ||
    typeBytes(type) !== 1
  )
    return false;
  const index = homeByte(access.index);
  const stored = homeByte(value);
  if (
    index === null ||
    stored === null ||
    index.bytes !== 1 ||
    index.requestId !== stored.requestId ||
    (index.offset ?? 0) !== (stored.offset ?? 0)
  )
    return false;
  const source = owningFunction(state);
  return source !== undefined && hasNoAsynchronousInterleaving(state.input, source);
}

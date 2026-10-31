import { createHash } from "node:crypto";
import { storageInventoryHash } from "../storage/closure.js";
import type { StorageBinder, StorageInventory } from "../storage/storage-types.js";
import type { TargetProfile } from "../target/profile.js";
import { validateMachineSourceFacts } from "./lower-state.js";
import { validFixedLoopFacts } from "../semantic/aggregate-place-proof.js";
import { validByteComplementFacts } from "./byte-value-availability.js";
import type {
  MachineLoweringInput,
  MachineLoweringResult,
  MachineProgram,
} from "./machine-types.js";

/** Private evidence is not a serialized program field or a public source contract. */
const LOWERING_EVIDENCE = Symbol("lowering-producer-evidence");

/** Content equality plus exact object membership; neither field confers producer authority. */
export interface MachineContentObservation {
  /** Streaming digest of the observed values, including Map and Set entries. */
  readonly fingerprint: string;
  /** Original objects/functions in traversal order, never copied machine graphs. */
  readonly references: readonly object[];
}

/** One direct-lowering implementation with the compiler's existing call signature. */
type LoweringImplementation = (input: MachineLoweringInput) => MachineLoweringResult;

/** A real lowering producer and the only read-only checker accepting its private authority. */
export interface LoweringProducer {
  /** Run the captured implementation once and attach evidence only to a complete result. */
  readonly produce: LoweringImplementation;
  /** Check unchanged symbolic/binder/demand content and the permitted target-profile derivation. */
  readonly matches: (
    program: MachineProgram,
    binder: StorageBinder,
    inventory: StorageInventory,
    target: TargetProfile,
  ) => boolean;
}

/** Work is iterative because legal source/conversion chains need not fit the host call stack. */
type ContentWork =
  | { readonly kind: "value"; readonly value: unknown }
  | { readonly kind: "marker"; readonly value: string };

/**
 * Observe only data supplied by the typed producer boundaries. This is comparison,
 * not semantic analysis, serialization, or a general sealing API. Maps/Sets and
 * object identity are explicit so empty JSON objects cannot hide changed evidence.
 * Private symbol fields are excluded: their owning validators retain authority.
 */
function observe(values: readonly unknown[]): MachineContentObservation {
  const hash = createHash("sha256");
  const references: object[] = [];
  const seen = new Map<object, number>();
  const work: ContentWork[] = values
    .map((value): ContentWork => ({ kind: "value", value }))
    .reverse();
  const marker = (value: string): void => {
    hash.update(value);
    hash.update(";");
  };
  while (work.length > 0) {
    const item = work.pop()!;
    if (item.kind === "marker") {
      marker(item.value);
      continue;
    }
    const value = item.value;
    if (value === null) {
      marker("null");
      continue;
    }
    if (typeof value === "undefined") {
      marker("undefined");
      continue;
    }
    if (typeof value === "string") {
      marker(`string:${JSON.stringify(value)}`);
      continue;
    }
    if (typeof value === "boolean") {
      marker(`boolean:${value}`);
      continue;
    }
    if (typeof value === "number") {
      marker(`number:${Object.is(value, -0) ? "-0" : String(value)}`);
      continue;
    }
    if (typeof value === "bigint") {
      marker(`bigint:${value.toString()}`);
      continue;
    }
    if (typeof value !== "object" && typeof value !== "function")
      throw new Error("Unsupported selected-machine evidence member");
    const known = seen.get(value);
    if (known !== undefined) {
      marker(`reference:${known}`);
      continue;
    }
    const index = references.length;
    seen.set(value, index);
    references.push(value);
    if (typeof value === "function") {
      marker(`function:${index}`);
      continue;
    }
    if (value instanceof Map) {
      const entries: readonly (readonly [unknown, unknown])[] = [...value.entries()];
      marker(`map:${index}:${entries.length}`);
      work.push({ kind: "marker", value: "end-map" });
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        work.push({ kind: "value", value: entries[i]![1] });
        work.push({ kind: "value", value: entries[i]![0] });
      }
      continue;
    }
    if (value instanceof Set) {
      const entries: readonly unknown[] = [...value.values()];
      marker(`set:${index}:${entries.length}`);
      work.push({ kind: "marker", value: "end-set" });
      for (let i = entries.length - 1; i >= 0; i -= 1)
        work.push({ kind: "value", value: entries[i] });
      continue;
    }
    if (Array.isArray(value)) {
      marker(`array:${index}:${value.length}`);
      work.push({ kind: "marker", value: "end-array" });
      for (let i = value.length - 1; i >= 0; i -= 1) work.push({ kind: "value", value: value[i] });
      continue;
    }
    const keys = Object.keys(value).sort();
    marker(`object:${index}:${keys.length}`);
    work.push({ kind: "marker", value: "end-object" });
    for (let i = keys.length - 1; i >= 0; i -= 1) {
      const key = keys[i]!;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor === undefined || descriptor.get !== undefined || descriptor.set !== undefined)
        throw new Error("Selected-machine evidence must contain data properties");
      const member: unknown = descriptor.value;
      work.push({ kind: "value", value: member });
      work.push({ kind: "marker", value: `key:${JSON.stringify(key)}` });
    }
  }
  return Object.freeze({ fingerprint: hash.digest("hex"), references: Object.freeze(references) });
}

/** Compare content and identity; same-size object/Set substitutions must not become a tie. */
function sameContent(left: MachineContentObservation, right: MachineContentObservation): boolean {
  return (
    left.fingerprint === right.fingerprint &&
    left.references.length === right.references.length &&
    left.references.every((reference, index) => reference === right.references[index])
  );
}

/**
 * Observe the complete selected machine data, including nested operands and proof collections.
 * No source rule is inferred here; existing source/recipe/lifetime validators still govern it.
 * @param program Actual symbolic, bound or final machine object to observe without mutation.
 * @returns A bounded digest and identity membership, not an authority to accept a candidate.
 * @example const content = machineProgramContent(program);
 */
export function machineProgramContent(program: MachineProgram): MachineContentObservation {
  return observe([program]);
}

/** The allocation profile may reserve source ZP, but must retain all other target facts. */
function compatibleProfile(input: MachineLoweringInput, target: TargetProfile): boolean {
  const selected = input.profile;
  const { zeroPage: selectedZp, ram: selectedRam, ...selectedBudget } = selected.storage;
  const { zeroPage: targetZp, ram: targetRam, ...targetBudget } = target.storage;
  const staticFacts = (profile: TargetProfile) => [
    profile.id,
    profile.cpu,
    profile.machine,
    profile.serializer,
    profile.packager,
    profile.interrupts,
  ];
  // These target facts are plain typed data; observe still handles nested collections explicitly.
  if (
    observe(staticFacts(selected)).fingerprint !== observe(staticFacts(target)).fingerprint ||
    JSON.stringify(selectedBudget) !== JSON.stringify(targetBudget) ||
    JSON.stringify(selectedRam) !== JSON.stringify(targetRam)
  )
    return false;
  return selectedZp.every((range) =>
    targetZp.some((outer) => range.start >= outer.start && range.end <= outer.end),
  );
}

/** Retain the same existing producer seals instead of creating another semantic authority. */
function validSourceEvidence(input: MachineLoweringInput): boolean {
  validateMachineSourceFacts(input);
  for (const [fn, facts] of input.sourceFacts?.functions ?? []) {
    if (
      facts.loops.some((loop) => !validFixedLoopFacts(loop)) ||
      facts.objects.rangeObservers.some((loop) => !validFixedLoopFacts(loop)) ||
      (facts.complements !== undefined &&
        !validByteComplementFacts(facts.complements, facts, input.profile.id)) ||
      facts.function !== fn
    )
      return false;
  }
  return true;
}

/** Object-local receipt; a private per-factory authority cannot be transplanted between producers. */
class LoweringEvidence {
  readonly #authority: object;
  readonly #input: MachineLoweringInput;
  readonly #inventory: StorageInventory;
  readonly #binder: StorageBinder;
  readonly #program: MachineProgram;
  readonly #content: MachineContentObservation;
  readonly #inventoryHash: string;

  /** Capture before exposing the returned root; no serialized candidate copy is retained. */
  constructor(
    authority: object,
    input: MachineLoweringInput,
    inventory: StorageInventory,
    binder: StorageBinder,
    program: MachineProgram,
  ) {
    this.#authority = authority;
    this.#input = input;
    this.#inventory = inventory;
    this.#binder = binder;
    this.#program = program;
    this.#inventoryHash = storageInventoryHash(inventory);
    this.#content = observe([input, inventory, binder, program]);
    Object.freeze(this);
  }

  /** Only the paired checker has the original authority; copied markers fail root/content checks. */
  matches(
    authority: object,
    program: MachineProgram,
    binder: StorageBinder,
    inventory: StorageInventory,
    target: TargetProfile,
  ): boolean {
    return (
      authority === this.#authority &&
      program === this.#program &&
      binder === this.#binder &&
      inventory.program === this.#inventory.program &&
      storageInventoryHash(inventory) === this.#inventoryHash &&
      compatibleProfile(this.#input, target) &&
      validSourceEvidence(this.#input) &&
      sameContent(this.#content, observe([this.#input, this.#inventory, binder, program]))
    );
  }
}

/**
 * Pair one actual lowering implementation with its private, read-only evidence checker.
 * Every invocation of this factory has different authority. Wrapping a forged implementation
 * cannot produce evidence accepted by the real compiler's separately captured checker.
 * Failures pass through unchanged; success replaces shallow roots only, never the nested graph.
 * @param implementation Existing synchronous direct-lowering implementation.
 * @returns Its producer and paired checker; receipt construction and authority stay private.
 * @example const pair = createLoweringProducer(lowerImplementation);
 */
export function createLoweringProducer(implementation: LoweringImplementation): LoweringProducer {
  const authority = Object.freeze({});
  const produce: LoweringImplementation = (input) => {
    const result = implementation(input);
    if (result.kind !== "complete") return result;
    try {
      const program: MachineProgram = { ...result.program };
      const evidence = new LoweringEvidence(
        authority,
        input,
        result.inventory,
        result.binder,
        program,
      );
      Object.defineProperty(program, LOWERING_EVIDENCE, { value: evidence });
      Object.freeze(program);
      return Object.freeze({ ...result, program });
    } catch {
      return Object.freeze({
        kind: "error",
        reason: "Selected lowering evidence could not be closed",
        source: null,
      });
    }
  };
  const matches: LoweringProducer["matches"] = (program, binder, inventory, target) => {
    try {
      const evidence: unknown = Reflect.get(program, LOWERING_EVIDENCE);
      return (
        evidence instanceof LoweringEvidence &&
        evidence.matches(authority, program, binder, inventory, target)
      );
    } catch {
      return false;
    }
  };
  return Object.freeze({ produce, matches });
}

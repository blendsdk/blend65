import {
  instructionAccessEnvelope,
  validRange,
  wrappedRange,
  operandAddress,
} from "../machine/nmos6510-access.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { validateMachineProgram } from "../machine/bind.js";
import { validSharedStorageProvenance } from "./shared-storage.js";
import { C64_STARTUP_STATE_ID } from "../layout/startup.js";
import { storageIntervals } from "../layout/c64-layout-objects.js";
import { storageInventoryHash } from "../storage/closure.js";
import { validateMachineSourceFacts } from "../machine/lower-state.js";
import {
  literalResolver,
  ordinalBoundResolver,
  placeMayEscapeRoot,
  placeUses,
  validFixedLoopFacts,
  valueDefinitions,
} from "../semantic/aggregate-place-proof.js";
import { reachableBlocks } from "../semantic/value-lifetimes.js";
import { ordinalBoundsForFunction } from "../machine/lower-bounds.js";
import type { SourceSpan } from "../project/types.js";
import type { MachineInstruction } from "../machine/machine-types.js";
import { validateByteWindowObservers } from "./size-observer-byte-windows.js";
import { validateByteComplementObservers } from "./size-observer-byte-complements.js";
import { validateResidualEffects } from "./size-observer-effects.js";
import type { ResidualEffectsResult } from "./size-observer-effects.js";
import type { StorageRange } from "../storage/storage-types.js";
import type {
  CanonicalPipeline,
  CanonicalReferenceOutcome,
  CheckedSourceInput,
} from "./size-selection.js";
import type { SharedStorageResult } from "./shared-storage.js";

/** Existing successful shared closure, not a provisional placement. */
type FinalSharedStorage = Extract<SharedStorageResult, { readonly kind: "complete" }>;

/** One actual selected representation, with symbolic authority and final physical output. */
export interface ClosedObserverCandidate {
  /** Original selected instructions and immutable source/proof associations. */
  readonly lowered: CanonicalPipeline["lowered"];
  /** Complete regenerated certificate, binding and final layout for those instructions. */
  readonly shared: FinalSharedStorage;
}

/** Final observer inputs never replace an unavailable reference with an empty layout. */
export interface FinalObserverInput {
  /** Original source after the common semantic/effect/route checks. */
  readonly checked: CheckedSourceInput;
  /** Real feasible reference or its exact typed resource rejection and partial facts. */
  readonly reference: Exclude<CanonicalReferenceOutcome, { readonly kind: "failure" }>;
  /** Actual complete candidate; no observer check may move its homes or repair it. */
  readonly candidate: ClosedObserverCandidate;
}

/** Whole-candidate observer closure, an unknown obligation, or an invalid internal handoff. */
export type ObserverValidation =
  | {
      /** Every obligation in the admitted source/representation class was discharged. */
      readonly kind: "complete";
      /** Exact input candidate, not a rebuilt or partially repaired alternative. */
      readonly candidate: ClosedObserverCandidate;
    }
  | {
      /** Unknown evidence rejects the tuple; inconsistent internal state is terminal. */
      readonly kind: "rejected" | "error";
      /** Specific unsupported observation or invalid producer/consumer association. */
      readonly reason: string;
      /** Original source needing the proof, when identifiable. */
      readonly source: SourceSpan | null;
      /** Actual affected object, when the failed check identifies one. */
      readonly objectId: string | null;
    };

/** Failure half shared by the independent certificate, source and footprint checks. */
type ObserverFailure = Exclude<ObserverValidation, { readonly kind: "complete" }>;

/** Keep a tuple rejection distinct from a malformed internal certificate or source packet. */
function observerFailure(
  kind: ObserverFailure["kind"],
  reason: string,
  source: SourceSpan | null = null,
  objectId: string | null = null,
): ObserverFailure {
  return Object.freeze({ kind, reason, source, objectId });
}

/** Check actual shared homes and layout against the same finite selected inventory. */
function finalStorageFailure(
  candidate: ClosedObserverCandidate,
  input: CheckedSourceInput,
): ObserverFailure | null {
  if (
    !validSharedStorageProvenance(
      candidate.lowered.program,
      candidate.lowered.binder,
      candidate.shared,
      input.profile,
    )
  )
    return observerFailure(
      "error",
      "Final output no longer belongs to the actual lowering/shared producers",
    );
  const { inventory, certificate, placement } = candidate.shared.certificate;
  const hash = storageInventoryHash(inventory);
  const physical = candidate.shared.machine.program;
  const final = candidate.shared.layout.program;
  if (
    !certificate.closed ||
    certificate.profileId !== input.profile.id ||
    inventory.program !== candidate.lowered.inventory.program ||
    certificate.inventoryHash !== hash ||
    candidate.lowered.program.storageInventoryHash !== hash ||
    physical.storageInventoryHash !== hash ||
    final.storageInventoryHash !== hash ||
    physical.storageSelection !== candidate.lowered.program.storageSelection ||
    final.storageSelection !== candidate.lowered.program.storageSelection ||
    JSON.stringify(placement.homes) !== JSON.stringify(certificate.homes) ||
    !validateMachineProgram(physical) ||
    !validateMachineProgram(final)
  )
    return observerFailure("error", "Final storage and machine certificates disagree");
  const requests = new Map(inventory.requests.map((request) => [request.id, request]));
  const homes = new Map(certificate.homes.map((home) => [home.requestId, home]));
  const profile = physical.storageProfile;
  if (
    profile === undefined ||
    requests.size !== inventory.requests.length ||
    homes.size !== requests.size ||
    homes.size !== certificate.homes.length
  )
    return observerFailure("error", "Final storage inventory is incomplete");
  for (const request of inventory.requests) {
    const home = homes.get(request.id);
    if (
      home === undefined ||
      home.bytes !== request.bytes ||
      !Number.isSafeInteger(home.bytes) ||
      home.bytes < 0 ||
      !validRange({ start: home.address, end: home.address }, 0xffff) ||
      home.address % request.alignment !== 0 ||
      (request.region === "ram" && home.region !== "ram") ||
      (request.region === "zero-page-required" && home.region !== "zero-page") ||
      (request.pageSafeIndirect === true && (home.address & 0xff) === 0xff) ||
      !(home.region === "ram" ? profile.ram : profile.zeroPage).some(
        (range) =>
          home.address >= range.start && home.address + Math.max(1, home.bytes) - 1 <= range.end,
      )
    )
      return observerFailure(
        "error",
        "Final home violates its certified demand",
        request.source,
        request.id,
      );
  }
  const expected = storageIntervals(certificate);
  const actual = candidate.shared.layout.intervals.filter(({ kind }) => kind === "sfa");
  const spans = (ranges: NonNullable<typeof expected>) =>
    ranges.map(({ id, kind, start, end, bytes }) => [id, kind, start, end, bytes]);
  if (expected === null || JSON.stringify(spans(expected)) !== JSON.stringify(spans(actual)))
    return observerFailure("error", "Final SFA intervals do not match their certificate");
  const peak = certificate.hardwareStackPeak;
  const capacity = input.profile.storage.hardwareStackCapacity;
  if (
    !Number.isSafeInteger(peak) ||
    peak < 0 ||
    peak !== certificate.hardwareStackProgramPeak + certificate.hardwareStackSystemPeak ||
    (capacity !== undefined && peak > capacity - (input.profile.storage.hardwareStackReserve ?? 0))
  )
    return observerFailure("error", "Final bounded stack demand is not certified");
  return null;
}

/** BASIC may become visible while restore code still fetches and reads the saved-state object. */
const BASIC_ROM_WINDOW: StorageRange = Object.freeze({ start: 0xa000, end: 0xbfff });

/**
 * Keep every actual startup block and saved byte visible across the restored CPU banking.
 * The current constructor needs no more permissive transition proof. Unknown topology or
 * missing final facts are never repaired here, and canonical reuse has no exemption.
 * @param shared Actual final shared-storage tuple, including placed startup code and state.
 * @returns A physical-visibility rejection, inconsistent-evidence error, or null when visible.
 * @example const failure = startupVisibilityFailure(shared);
 */
export function startupVisibilityFailure(shared: FinalSharedStorage): ObserverFailure | null {
  const layout = shared.layout;
  const overlapsBasic = (range: StorageRange) =>
    range.start <= BASIC_ROM_WINDOW.end && range.end >= BASIC_ROM_WINDOW.start;
  for (const block of layout.program.startup.blocks) {
    const terminator = block.terminator;
    const terminalBytes =
      terminator.kind === "fallthrough" || terminator.kind === "unreachable"
        ? 0
        : terminator.kind === "return"
          ? (terminator.cost?.bytes ?? 1)
          : terminator.cost.bytes;
    const bytes = block.instructions.reduce(
      (sum, instruction) => sum + instruction.cost.bytes,
      terminalBytes,
    );
    if (
      block.origin === undefined ||
      !validRange({ start: block.origin, end: block.origin }, 0xffff) ||
      !Number.isSafeInteger(bytes) ||
      bytes < 0
    )
      return observerFailure(
        "error",
        "Actual startup code extent is unavailable",
        null,
        block.label,
      );
    if (bytes === 0) continue;
    const range = { start: block.origin, end: block.origin + bytes - 1 };
    if (!validRange(range, 0xffff))
      return observerFailure("error", "Actual startup code extent is invalid", null, block.label);
    if (overlapsBasic(range))
      return observerFailure(
        "rejected",
        "Startup code may be hidden when BASIC banking is restored",
        null,
        block.label,
      );
  }
  const states = layout.intervals.filter(({ id }) => id === C64_STARTUP_STATE_ID);
  const object = layout.program.data.find(({ id }) => id === C64_STARTUP_STATE_ID);
  const state = states[0];
  if (
    states.length !== 1 ||
    state === undefined ||
    object === undefined ||
    !validRange(state, 0xffff) ||
    state.end - state.start + 1 !== object.bytes.length
  )
    return observerFailure(
      "error",
      "Actual startup saved-state extent is unavailable",
      null,
      C64_STARTUP_STATE_ID,
    );
  return overlapsBasic(state)
    ? observerFailure(
        "rejected",
        "Startup saved state may be hidden when BASIC banking is restored",
        null,
        state.id,
      )
    : null;
}

/** Source operations with no raw, firmware, numeric-address or status-stack observer. */
const TYPED_OBSERVER_OPERATIONS = new Set([
  "constant",
  "convert",
  "load",
  "store",
  "unary",
  "binary",
  "call",
  "aggregate",
  "merge",
  "array-count",
]);

/** Vector-only platform controls change interrupt entry, not ordinary object data. */
const VECTOR_PLATFORM_CAPABILITIES = new Set([
  "c64.system.restoreIRQ",
  "c64.system.restoreNMI",
  "c64.system.setIRQ",
  "c64.system.setIRQExclusive",
  "c64.system.setNMI",
  "c64.system.setNMIExclusive",
]);

/** Prove actual final homes still honor every explicit source placement. */
function placedSourceFailure(
  shared: FinalSharedStorage,
  input: CheckedSourceInput,
): ObserverFailure | null {
  const intervals = new Map(shared.layout.intervals.map((interval) => [interval.id, interval]));
  for (const global of input.program.semantic.globals) {
    if (global.placement?.at == null) continue;
    const interval = intervals.get(`global.${bindingIdentityKey(global.id)}`);
    if (interval === undefined || interval.start !== global.placement.at)
      return observerFailure(
        "error",
        "Final placed global does not match its source address",
        global.source,
        bindingIdentityKey(global.id),
      );
  }
  for (const fn of input.program.semantic.functions) {
    if (fn.placement?.at == null) continue;
    const selected = shared.layout.program.functions.filter(
      ({ sourceFunction }) =>
        sourceFunction !== undefined &&
        bindingIdentityKey(sourceFunction) === bindingIdentityKey(fn.id),
    );
    if (selected.length === 0 || selected.some(({ origin }) => origin !== fn.placement!.at))
      return observerFailure(
        "error",
        "Final placed function does not match its source address",
        fn.source,
        bindingIdentityKey(fn.id),
      );
  }
  return null;
}

/** Source CPU controls are non-observing only when no flag-sensitive proof owns the candidate. */
function cpuControlAdmitted(input: FinalObserverInput): boolean {
  return input.candidate.lowered.program.functions.every(
    (fn) =>
      (fn.byteAvailabilityProofs?.length ?? 0) === 0 &&
      (fn.byteComplementProofs?.length ?? 0) === 0 &&
      (fn.booleanCallProofs?.length ?? 0) === 0 &&
      (fn.fixedCounterProofs?.length ?? 0) === 0 &&
      (fn.fixedLoopProofs?.length ?? 0) === 0,
  );
}

/**
 * Prove source containment after the residual gate checks any admitted raw operations.
 * Platform, status, identity exposure and conditional machine windows are not
 * guessed away: they reject the tuple until their stronger proof is available.
 */
function typedSourceFailure(
  input: FinalObserverInput,
  effects: Extract<ResidualEffectsResult, { readonly kind: "complete" }>,
): ObserverFailure | null {
  const program = input.checked.program;
  const facts = input.candidate.lowered.program.storageSelection?.sourceFacts;
  if (facts === undefined)
    return observerFailure("rejected", "No complete original source observer packet");
  if (facts.program !== program)
    return observerFailure("error", "Observer facts belong to a different checked source");
  // Reuse the producer's source/recipe/lifetime checks rather than a second validator.
  validateMachineSourceFacts({
    program: input.candidate.lowered.inventory.program,
    logicalStorage: input.candidate.lowered.inventory,
    profile: input.checked.profile,
    sourceFacts: facts,
  });
  const packets = [...facts.functions];
  const objects = packets[0]?.[1].objects;
  if (objects === undefined)
    return observerFailure("rejected", "Original source footprints are unavailable");
  if (
    packets.some(([, packet]) =>
      [...packet.loops, ...packet.objects.rangeObservers].some(
        (loop) => !validFixedLoopFacts(loop),
      ),
    )
  )
    return observerFailure("error", "A source range premise is stale");
  if (objects.rangeObservers.some((loop) => !effects.loops.has(loop)))
    return observerFailure("rejected", "Conditional induction observers remain");
  /**
   * A callable root is admissible only when it is itself a selected interrupt
   * handler. Those handlers were closed by the asynchronous borrow proof, and
   * the raw/effects proofs validate their own accesses.
   */
  const asyncHandlers = new Set(
    [
      ...(program.interruptRoutes ?? []).map((route) => route.handler),
      ...program.roots.flatMap((root) => (root.kind === "interrupt" ? [root.function] : [])),
    ].map(bindingIdentityKey),
  );
  const aggregateProgram = (program.returnedLocalDestinations?.length ?? 0) > 0;
  if (
    program.roots.some(
      (root) => root.kind === "callable" && !asyncHandlers.has(bindingIdentityKey(root.function)),
    )
  )
    return observerFailure(
      "rejected",
      "Complete asynchronous or callable observer proof is unavailable",
    );
  const functions = new Set(program.reachableFunctions.map(bindingIdentityKey));
  const globals = new Set(program.semantic.globals.map(({ id }) => bindingIdentityKey(id)));
  const bodies = [
    ...program.semantic.functions.filter(({ id }) => functions.has(bindingIdentityKey(id))),
    ...program.semantic.globals,
  ];
  for (const body of bodies) {
    if (body.entry === null) continue;
    const definitions = valueDefinitions(body.blocks);
    const ordinary = ordinalBoundResolver(definitions, literalResolver(definitions));
    const bound = (value: string) => effects.bounds.get(body.id)?.get(value) ?? ordinary(value);
    const blocks = reachableBlocks(body.entry, body.blocks);
    // Keep the actual entry first, and keep guarded maxima local to each use.
    const guarded = ordinalBoundsForFunction(
      [
        blocks.find(({ id }) => id === body.entry)!,
        ...blocks.filter(({ id }) => id !== body.entry),
      ],
      { program: input.checked.program, profile: input.checked.profile },
      [],
    );
    for (const block of blocks) {
      for (const operation of block.operations) {
        if (
          (!TYPED_OBSERVER_OPERATIONS.has(operation.kind) &&
            !(
              aggregateProgram &&
              operation.kind === "platform" &&
              VECTOR_PLATFORM_CAPABILITIES.has(operation.capability)
            ) &&
            !(
              aggregateProgram &&
              operation.kind === "function-address" &&
              asyncHandlers.has(bindingIdentityKey(operation.function))
            ) &&
            !(
              operation.kind === "cpu-control" &&
              (operation.control === "asm_nop" ||
                (block.id === body.entry && cpuControlAdmitted(input)))
            ) &&
            !effects.operations.has(operation)) ||
          (operation.kind === "call" &&
            (globals.has(bindingIdentityKey(body.id)) ||
              !functions.has(bindingIdentityKey(operation.callee))))
        ) {
          return observerFailure(
            "rejected",
            "Source needs a stronger physical observer proof",
            operation.span,
          );
        }
        for (const use of placeUses(operation))
          if (
            placeMayEscapeRoot(
              use,
              (value) =>
                effects.originalCallGuards?.get(operation)?.get(value) ??
                guarded.get(operation)?.get(value) ??
                bound(value),
            )
          )
            return observerFailure(
              "rejected",
              "Typed access is not proved contained in its source object",
              operation.span,
            );
      }
    }
  }
  for (const fn of input.candidate.lowered.program.functions) {
    if (
      [fn.nativeStoreProofs, fn.fixedLoopProofs].some((proofs) => (proofs?.length ?? 0) > 0) ||
      fn.fixedCounterProofs?.some(
        (proof) =>
          !["low-byte", "x", "y"].includes(proof.representation) || !effects.loops.has(proof.loop),
      )
    )
      return observerFailure(
        "rejected",
        "Selected machine windows still have pending observers",
        fn.sourceFunction?.span ?? null,
      );
  }
  return (
    validateByteWindowObservers(input, effects) ?? validateByteComplementObservers(input, effects)
  );
}

/** Ordinary CPU-visible RAM under the unchanged cooperative startup mapping. */
function ordinaryRam(range: StorageRange): boolean {
  return (
    validRange(range, 0xffff) &&
    ((range.start >= 2 && range.end <= 0xff) || (range.start >= 0x200 && range.end <= 0xcfff))
  );
}

/** Check real final data and discarded/fetch accesses without treating annotations as a bus trace. */
function typedFootprintFailure(
  shared: FinalSharedStorage,
  input: CheckedSourceInput,
  covered: ReadonlySet<MachineInstruction>,
): ObserverFailure | null {
  const program = shared.layout.program;
  const labels = new Map<string, number>();
  const targets = new Set<number>();
  for (const fn of [program.startup, ...program.functions]) {
    const start = fn.origin ?? fn.blocks[0]?.origin;
    if (start === undefined)
      return observerFailure("error", "A final code origin is missing", null, fn.id);
    labels.set(fn.id, start);
    targets.add(start);
    for (const block of fn.blocks) {
      if (block.origin === undefined)
        return observerFailure("error", "A final block origin is missing", null, block.label);
      labels.set(block.label, block.origin);
      targets.add(block.origin);
    }
  }
  // Data labels come from actual intervals, never provisional homes or source-name guesses.
  const dataOrigins = new Map(shared.layout.intervals.map(({ id, start }) => [id, start]));
  for (const object of program.data) {
    const interval = dataOrigins.get(object.id);
    if (interval !== undefined) labels.set(object.id, interval);
  }
  const requests = new Map(
    shared.certificate.inventory.requests.map((request) => [request.id, request]),
  );
  const pointerHomes = new Set(
    shared.certificate.certificate.homes.flatMap((home) => {
      const request = requests.get(home.requestId);
      return home.region === "zero-page" &&
        home.bytes >= 2 &&
        (request?.storageClass === "pointer" ||
          (request?.storageClass === "parameter" &&
            (request.type?.kind === "array" || request.type?.kind === "struct")))
        ? [home.address]
        : [];
    }),
  );
  const dataRanges = shared.layout.intervals.filter(
    ({ kind, start }) =>
      start >= 0x200 &&
      (kind === "sfa" ||
        kind === "global" ||
        kind === "bss" ||
        kind === "immutable" ||
        kind === "asset"),
  );
  // Contained typed targets belong to these actual RAM objects. With unknown Y,
  // base = target - Y: retain the full preceding 255-byte envelope, not a guessed
  // base or just the effective addresses. This deliberately over-approximates.
  const bases = dataRanges.flatMap(({ start, end }) =>
    wrappedRange(start + 0x10000 - 0xff, end + 0x10000),
  );
  for (const fn of program.functions) {
    for (const block of fn.blocks) {
      let pc = block.origin!;
      for (const instruction of block.instructions) {
        if (covered.has(instruction)) {
          pc += instruction.cost.bytes;
          continue;
        }
        const control =
          (instruction.opcode === "jsr" || instruction.opcode === "jmp") &&
          instruction.mode === "absolute";
        const stack =
          ["pha", "php", "pla", "plp", "rts"].includes(instruction.opcode) &&
          instruction.mode === "implied";
        if (control || stack) {
          if (!wrappedRange(pc, pc + instruction.cost.bytes).every(ordinaryRam))
            return observerFailure(
              "rejected",
              "A control fetch has an unproved physical view",
              instruction.source,
            );
          if (control) {
            const target = operandAddress({ cpu: input.profile.cpu, instruction, pc, labels });
            if (target === null || !targets.has(target))
              return observerFailure(
                "rejected",
                "A selected control target is not a proved internal entry",
                instruction.source,
              );
          }
        } else {
          const indirect =
            instruction.mode === "indirect-indexed-y" || instruction.mode === "indexed-indirect-x";
          const pointer = operandAddress({ cpu: input.profile.cpu, instruction, pc, labels });
          if (indirect && (pointer === null || !pointerHomes.has(pointer)))
            return observerFailure(
              "rejected",
              "An indirect base lacks certified typed-pointer provenance",
              instruction.source,
            );
          const accesses = instructionAccessEnvelope({
            cpu: input.profile.cpu,
            instruction,
            pc,
            labels,
            ...(indirect
              ? { pointees: instruction.mode === "indirect-indexed-y" ? bases : dataRanges }
              : {}),
          });
          if (accesses === null || !accesses.every((access) => access.ranges.every(ordinaryRam)))
            return observerFailure(
              "rejected",
              "An actual data, pointer, dummy or fetch footprint is unproved",
              instruction.source,
            );
        }
        pc += instruction.cost.bytes;
      }
      const terminator = block.terminator;
      const bytes =
        terminator.kind === "unreachable" || terminator.kind === "fallthrough"
          ? 0
          : terminator.kind === "return"
            ? 1
            : terminator.cost.bytes;
      if (bytes > 0 && !wrappedRange(pc, pc + bytes).every(ordinaryRam))
        return observerFailure(
          "rejected",
          "A final terminator fetch has an unproved physical view",
        );
    }
  }
  return null;
}

/** Reference-side prechecks are invariant across every candidate in one build. */
const referencePrechecks = new WeakMap<
  FinalSharedStorage,
  { readonly checked: CheckedSourceInput; readonly failure: ObserverFailure | null }
>();

/** Run or reuse the invariant reference storage/visibility/placement prechecks. */
function referencePrecheck(
  reference: Extract<CanonicalReferenceOutcome, { readonly kind: "feasible" }>,
  checked: CheckedSourceInput,
): ObserverFailure | null {
  const shared = reference.shared;
  const cached = referencePrechecks.get(shared);
  if (cached !== undefined && cached.checked === checked) return cached.failure;
  const failure =
    finalStorageFailure(
      { lowered: reference.checked.lowered, shared: reference.shared },
      checked,
    ) ??
    startupVisibilityFailure(reference.shared) ??
    placedSourceFailure(reference.shared, checked);
  referencePrechecks.set(shared, Object.freeze({ checked, failure }));
  return failure;
}

/**
 * Close observers atomically after actual shared placement; never allocate or repair a tuple.
 * Initial classes cover contained typed storage and independently checked fixed-RAM
 * raw sequences. Only the typed source non-observation proof can cover unavailable
 * original homes; selected/provisional addresses never substitute for them. Device,
 * status, asynchronous and pending-window classes still require stronger proofs.
 * Exact canonical reuse remains eligible only when its producer
 * association and actual startup-return visibility checks also close.
 *
 * @param input Checked original source, its real reference outcome and final selected output.
 * @returns The exact accepted candidate, a whole-tuple rejection, or a terminal invariant error.
 * @example
 * const result = validateSizeObservers({ checked, reference, candidate });
 */
export function validateSizeObservers(input: FinalObserverInput): ObserverValidation {
  try {
    const failure = finalStorageFailure(input.candidate, input.checked);
    if (failure !== null) return failure;
    const visibility = startupVisibilityFailure(input.candidate.shared);
    if (visibility !== null) return visibility;
    const reference = input.reference;
    const placed = placedSourceFailure(input.candidate.shared, input.checked);
    if (placed !== null) return placed;
    if (reference.kind === "feasible") {
      if (
        reference.checked.snapshot !== input.checked.snapshot ||
        reference.checked.program.semantic.functions !== input.checked.program.semantic.functions
      )
        return observerFailure("error", "Reference and candidate do not share the checked source");
      const before = { lowered: reference.checked.lowered, shared: reference.shared };
      const referenceFailure = referencePrecheck(reference, input.checked);
      if (referenceFailure !== null) return referenceFailure;
      if (input.candidate.lowered === before.lowered && input.candidate.shared === before.shared)
        return Object.freeze({ kind: "complete", candidate: input.candidate });
    } else if (
      reference.facts.inventory !== undefined &&
      reference.facts.inventory.program.semantic.functions !==
        input.checked.program.semantic.functions
    )
      return observerFailure("error", "Rejected reference facts belong to a different source");
    const effects = validateResidualEffects(input);
    if (effects.kind !== "complete") return effects;
    const source = typedSourceFailure(input, effects);
    if (source !== null) return source;
    const after = typedFootprintFailure(
      input.candidate.shared,
      input.checked,
      effects.instructions,
    );
    if (after !== null) return after;
    if (reference.kind === "feasible") {
      const before = typedFootprintFailure(reference.shared, input.checked, effects.instructions);
      if (before !== null) return before;
    }
    return Object.freeze({ kind: "complete", candidate: input.candidate });
  } catch {
    return observerFailure("error", "Final observer inputs violate an internal invariant");
  }
}

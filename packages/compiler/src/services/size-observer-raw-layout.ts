import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type {
  MachineInstruction,
  MachineProgram,
  MachineObserverOrigin,
} from "../machine/machine-types.js";
import { instructionAccessEnvelope, wrappedRange } from "../machine/nmos6510-access.js";
import { valueDefinitions } from "../semantic/aggregate-place-proof.js";
import { modeForValue, operandForValue } from "../machine/lower-control.js";
import type { SemanticOperation } from "../semantic/operations.js";
import type { SourceSpan } from "../project/types.js";
import type { StorageRange, StorageHome } from "../storage/storage-types.js";
import type { FinalObserverInput } from "./size-observers.js";
import type { FixedLoopFacts } from "../semantic/fixed-loop-facts.js";
import type { SemanticBlock } from "../semantic/operations.js";
import type { LowByteComposition } from "./size-observer-low-byte-composition.js";

/** Ordinary raw access; the original operation is the order/width authority. */
export type RawOperation = Extract<
  SemanticOperation,
  { readonly kind: "memory-read" | "memory-write" }
>;

/** Exact source node, block and complete base-address envelope for one ordinary-RAM access. */
export interface RawSite {
  /** Exact operation whose source order and width remain binding. */
  readonly operation: RawOperation;
  /** Original function or executable initializer, not its generated label. */
  readonly owner: BindingId;
  /** Source-proved 16-bit base addresses, before adding the effective-byte ordinal. */
  readonly ranges: readonly StorageRange[];
  /** Exact source block; final layout order is not source execution order. */
  readonly block: SemanticBlock;
}

/** Internal residual check, not an atomic whole-program acceptance decision. */
export type ResidualEffectsResult =
  | {
      /** Only the listed raw obligations have closed; all other observer gates remain mandatory. */
      readonly kind: "complete";
      /** Exact original source operations whose bounded ordinary-RAM accesses were checked. */
      readonly operations: ReadonlySet<SemanticOperation>;
      /** Actual final instruction objects checked in both available layouts. */
      readonly instructions: ReadonlySet<MachineInstruction>;
      /** Actual source premises discharged for this tuple, including raw-free loops. */
      readonly loops: ReadonlySet<FixedLoopFacts>;
      /** Use-site value maxima whose source induction and physical premises have both closed. */
      readonly bounds: ReadonlyMap<BindingId, ReadonlyMap<string, bigint>>;
      /** Original use-site hypotheses; remaining atomic typed/state/physical gates must still pass. */
      readonly originalCallGuards?: ReadonlyMap<SemanticOperation, ReadonlyMap<string, bigint>>;
      /** Exact composed counter changes; field consumers still close independently. */
      readonly lowByteComposition?: LowByteComposition;
    }
  | {
      /** Unsupported proof rejects the tuple; an inconsistent producer association is terminal. */
      readonly kind: "rejected" | "error";
      /** Source-associated unsupported obligation or internal inconsistency. */
      readonly reason: string;
      /** Original source location when the affected operation is known. */
      readonly source: SourceSpan | null;
      /** Affected object when identified independently of generated names. */
      readonly objectId: string | null;
    };

/** Unsupported or inconsistent residual evidence; never an alternative acceptance token. */
export type ResidualFailure = Exclude<ResidualEffectsResult, { readonly kind: "complete" }>;

/** Keep unknown capability distinct from a producer promising an invalid association. */
export function failure(
  kind: "rejected" | "error",
  reason: string,
  source: SourceSpan | null = null,
  objectId: string | null = null,
): ResidualFailure {
  return Object.freeze({ kind, reason, source, objectId });
}

/** Possible incidental accesses must remain in ordinary CPU-visible RAM. */
function ordinaryRam(range: StorageRange): boolean {
  return (range.start >= 2 && range.end <= 0xff) || (range.start >= 0x200 && range.end <= 0xcfff);
}

/** The first raw class excludes ports, page one, firmware vectors and every device window. */
export function admittedRawRam(range: StorageRange): boolean {
  return range.start >= 0x0400 && range.end <= 0xcfff;
}

/** Source widths wrap independently, even when the resulting class must be rejected. */
export function byteRanges(site: RawSite, byte: number): readonly StorageRange[] {
  return site.ranges.flatMap(({ start, end }) => wrappedRange(start + byte, end + byte));
}

/** Index physical coverage once; raw bytes and setup ranges then use logarithmic queries. */
function coverage(ranges: readonly StorageRange[]) {
  const merged: StorageRange[] = [];
  for (const range of [...ranges].sort((left, right) => left.start - right.start)) {
    const previous = merged.at(-1);
    if (previous !== undefined && range.start <= previous.end + 1)
      merged[merged.length - 1] = { start: previous.start, end: Math.max(previous.end, range.end) };
    else merged.push({ start: range.start, end: range.end });
  }
  const at = (address: number) => {
    let low = 0,
      high = merged.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (merged[middle]!.start <= address) low = middle + 1;
      else high = middle;
    }
    return merged[low - 1];
  };
  return {
    contains: (range: StorageRange) => (at(range.start)?.end ?? -1) >= range.end,
    intersects: (range: StorageRange) => (at(range.end)?.end ?? -1) >= range.start,
  };
}

/** Check the exact producer-owned input loads, pointer writes and Y progression before decoding. */
function rawPointer(
  sequence: readonly MachineInstruction[],
  origin: MachineObserverOrigin,
  homes: ReadonlyMap<string, StorageHome>,
): number | ResidualFailure {
  const input = origin.addressInput;
  if (input === undefined)
    return failure(
      "rejected",
      "Raw address input has no retained representation",
      origin.operation.span,
    );
  if (input.kind !== "storage")
    return failure(
      "rejected",
      "Raw address input representation is not supported",
      origin.operation.span,
    );
  const pointer = sequence[1]?.operand;
  const high = sequence[3]?.operand;
  const load = (index: number, byte: number) => {
    const instruction = sequence[index];
    return (
      instruction?.opcode === "lda" &&
      instruction.mode === modeForValue(input, byte) &&
      JSON.stringify(instruction.operand) === JSON.stringify(operandForValue(input, byte))
    );
  };
  if (
    !load(0, 0) ||
    !load(2, 1) ||
    sequence[1]?.opcode !== "sta" ||
    sequence[3]?.opcode !== "sta" ||
    pointer?.kind !== "storage" ||
    high?.kind !== "storage" ||
    pointer.requestId !== high.requestId ||
    (pointer.offset ?? 0) !== 0 ||
    high.offset !== 1
  )
    return failure(
      "error",
      "Raw pointer setup does not match its evaluated source input",
      origin.operation.span,
    );
  const home = homes.get(pointer.requestId);
  if (
    home === undefined ||
    home.region !== "zero-page" ||
    home.bytes !== 2 ||
    home.address < 2 ||
    home.address > 0xfe
  )
    return failure(
      "error",
      "Raw pointer is not a certified ordinary two-byte pair",
      origin.operation.span,
    );
  let y: number | null = null;
  for (const instruction of sequence.slice(4)) {
    if (instruction.defines.registers.includes("y"))
      y =
        instruction.opcode === "ldy" && instruction.operand?.kind === "immediate"
          ? instruction.operand.value
          : instruction.opcode === "iny" && y !== null
            ? (y + 1) & 0xff
            : null;
    const record = instruction.observerOrigins?.find(
      (entry) => entry.operation === origin.operation,
    );
    if (record?.byte !== null && record?.byte !== undefined) {
      if (
        y !== record.byte ||
        instruction.mode !== "indirect-indexed-y" ||
        instruction.operand?.kind !== "indirect-y" ||
        instruction.operand.requestId !== pointer.requestId ||
        (instruction.operand.offset ?? 0) !== 0
      )
        return failure(
          "error",
          "Raw indirect byte does not use its established pointer and Y",
          origin.operation.span,
        );
    } else if (
      instruction.opcode === "sta" &&
      instruction.operand?.kind === "storage" &&
      instruction.operand.requestId === pointer.requestId
    )
      return failure(
        "error",
        "Raw pointer is overwritten before its final byte",
        origin.operation.span,
      );
  }
  if (origin.operation.kind === "memory-read" && origin.operation.width === 2) {
    const low = sequence[6]?.operand;
    const restored = sequence[10];
    const buffer = low?.kind === "storage" ? homes.get(low.requestId) : undefined;
    if (
      sequence.length !== 11 ||
      sequence[6]?.opcode !== "sta" ||
      sequence[9]?.opcode !== "tax" ||
      restored?.opcode !== "lda" ||
      JSON.stringify(restored.operand) !== JSON.stringify(low) ||
      buffer === undefined ||
      buffer.region !== "ram"
    )
      return failure(
        "error",
        "Raw word buffering does not preserve its first byte",
        origin.operation.span,
      );
  }
  return home.address;
}

/** Check the proved byte-index load and its native `absolute,X` access before decoding. */
function rawIndexed(
  sequence: readonly MachineInstruction[],
  origin: MachineObserverOrigin,
  homes: ReadonlyMap<string, StorageHome>,
  heldCounter = false,
): number | ResidualFailure {
  const span = origin.operation.span;
  const input = origin.addressInput;
  if (input === undefined)
    return failure("rejected", "Raw indexed read has no retained index representation", span);
  const index = input.kind === "zero-extended" ? input.low : input;
  /**
   * A loop counter proved live in X already holds the exact index. Its read
   * supplies no separate load instruction, so the sequence is only the access.
   */
  if (heldCounter) {
    const held = sequence[0];
    if (
      sequence.length !== 1 ||
      held?.opcode !== "lda" ||
      held.mode !== "absolute-x" ||
      held.operand?.kind !== "absolute" ||
      index.kind !== "register" ||
      index.registers !== "x"
    )
      return failure("error", "Held-counter raw read is not one native absolute-X access", span);
    return held.operand.value;
  }
  const load = sequence[0];
  const access = sequence[1];
  if (sequence.length !== 2)
    return failure(
      "error",
      "Raw indexed read is not one index load and one absolute-X access",
      span,
    );
  if (
    access?.opcode !== "lda" ||
    access.mode !== "absolute-x" ||
    access.operand?.kind !== "absolute"
  )
    return failure("error", "Raw indexed read does not end in one native indexed load", span);
  if (
    load?.opcode !== "ldx" ||
    load.mode !== modeForValue(index, 0) ||
    JSON.stringify(load.operand) !== JSON.stringify(operandForValue(index, 0))
  )
    return failure("error", "Raw indexed read does not load its proved source index", span);
  if (index.kind === "storage") {
    const home = homes.get(index.requestId);
    if (
      (index.offset ?? 0) !== 0 ||
      home === undefined ||
      home.bytes < 1 ||
      !ordinaryRam({ start: home.address, end: home.address })
    )
      return failure("error", "Raw indexed read index is not a certified ordinary byte home", span);
  } else if (index.kind !== "constant") {
    return failure("rejected", "Raw indexed read index is not a retained byte value", span);
  }
  return access.operand.value;
}

/** A complete final layout and its exact code/data symbol origins. */
function layoutLabels(
  program: MachineProgram,
  intervals: readonly (StorageRange & { readonly id: string })[],
): ReadonlyMap<string, number> {
  const labels = new Map(intervals.map(({ id, start }) => [id, start]));
  for (const fn of [program.startup, ...program.functions]) {
    const start = fn.origin ?? fn.blocks[0]?.origin;
    if (start !== undefined) labels.set(fn.id, start);
    for (const block of fn.blocks)
      if (block.origin !== undefined) labels.set(block.label, block.origin);
  }
  return labels;
}

/**
 * Validate one actual final raw sequence, never treating memory annotations as a bus oracle.
 * Setup may touch certified program data only. Effective accesses must match the source byte,
 * and pointer/dummy/fetch traffic must be harmless ordinary RAM. Indirect accesses need
 * the matched producer template. Loop induction must close in the residual owner;
 * MMIO, calls and asynchronous entries remain unsupported here.
 * @param input Original checked source and actual candidate/reference authority.
 * @param shared Real final layout being checked, never a provisional placement.
 * @param symbolic Actual unbound machine output which owns each pointer template.
 * @param sites Source-associated raw operations with complete conditional address envelopes.
 * @param covered Receives only actual instruction identities whose complete footprints close.
 * @returns Unsupported or inconsistent evidence, or null when these raw obligations close.
 */
export function checkLayout(
  input: FinalObserverInput,
  shared: FinalObserverInput["candidate"]["shared"],
  symbolic: MachineProgram,
  sites: readonly RawSite[],
  covered: Set<MachineInstruction>,
): ResidualFailure | null {
  const program = shared.layout.program;
  const labels = layoutLabels(program, shared.layout.intervals);
  const owners = new Map(sites.map((site) => [site.operation, site]));
  const expected = new Map<
    SemanticBlock,
    { readonly operation: RawOperation; readonly byte: number }[]
  >();
  const actual = new Map<
    SemanticBlock,
    { readonly operation: RawOperation; readonly byte: number }[]
  >();
  const positions = new Map<RawOperation, number[]>();
  const lengths = new Map<RawOperation, number>();
  const templates = new Map<SemanticOperation, MachineInstruction[]>();
  /**
   * A raw indexed read may consume a fixed loop counter already proved in X.
   * That proof is the symbolic function's own counter certificate: the read is
   * in the proved loop body and its address uses that counter's source load.
   */
  const heldIndexes = new Map<RawOperation, boolean>();
  const heldIndex = (site: RawSite): boolean => {
    const cached = heldIndexes.get(site.operation);
    if (cached !== undefined) return cached;
    let result = false;
    const owner = input.checked.program.semantic.functions.find(
      (fn) => bindingIdentityKey(fn.id) === bindingIdentityKey(site.owner),
    );
    const machine = symbolic.functions.find(
      (fn) =>
        fn.sourceFunction !== undefined &&
        bindingIdentityKey(fn.sourceFunction) === bindingIdentityKey(site.owner),
    );
    const proof = machine?.fixedCounterProofs?.find(
      (counter) => counter.representation === "x" && counter.loop.members.has(site.block.id),
    );
    if (owner !== undefined && proof !== undefined) {
      const definitions = valueDefinitions(owner.blocks);
      const address = definitions.get(site.operation.address);
      if (address?.kind === "binary" && address.operator === "+") {
        const load = [address.left, address.right]
          .map((value) => definitions.get(value))
          .find(
            (value) =>
              value?.kind === "load" &&
              bindingIdentityKey(value.place.root) === bindingIdentityKey(proof.loop.counter),
          );
        result = load?.kind === "load" && proof.reads.some((read) => read.value === load.result);
      }
    }
    heldIndexes.set(site.operation, result);
    return result;
  };
  for (const fn of symbolic.functions)
    for (const block of fn.blocks)
      for (const instruction of block.instructions)
        for (const origin of instruction.observerOrigins ?? [])
          if (origin.kind === "raw") {
            const sequence = templates.get(origin.operation) ?? [];
            sequence[origin.position] = instruction;
            templates.set(origin.operation, sequence);
          }
  const homes = new Map(shared.certificate.certificate.homes.map((home) => [home.requestId, home]));
  const pointers = new Map<RawOperation, number>();
  const indexedBases = new Map<RawOperation, number>();
  const data = shared.layout.intervals.filter(
    ({ kind }) =>
      kind === "sfa" ||
      kind === "global" ||
      kind === "bss" ||
      kind === "immutable" ||
      kind === "asset",
  );
  const owned = coverage(shared.layout.intervals);
  const ownedData = coverage(data);
  for (const site of sites) {
    const key = site.block;
    const entries = expected.get(key) ?? [];
    for (let byte = 0; byte < site.operation.width; byte += 1)
      entries.push({ operation: site.operation, byte });
    expected.set(key, entries);
    for (let byte = 0; byte < site.operation.width; byte += 1) {
      const range = byteRanges(site, byte).find((range) => owned.intersects(range));
      if (range !== undefined)
        return failure(
          "rejected",
          "Raw observation overlaps an actual original or selected object",
          site.operation.span,
          shared.layout.intervals.find(({ start, end }) => range.start <= end && range.end >= start)
            ?.id ?? null,
        );
    }
  }
  for (const fn of program.functions)
    for (const block of fn.blocks) {
      if (block.origin === undefined)
        return failure("error", "Final raw access block has no physical origin");
      let pc = block.origin;
      for (const instruction of block.instructions) {
        const records = (instruction.observerOrigins ?? []).filter(
          (origin) => origin.kind === "raw",
        );
        const unique = new Map<SemanticOperation, MachineObserverOrigin>();
        for (const origin of records) {
          const previous = unique.get(origin.operation);
          if (previous !== undefined) {
            if (
              previous.position !== origin.position ||
              previous.length !== origin.length ||
              previous.byte !== origin.byte ||
              previous.recipe !== origin.recipe
            )
              return failure(
                "error",
                "One raw instruction has conflicting source associations",
                origin.operation.span,
              );
            continue;
          }
          unique.set(origin.operation, origin);
          if (origin.operation.kind !== "memory-read" && origin.operation.kind !== "memory-write")
            return failure(
              "error",
              "Raw access association names a non-memory operation",
              origin.operation.span,
            );
          const site = owners.get(origin.operation);
          if (
            site === undefined ||
            fn.sourceFunction === undefined ||
            bindingIdentityKey(fn.sourceFunction) !== bindingIdentityKey(site.owner)
          )
            return failure(
              "error",
              "Raw access association belongs to a different source body",
              origin.operation.span,
            );
          const sourceLabels = fn.observerBlocks?.find(([source]) => source === site.block)?.[1];
          if (sourceLabels === undefined || !sourceLabels.includes(block.label)) {
            if (process.env.BLEND65_DEBUG_RAWASSOC === "1")
              process.stderr.write(
                `RAWASSOC site=${site.block.id} sameId=${fn.observerBlocks?.find(([source]) => source.id === site.block.id) !== undefined} sameObj=${fn.observerBlocks?.find(([source]) => source.id === site.block.id)?.[0] === site.block} labels=${JSON.stringify(fn.observerBlocks?.find(([source]) => source.id === site.block.id)?.[1])} block=${block.label}\n`,
              );
            return failure(
              "rejected",
              "Raw byte lacks its actual source-block association",
              origin.operation.span,
            );
          }
          if (
            origin.recipe === "raw-fixed" &&
            (site.ranges.length !== 1 || site.ranges[0]!.start !== site.ranges[0]!.end)
          )
            return failure(
              "rejected",
              "Fixed raw encoding needs an exact source address",
              origin.operation.span,
            );
          if (origin.recipe === "raw-indexed") {
            if (!indexedBases.has(site.operation)) {
              if (
                fn.executionContext?.domain !== "main" ||
                fn.executionContext.activationRoot !== undefined
              )
                return failure(
                  "rejected",
                  "Raw indexed read requires an unambiguous main construction",
                  origin.operation.span,
                );
              const base = rawIndexed(
                templates.get(site.operation) ?? [],
                origin,
                homes,
                heldIndex(site),
              );
              if (typeof base !== "number") return base;
              if (site.ranges.length !== 1 || site.ranges[0]!.start !== base)
                return failure(
                  "rejected",
                  "Raw indexed read needs one nonwrapping source envelope",
                  origin.operation.span,
                );
              indexedBases.set(site.operation, base);
            }
          } else if (origin.recipe === "raw-indirect") {
            if (!pointers.has(site.operation)) {
              if (
                fn.executionContext?.domain !== "main" ||
                fn.executionContext.activationRoot !== undefined
              )
                return failure(
                  "rejected",
                  "Raw address input requires an unambiguous main construction",
                  origin.operation.span,
                );
              const pointer = rawPointer(templates.get(site.operation) ?? [], origin, homes);
              if (typeof pointer !== "number") return pointer;
              pointers.set(site.operation, pointer);
            }
          } else if (origin.recipe !== "raw-fixed")
            return failure(
              "error",
              "Raw association has an invalid addressing recipe",
              origin.operation.span,
            );
          if (
            !Number.isSafeInteger(origin.position) ||
            !Number.isSafeInteger(origin.length) ||
            origin.position < 0 ||
            origin.length <= origin.position ||
            (lengths.has(site.operation) && lengths.get(site.operation) !== origin.length)
          )
            return failure(
              "error",
              "Raw sequence association is inconsistent",
              site.operation.span,
            );
          lengths.set(site.operation, origin.length);
          const sequence = positions.get(site.operation) ?? [];
          sequence.push(origin.position);
          positions.set(site.operation, sequence);
          const indexedBase =
            origin.recipe === "raw-indexed" ? indexedBases.get(site.operation) : undefined;
          const indexRange =
            origin.byte === null
              ? undefined
              : indexedBase !== undefined
                ? { start: 0, end: site.ranges.at(-1)!.end - indexedBase }
                : origin.recipe === "raw-indirect"
                  ? { start: origin.byte, end: origin.byte }
                  : undefined;
          const accesses = instructionAccessEnvelope({
            cpu: input.checked.profile.cpu,
            instruction,
            pc,
            labels,
            ...(origin.recipe === "raw-indirect" && origin.byte !== null
              ? { pointees: site.ranges }
              : {}),
            ...(indexRange === undefined ? {} : { index: indexRange }),
          });
          if (accesses === null)
            return failure(
              "rejected",
              "Raw sequence contains an unsupported CPU footprint",
              site.operation.span,
            );
          if (
            !accesses
              .filter(({ role }) => role !== "data")
              .every((access) => access.ranges.every(ordinaryRam))
          )
            return failure(
              "rejected",
              "Raw sequence has an unproved pointer, dummy or fetch observation",
              site.operation.span,
            );
          const effective = accesses.filter(({ role }) => role === "data");
          if (origin.byte === null) {
            if (
              !effective.every((access) =>
                access.ranges.every((range) => ordinaryRam(range) && ownedData.contains(range)),
              )
            )
              return failure(
                "rejected",
                "Raw setup touches bytes outside its owned data",
                site.operation.span,
              );
          } else {
            const byte = origin.byte;
            if (
              !Number.isSafeInteger(byte) ||
              byte < 0 ||
              byte >= site.operation.width ||
              effective.length !== 1
            )
              return failure(
                "error",
                "Raw effective-byte association is inconsistent",
                site.operation.span,
              );
            const ranges = byteRanges(site, byte);
            const access = effective[0]!;
            if (
              access.kind !== (site.operation.kind === "memory-read" ? "read" : "write") ||
              JSON.stringify(access.ranges) !== JSON.stringify(ranges) ||
              (origin.recipe === "raw-indirect" &&
                (instruction.operand?.kind !== "absolute" ||
                  instruction.operand.value !== pointers.get(site.operation))) ||
              (origin.recipe === "raw-indexed" &&
                (instruction.mode !== "absolute-x" ||
                  instruction.operand?.kind !== "absolute" ||
                  instruction.operand.value !== indexedBases.get(site.operation)))
            )
              return failure(
                "error",
                "Actual raw instruction does not perform its associated source byte",
                site.operation.span,
              );
            const key = site.block;
            const order = actual.get(key) ?? [];
            order.push({ operation: site.operation, byte });
            actual.set(key, order);
          }
          covered.add(instruction);
        }
        pc += instruction.cost.bytes;
      }
    }
  for (const site of sites) {
    const sequence = positions.get(site.operation);
    if (sequence === undefined)
      return failure(
        "rejected",
        "Raw source operation has no complete emitted association",
        site.operation.span,
      );
    if (
      sequence.length !== lengths.get(site.operation) ||
      sequence.some((position, index) => position !== index)
    )
      return failure(
        "error",
        "Raw producer sequence is missing, duplicated or reordered",
        site.operation.span,
      );
  }
  for (const [key, order] of expected) {
    const emitted = actual.get(key) ?? [];
    if (
      emitted.length !== order.length ||
      order.some(
        (entry, index) =>
          emitted[index]?.operation !== entry.operation || emitted[index]?.byte !== entry.byte,
      )
    )
      return failure("error", "Raw source byte count or order changed");
  }
  return null;
}

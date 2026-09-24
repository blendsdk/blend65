import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import type { SemanticOperation, SemanticPlace } from "../semantic/operations.js";
import { lowerAggregateAddress } from "./lower-aggregate.js";
import { lowerDirectionalCopyLoops } from "./lower-aggregate-direction.js";
import {
  machineCost,
  machineInstruction,
  machineState,
  type LoweredValue,
} from "./lower-control.js";
import type { MachineBlock, MachineInstruction, MachineOperand } from "./machine-types.js";
import {
  appendLoadA,
  loweredPlace,
  loweringFailure,
  requestStorage,
  storeA,
  type FunctionLoweringState,
} from "./lower.js";

/** Direct packed object or a retained zero-page pointer to its first byte. */
export interface PackedHome {
  /** Address setup which must run before this home is read or written. */
  readonly instructions: readonly MachineInstruction[];
  /** Direct bytes or an indirect pointer pair. */
  readonly value: LoweredValue;
  /** Whether the value names a pointer rather than the object bytes. */
  readonly indirect: boolean;
}

/** All destinations and SFA scratch chosen before emitting one complete copy. */
interface PreparedCopy {
  readonly bytes: number;
  readonly from: PackedHome;
  readonly to: PackedHome;
  readonly middle: PackedHome | null;
  readonly setup: readonly MachineInstruction[];
  readonly restoreSource: boolean;
  readonly directional: boolean;
}

/** Keep fixed roots direct; computed elements and parameters need a zero-page address pair. */
function packedHome(
  place: SemanticPlace,
  bytes: number,
  role: string,
  state: FunctionLoweringState,
  source: SourceSpan,
): PackedHome {
  if (place.path.length === 0) {
    const direct = loweredPlace(place, bytes, false, state);
    if (direct.kind !== "storage" || !direct.requestId.includes(":parameter:")) {
      return Object.freeze({ instructions: Object.freeze([]), value: direct, indirect: false });
    }
  }
  const address = lowerAggregateAddress(place, state, source, role);
  return Object.freeze({
    instructions: address.instructions,
    value: address.pointer,
    indirect: true,
  });
}

/** Advance an indirect packed home after its current 256-byte page has been consumed. */
function advancePage(
  instructions: MachineInstruction[],
  home: PackedHome,
  state: FunctionLoweringState,
  source: SourceSpan,
): void {
  if (!home.indirect) return;
  if (home.value.kind !== "storage") throw loweringFailure("Packed pointer has no home", source);
  instructions.push(
    machineInstruction(
      state.input.profile.cpu,
      "inc",
      "storage",
      Object.freeze({ kind: "storage", requestId: home.value.requestId, offset: 1 }),
      [],
      source,
    ),
  );
}

/** Load one packed byte without confusing an object's address with its contents. */
function appendRead(
  instructions: MachineInstruction[],
  home: PackedHome,
  offset: number,
  state: FunctionLoweringState,
  source: SourceSpan,
): void {
  if (!home.indirect) {
    appendLoadA(instructions, home.value, offset, state, source);
    return;
  }
  if (home.value.kind !== "storage") throw loweringFailure("Packed pointer has no home", source);
  instructions.push(
    machineInstruction(
      state.input.profile.cpu,
      "ldy",
      "immediate",
      Object.freeze({ kind: "immediate", value: offset & 0xff }),
      [],
      source,
    ),
    machineInstruction(
      state.input.profile.cpu,
      "lda",
      "indirect-indexed-y",
      Object.freeze({ kind: "indirect-y", requestId: home.value.requestId, offset: 0 }),
      [],
      source,
    ),
  );
}

/** Write one packed byte after the source byte is already in A. */
function appendWrite(
  instructions: MachineInstruction[],
  home: PackedHome,
  offset: number,
  state: FunctionLoweringState,
  source: SourceSpan,
): void {
  if (!home.indirect) {
    instructions.push(storeA(home.value, offset, state, source));
    return;
  }
  if (home.value.kind !== "storage") throw loweringFailure("Packed pointer has no home", source);
  instructions.push(
    machineInstruction(
      state.input.profile.cpu,
      "ldy",
      "immediate",
      Object.freeze({ kind: "immediate", value: offset & 0xff }),
      [],
      source,
    ),
    machineInstruction(
      state.input.profile.cpu,
      "sta",
      "indirect-indexed-y",
      Object.freeze({ kind: "indirect-y", requestId: home.value.requestId, offset: 0 }),
      [],
      source,
    ),
  );
}

/** Choose direct homes and one certified snapshot only when aliasing is possible. */
function prepareCopy(
  operation: Extract<SemanticOperation, { readonly kind: "store" }>,
  source: SemanticPlace,
  state: FunctionLoweringState,
  reuseRetainedPointer = false,
  allowDirectional = false,
): PreparedCopy | null {
  const target = operation.place;
  if (
    source === target ||
    (source.path.length === 0 &&
      target.path.length === 0 &&
      bindingIdentityKey(source.root) === bindingIdentityKey(target.root))
  ) {
    return null;
  }
  const type = operation.type;
  if (type.kind !== "array" && type.kind !== "struct") {
    throw loweringFailure("Packed copy has no complete aggregate type", operation.span);
  }
  const bytes = type.size;
  if (bytes === 0) return null;
  const retained = state.values.get(operation.value);
  const directSource = source.path.length === 0 ? loweredPlace(source, bytes, false, state) : null;
  const requiresPointer =
    source.path.length > 0 ||
    (directSource?.kind === "storage" && directSource.requestId.includes(":parameter:"));
  // Restoring the borrowed pointer costs one DEC per extra page. Beyond three
  // pages, reloading a separate pointer is cheaper in cycles.
  const restoreSource =
    reuseRetainedPointer &&
    Math.ceil(bytes / 256) <= 3 &&
    requiresPointer &&
    retained?.kind === "storage" &&
    retained.requestId.endsWith(`:aggregate-address:${operation.value}`);
  let from: PackedHome = restoreSource
    ? Object.freeze({ instructions: Object.freeze([]), value: retained, indirect: true })
    : packedHome(source, bytes, `copy-source:${operation.value}`, state, operation.span);
  let to = packedHome(target, bytes, `copy-target:${operation.value}`, state, operation.span);
  const sourceKey = bindingIdentityKey(source.root);
  const targetKey = bindingIdentityKey(target.root);
  const sourceMayAlias = from.indirect;
  const targetMayAlias = to.indirect;
  const needsSnapshot = sourceKey === targetKey || sourceMayAlias || targetMayAlias;
  // A direct global may overlap a borrowed destination. Give both homes an
  // address so the same memmove loop handles every large overlapping copy.
  if (allowDirectional && needsSnapshot) {
    if (!from.indirect) {
      const address = lowerAggregateAddress(
        source,
        state,
        operation.span,
        `copy-source:${operation.value}`,
      );
      from = Object.freeze({
        instructions: address.instructions,
        value: address.pointer,
        indirect: true,
      });
    }
    if (!to.indirect) {
      const address = lowerAggregateAddress(
        target,
        state,
        operation.span,
        `copy-target:${operation.value}`,
      );
      to = Object.freeze({
        instructions: address.instructions,
        value: address.pointer,
        indirect: true,
      });
    }
  }
  const directional = allowDirectional && needsSnapshot;
  const snapshot =
    needsSnapshot && !directional
      ? requestStorage(
          state,
          `aggregate-snapshot:${operation.value}`,
          "temporary",
          bytes,
          "ram",
          operation.span,
          "Preserve an overlapping aggregate source",
          type,
        )
      : null;
  const middle: PackedHome | null =
    snapshot === null
      ? null
      : Object.freeze({
          instructions: Object.freeze([]),
          value: Object.freeze({ kind: "storage", requestId: snapshot.id, bytes, signed: false }),
          indirect: false,
        });
  return Object.freeze({
    bytes,
    from,
    to,
    middle,
    setup: Object.freeze([...from.instructions, ...to.instructions]),
    restoreSource,
    directional,
  });
}

/** Copy a small packed value without loop setup or a call. */
export function lowerAggregatePlaceCopy(
  operation: Extract<SemanticOperation, { readonly kind: "store" }>,
  source: SemanticPlace,
  state: FunctionLoweringState,
): readonly MachineInstruction[] {
  const prepared = prepareCopy(operation, source, state);
  if (prepared === null) return Object.freeze([]);
  const { bytes, from, to, middle } = prepared;
  const instructions: MachineInstruction[] = [...prepared.setup];
  const copy = (read: PackedHome, write: PackedHome): void => {
    for (let offset = 0; offset < bytes; offset += 1) {
      if (offset > 0 && (offset & 0xff) === 0) {
        advancePage(instructions, read, state, operation.span);
        advancePage(instructions, write, state, operation.span);
      }
      appendRead(instructions, read, offset, state, operation.span);
      appendWrite(instructions, write, offset, state, operation.span);
    }
  };
  if (middle === null) copy(from, to);
  else {
    copy(from, middle);
    copy(middle, to);
  }
  return Object.freeze(instructions);
}

/** Address one page with Y, preserving the source object's actual base address. */
function indexedOperand(home: PackedHome, pageOffset: number, source: SourceSpan): MachineOperand {
  if (home.indirect) {
    if (home.value.kind !== "storage") throw loweringFailure("Packed pointer has no home", source);
    return Object.freeze({ kind: "indirect-y", requestId: home.value.requestId, offset: 0 });
  }
  if (home.value.kind === "storage") {
    return Object.freeze({ kind: "storage", requestId: home.value.requestId, offset: pageOffset });
  }
  if (home.value.kind === "label") {
    return Object.freeze({ kind: "label", label: home.value.label, offset: pageOffset });
  }
  throw loweringFailure("Packed object has no addressable home", source);
}

/** Emit page-safe counted machine blocks for one or more ordered packed-copy phases. */
export function lowerPackedCopyLoops(
  phases: readonly (readonly [PackedHome, PackedHome])[],
  bytes: number,
  state: FunctionLoweringState,
  entryLabel: string,
  prefix: readonly MachineInstruction[],
  ordinal: number,
  source: SourceSpan,
): { readonly blocks: readonly MachineBlock[]; readonly continuation: string } {
  const cpu = state.input.profile.cpu;
  const blocks: MachineBlock[] = [];
  let currentLabel = entryLabel;
  let pending: MachineInstruction[] = [...prefix];
  for (const [phase, [read, write]] of phases.entries()) {
    const pageCount = Math.ceil(bytes / 256);
    for (let page = 0; page < pageCount; page += 1) {
      if (page > 0) {
        advancePage(pending, read, state, source);
        advancePage(pending, write, state, source);
      }
      pending.push(
        machineInstruction(
          cpu,
          "ldy",
          "immediate",
          Object.freeze({ kind: "immediate", value: 0 }),
          [],
          source,
        ),
      );
      const loopLabel = `${entryLabel}.copy.${ordinal}.${phase}.${page}`;
      const nextLabel = `${loopLabel}.done`;
      blocks.push(
        Object.freeze({
          label: currentLabel,
          instructions: Object.freeze(pending),
          terminator: Object.freeze({ kind: "fallthrough" as const, target: loopLabel }),
        }),
      );
      const pageBytes = Math.min(256, bytes - page * 256);
      const readOperand = indexedOperand(read, page * 256, source);
      const writeOperand = indexedOperand(write, page * 256, source);
      const body: MachineInstruction[] = [
        machineInstruction(
          cpu,
          "lda",
          read.indirect ? "indirect-indexed-y" : "absolute-y",
          readOperand,
          [],
          source,
        ),
        machineInstruction(
          cpu,
          "sta",
          write.indirect ? "indirect-indexed-y" : "absolute-y",
          writeOperand,
          [],
          source,
        ),
        machineInstruction(cpu, "iny", "implied", null, [], source),
      ];
      if (pageBytes < 256) {
        body.push(
          machineInstruction(
            cpu,
            "cpy",
            "immediate",
            Object.freeze({ kind: "immediate", value: pageBytes }),
            [],
            source,
          ),
        );
      }
      blocks.push(
        Object.freeze({
          label: loopLabel,
          instructions: Object.freeze(body),
          terminator: Object.freeze({
            kind: "branch" as const,
            opcode: "bne",
            target: loopLabel,
            fallthrough: nextLabel,
            uses: machineState([], ["z"]),
            cost: machineCost(cpu, "bne", "relative"),
          }),
        }),
      );
      currentLabel = nextLabel;
      pending = [];
    }
  }
  return Object.freeze({ blocks: Object.freeze(blocks), continuation: currentLabel });
}

/** Choose a snapshot when necessary, then use compact loops for a large value copy. */
export function lowerAggregatePlaceCopyLoop(
  operation: Extract<SemanticOperation, { readonly kind: "store" }>,
  source: SemanticPlace,
  state: FunctionLoweringState,
  entryLabel: string,
  prefix: readonly MachineInstruction[],
  ordinal: number,
): {
  readonly blocks: readonly MachineBlock[];
  readonly continuation: string;
  readonly continuationInstructions: readonly MachineInstruction[];
} | null {
  const prepared = prepareCopy(operation, source, state, true, true);
  if (prepared === null) return null;
  if (prepared.directional) {
    const save: MachineInstruction[] = [];
    const continuationInstructions: MachineInstruction[] = [];
    if (prepared.restoreSource) {
      if (prepared.from.value.kind !== "storage") {
        throw loweringFailure("Retained aggregate pointer has no home", operation.span);
      }
      const savedHigh = requestStorage(
        state,
        `aggregate-source-page:${operation.value}`,
        "temporary",
        1,
        "ram",
        operation.span,
        "Restore a retained aggregate address after copying",
      );
      save.push(
        machineInstruction(
          state.input.profile.cpu,
          "lda",
          "storage",
          Object.freeze({ kind: "storage", requestId: prepared.from.value.requestId, offset: 1 }),
          [],
          operation.span,
        ),
        storeA(
          Object.freeze({ kind: "storage", requestId: savedHigh.id, bytes: 1 }),
          0,
          state,
          operation.span,
        ),
      );
      continuationInstructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "lda",
          "storage",
          Object.freeze({ kind: "storage", requestId: savedHigh.id, offset: 0 }),
          [],
          operation.span,
        ),
        storeA(prepared.from.value, 1, state, operation.span),
      );
    }
    const lowered = lowerDirectionalCopyLoops(
      prepared.from,
      prepared.to,
      prepared.bytes,
      state,
      entryLabel,
      [...prefix, ...prepared.setup, ...save],
      ordinal,
      operation.span,
    );
    return Object.freeze({
      ...lowered,
      continuationInstructions: Object.freeze(continuationInstructions),
    });
  }
  const phases =
    prepared.middle === null
      ? [[prepared.from, prepared.to] as const]
      : [[prepared.from, prepared.middle] as const, [prepared.middle, prepared.to] as const];
  const lowered = lowerPackedCopyLoops(
    phases,
    prepared.bytes,
    state,
    entryLabel,
    [...prefix, ...prepared.setup],
    ordinal,
    operation.span,
  );
  // The retained address may be used again as a value. Restore its page base
  // after the copy instead of allocating and initializing a second pointer.
  const continuationInstructions: MachineInstruction[] = [];
  if (prepared.restoreSource) {
    if (prepared.from.value.kind !== "storage") {
      throw loweringFailure("Retained aggregate pointer has no home", operation.span);
    }
    for (let page = 1; page < Math.ceil(prepared.bytes / 256); page += 1) {
      continuationInstructions.push(
        machineInstruction(
          state.input.profile.cpu,
          "dec",
          "storage",
          Object.freeze({ kind: "storage", requestId: prepared.from.value.requestId, offset: 1 }),
          [],
          operation.span,
        ),
      );
    }
  }
  return Object.freeze({
    ...lowered,
    continuationInstructions: Object.freeze(continuationInstructions),
  });
}

import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import type { SemanticOperation, SemanticPlace } from "../semantic/operations.js";
import { lowerAggregateAddress } from "./lower-aggregate.js";
import { machineInstruction, type LoweredValue } from "./lower-control.js";
import type { MachineInstruction } from "./machine-types.js";
import {
  appendLoadA,
  loweredPlace,
  loweringFailure,
  requestStorage,
  storeA,
  type FunctionLoweringState,
} from "./lower.js";

interface PackedHome {
  readonly instructions: readonly MachineInstruction[];
  readonly value: LoweredValue;
  readonly indirect: boolean;
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

/** Copy complete packed bytes, snapshotting only when source and target may alias. */
export function lowerAggregatePlaceCopy(
  operation: Extract<SemanticOperation, { readonly kind: "store" }>,
  source: SemanticPlace,
  state: FunctionLoweringState,
): readonly MachineInstruction[] {
  const target = operation.place;
  if (
    source === target ||
    (source.path.length === 0 &&
      target.path.length === 0 &&
      bindingIdentityKey(source.root) === bindingIdentityKey(target.root))
  ) {
    return Object.freeze([]);
  }
  const type = operation.type;
  if (type.kind !== "array" && type.kind !== "struct") {
    throw loweringFailure("Packed copy has no complete aggregate type", operation.span);
  }
  const bytes = type.size;
  if (bytes === 0) return Object.freeze([]);
  const from = packedHome(source, bytes, `copy-source:${operation.value}`, state, operation.span);
  const to = packedHome(target, bytes, `copy-target:${operation.value}`, state, operation.span);
  const sourceKey = bindingIdentityKey(source.root);
  const targetKey = bindingIdentityKey(target.root);
  const sourceMayAlias = from.indirect;
  const targetMayAlias = to.indirect;
  const needsSnapshot = sourceKey === targetKey || sourceMayAlias || targetMayAlias;
  const snapshot = needsSnapshot
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
  const instructions: MachineInstruction[] = [...from.instructions, ...to.instructions];
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

import type { CompleteC64Layout } from "../artifacts/acme-validate.js";
import type { EvidenceRecord } from "../artifacts/evidence-types.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SemanticFunction } from "../semantic/operations.js";
import type { StorageHome, StorageRequest } from "../storage/storage-types.js";
import { sameSpan } from "./debug-machine-ranges.js";

/** Describe one already-certified private memory home in the existing debug format. */
export function privateHomeAvailability(home: StorageHome): EvidenceRecord {
  return Object.freeze({
    kind: "available",
    pieces: Object.freeze([
      Object.freeze({
        kind: "memory",
        machine: Object.freeze({
          addressSpaceIndex: 0,
          start: home.address,
          end: home.address + home.bytes,
        }),
        valueOffset: 0,
        byteLength: home.bytes,
      }),
    ]),
  });
}

/**
 * Describe the exact conditional-capture byte leaf using final instruction PCs.
 *
 * Conservative SFA interference lifetime is not proof that a home was written.
 * This one finite shape has a fresh load/N-branch, a STA/JSR/LDA call arm and
 * a shared byte RTS. The bypass never stores, so the return value is in A on
 * both predecessors, not necessarily in memory. Identify the declaration by
 * its binding and retained source spans as well as its certified home; physical
 * address equality alone would confuse legitimate storage overlays.
 * No control-flow availability analysis or new sidecar fields are introduced.
 * @param machine The final bound and laid-out function, including empty aliases.
 * @param source The original semantic body retaining declaration/read ownership.
 * @param request The existing declared-local storage demand.
 * @param home Its certified one-byte physical home.
 * @returns Existing availability groups with exact instruction-entry PCs, or null.
 */
export function capturedByteLocations(
  machine: CompleteC64Layout["program"]["functions"][number],
  source: Pick<SemanticFunction, "blocks" | "source">,
  request: StorageRequest,
  home: StorageHome,
): readonly { readonly starts: readonly number[]; readonly availability: EvidenceRecord }[] | null {
  if (
    request.storageClass !== "local" ||
    request.binding === null ||
    request.bytes !== 1 ||
    home.bytes !== 1 ||
    (request.domain !== undefined && request.domain !== "main") ||
    request.activationRoot !== undefined ||
    machine.blocks.length !== 4
  )
    return null;
  const guard = machine.blocks[0]!;
  const called = machine.blocks.find((block) => block.instructions.length === 3);
  const returned = machine.blocks.find(
    (block) => block.instructions.length === 0 && block.terminator.kind === "return",
  );
  const bypass = machine.blocks.find(
    (block) => block !== guard && block !== called && block !== returned,
  );
  if (
    guard.instructions.length !== 1 ||
    guard.terminator.kind !== "branch" ||
    !["bmi", "bpl"].includes(guard.terminator.opcode) ||
    called === undefined ||
    returned === undefined ||
    bypass === undefined ||
    called === guard ||
    guard.origin === undefined ||
    called.origin === undefined ||
    returned.origin === undefined ||
    bypass.instructions.length !== 0 ||
    (bypass.terminator.kind !== "jump" && bypass.terminator.kind !== "fallthrough") ||
    bypass.terminator.target !== returned.label ||
    (called.terminator.kind !== "jump" && called.terminator.kind !== "fallthrough") ||
    called.terminator.target !== returned.label
  )
    return null;
  const targets = [guard.terminator.target, guard.terminator.fallthrough];
  if (
    !targets.includes(called.label) ||
    !targets.some((target) => target === bypass.label || target === returned.label)
  )
    return null;
  const load = guard.instructions[0]!;
  const [store, call, reload] = called.instructions;
  /** Match the already-certified byte and a private access, not an arbitrary equal address. */
  const readsHome = (instruction: typeof store, opcode: string): boolean =>
    instruction?.opcode === opcode &&
    ["absolute", "zero-page"].includes(instruction.mode) &&
    instruction.operand?.kind === "absolute" &&
    instruction.operand.value === home.address &&
    instruction.memory.length === 0;
  if (
    load.opcode !== "lda" ||
    !["absolute", "zero-page"].includes(load.mode) ||
    load.memory.length !== 1 ||
    load.memory[0]!.kind !== "read" ||
    load.memory[0]!.width !== 1 ||
    !load.memory[0]!.volatile ||
    !readsHome(store, "sta") ||
    !readsHome(reload, "lda") ||
    store === undefined ||
    reload === undefined ||
    call?.opcode !== "jsr" ||
    call.mode !== "absolute" ||
    call.operand?.kind !== "label" ||
    call.memory.length !== 0
  )
    return null;
  const binding = bindingIdentityKey(request.binding);
  const operations = source.blocks.flatMap((block) => block.operations);
  const declarations = operations.filter(
    (operation) =>
      operation.kind === "store" &&
      operation.place.path.length === 0 &&
      bindingIdentityKey(operation.place.root) === binding &&
      sameSpan(store.source, operation.span),
  );
  const declaration = declarations[0];
  if (declarations.length !== 1 || declaration?.kind !== "store") return null;
  const capture = operations.find(
    (operation) => "result" in operation && operation.result === declaration.value,
  );
  const calls = operations.filter(
    (operation) => operation.kind === "call" && sameSpan(call.source, operation.span),
  );
  if (
    capture?.kind !== "memory-read" ||
    capture.width !== 1 ||
    !sameSpan(load.source, capture.span) ||
    calls.length !== 1 ||
    calls[0]?.kind !== "call" ||
    calls[0].arguments.length !== 0
  )
    return null;
  const aStarts = [guard.origin + load.cost.bytes, called.origin, returned.origin];
  if (called.terminator.kind === "jump")
    aStarts.push(called.origin + store.cost.bytes + call.cost.bytes + reload.cost.bytes);
  if (bypass.terminator.kind === "jump") {
    if (bypass.origin === undefined) return null;
    aStarts.push(bypass.origin);
  }
  return Object.freeze([
    Object.freeze({
      starts: Object.freeze([guard.origin]),
      availability: Object.freeze({ kind: "unavailable", reason: "notMaterialized" }),
    }),
    Object.freeze({
      starts: Object.freeze(aStarts),
      availability: Object.freeze({
        kind: "available",
        pieces: Object.freeze([
          Object.freeze({ kind: "register", register: "A", valueOffset: 0, byteLength: 1 }),
        ]),
      }),
    }),
    Object.freeze({
      starts: Object.freeze([
        called.origin + store.cost.bytes,
        called.origin + store.cost.bytes + call.cost.bytes,
      ]),
      availability: privateHomeAvailability(home),
    }),
  ]);
}

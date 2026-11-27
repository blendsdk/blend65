import { C64_STARTUP_STATE_ID } from "../layout/startup.js";
import { BYTE_WINDOW_CHANGED as STATE, byteContinuationQuery } from "../machine/lower-control.js";
import { operandAddress } from "../machine/nmos6510-access.js";
import { occupiesNoBytes } from "../layout/c64-layout-continuation.js";
import { registerMainContinuation } from "./size-observer-register-counter.js";
import type { View, Side } from "./size-observer-selected-loop-layout.js";
import type {
  FixedCounterProof,
  MachineBlock,
  MachineFunction,
  MachineInstruction,
} from "../machine/machine-types.js";
import type { BindingId } from "../frontend/semantic-types.js";
import type { SemanticOperation } from "../semantic/operations.js";
import type { FinalObserverInput } from "./size-observers.js";

/** Differences after the byte test and after replacing a word update with INC. */
const TEST_STATE = STATE.a | STATE.v;
const UPDATE_STATE = STATE.a | STATE.n | STATE.z | STATE.c | STATE.v;
/** Canonical startup constructors: stored-P and compact held-P. */
function startup(current: View): boolean {
  const blocks = current.program.startup.blocks,
    held = current.lowered.binder.startupStack;
  if (blocks.length !== 2 || (held?.heldBytes !== 0 && held?.heldBytes !== 1)) return false;
  const [entry, restore] = blocks;
  if (entry === undefined || restore === undefined) return false;
  const opcodes = (items: readonly MachineInstruction[]) => items.map((i) => i.opcode).join(",");
  const cld = entry.instructions.findIndex((i) => i.opcode === "cld");
  const prefix = opcodes(entry.instructions.slice(0, cld));
  if (held?.heldBytes === 1)
    return (
      held.transientPeakBytes === 2 &&
      prefix === "php,sei" &&
      opcodes(entry.instructions.slice(-6)) === "tsx,inx,lda,pha,plp,cld" &&
      opcodes(restore.instructions.slice(-6)) === "tsx,inx,lda,txs,pha,plp" &&
      entry.terminator.kind === "fallthrough" &&
      restore.terminator.kind === "return" &&
      restore.instructions[0]?.opcode === "sei" &&
      restore.instructions.at(-1)?.opcode === "plp" &&
      [entry.instructions.at(-4), restore.instructions.at(-4)].every(
        (item) =>
          item?.mode === "absolute-x" &&
          item.operand?.kind === "absolute" &&
          item.operand.value === 0x0100,
      )
    );
  const php = entry.instructions.findIndex((i) => i.opcode === "php"),
    saved = entry.instructions[php + 2]?.operand;
  if (
    !["php,pla,sta", "sta,stx,sty,php,pla,sta,tsx,stx"].includes(prefix) ||
    saved?.kind !== "label" ||
    saved.label !== C64_STARTUP_STATE_ID ||
    entry.instructions[php + 2]?.opcode !== "sta" ||
    entry.instructions
      .slice(cld + 1)
      .some(
        (item) =>
          !["lda", "ldx", "ldy", "sta", "stx", "sty", "and", "ora", "txa", "tya", "jsr"].includes(
            item.opcode,
          ),
      ) ||
    entry.terminator.kind !== "fallthrough" ||
    restore.terminator.kind !== "return" ||
    restore.instructions.at(-1)?.opcode !== "plp"
  )
    return false;
  const load = restore.instructions.findIndex(
    (item, index) =>
      item.opcode === "lda" &&
      JSON.stringify(item.operand) === JSON.stringify(saved) &&
      restore.instructions[index + 1]?.opcode === "pha",
  );
  return (
    load >= 0 &&
    restore.instructions
      .slice(0, load)
      .every((item) => ["lda", "ldx", "sta", "stx", "txs"].includes(item.opcode)) &&
    restore.instructions
      .filter((item) => ["pha", "php", "pla", "plp"].includes(item.opcode))
      .map((i) => i.opcode)
      .join(",") === "pha,plp" &&
    restore.instructions
      .slice(load + 2, -1)
      .every((item) => ["lda", "ldx", "ldy"].includes(item.opcode))
  );
}

/** One source call into the loop owner, with the operation that identifies it. */
type OwnerCall = {
  readonly owner: BindingId;
  readonly operation: Extract<SemanticOperation, { readonly kind: "call" }>;
};

/**
 * Whether a foreign edge into the loop owner is the program entry continuing into it.
 *
 * The entry function may continue into a body it called last instead of
 * calling it, and that body then continues into the restoration instead of
 * returning. Such an edge stands for exactly one source call: it must name the
 * owner's entry, come from the entry function's only body in the ordinary
 * context, and carry that call's own source span. What would have run after
 * the call is the restoration, so that is where the difference the
 * representation leaves must go unobserved, under the same mask a returning
 * call's continuation gets.
 */
function continuationEntry(
  input: FinalObserverInput,
  current: Side,
  caller: MachineFunction,
  block: MachineBlock,
  calls: readonly OwnerCall[],
  seen: Set<object>,
  representation: FixedCounterProof["representation"],
  originalYChanged: boolean,
): boolean {
  const edge = block.terminator;
  const main = input.checked.program.semantic.main;
  if (
    !current.continues ||
    !(
      (edge.kind === "jump" && edge.continuation === true) ||
      (edge.kind === "fallthrough" && edge.source !== undefined)
    ) ||
    edge.target !== current.actual.id ||
    edge.source === undefined ||
    caller.sourceFunction !== main ||
    current.program.functions.filter(({ sourceFunction }) => sourceFunction === main).length !==
      1 ||
    caller.observerBodies !== undefined ||
    block.observerBodies !== undefined ||
    caller.executionContext?.domain !== "main" ||
    caller.executionContext.activationRoot !== undefined
  )
    return false;
  // A fall-through must land on the owner's entry by address, not only by name.
  const end =
    block.origin === undefined
      ? undefined
      : block.origin + block.instructions.reduce((sum, item) => sum + item.cost.bytes, 0);
  if (edge.kind === "fallthrough" && end !== current.labels.get(current.actual.id)) return false;
  const call = calls.find(
    ({ owner, operation }) => owner === caller.sourceFunction && operation.span === edge.source,
  );
  if (call === undefined || seen.has(call.operation)) return false;
  const restoration = byteContinuationQuery(
    new Map(current.program.startup.blocks.map((item) => [item.label, item])),
    { registers: [], flags: ["n", "z", "c", "v"] },
  );
  const mask =
    representation === "low-byte"
      ? TEST_STATE
      : STATE.a | STATE.v | STATE[representation] | (originalYChanged ? STATE.y : 0);
  if (!restoration("startup.restore", 0, mask)) return false;
  seen.add(call.operation);
  return true;
}

/** Resolve every foreign entry/exposure, including numeric calls and interior addresses. */
function callers(
  input: FinalObserverInput,
  current: Side,
  representation: FixedCounterProof["representation"],
  originalYChanged = false,
): boolean {
  const reached = new Set(input.checked.program.reachableFunctions);
  const calls = input.checked.program.semantic.functions
    .filter(({ id }) => reached.has(id))
    .flatMap((fn) =>
      fn.blocks.flatMap((block) =>
        block.operations.flatMap((operation) =>
          operation.kind === "call" && operation.callee === current.actual.sourceFunction
            ? [{ owner: fn.id, operation }]
            : [],
        ),
      ),
    );
  const seen = new Set<object>();
  const all = [current.program.startup, ...current.program.functions];
  // A body with no bytes of its own that falls into the owner shares its
  // address. Control entering it enters the owner only through that body's own
  // continuation edge, which is examined as an edge in its own right below.
  const passThrough = new Set(
    all
      .filter((fn) => occupiesNoBytes(fn) && fn.blocks.at(-1)?.terminator.kind === "fallthrough")
      .filter((fn) => {
        const last = fn.blocks.at(-1)!.terminator;
        return (
          last.kind === "fallthrough" &&
          last.target === current.actual.id &&
          fn.origin !== undefined &&
          fn.origin === current.labels.get(current.actual.id)
        );
      })
      .flatMap((fn) => [fn.id, ...fn.blocks.map(({ label }) => label)]),
  );
  const query = byteContinuationQuery(
    new Map(all.flatMap((fn) => fn.blocks.map((block) => [block.label, block] as const))),
    { registers: ["a", "x", "y"], flags: ["n", "z", "c", "v"] },
  );
  const inside = (address: number | undefined | null) =>
    address != null &&
    current.blocks.some((block) => {
      const edge = block.terminator;
      const bytes =
        edge.kind === "fallthrough" || edge.kind === "unreachable"
          ? 0
          : edge.kind === "return"
            ? 1
            : edge.cost.bytes;
      return (
        address >= block.origin! &&
        address <
          block.origin! + bytes + block.instructions.reduce((sum, item) => sum + item.cost.bytes, 0)
      );
    });
  for (const fn of all) {
    if (fn === current.actual) continue;
    for (const block of fn.blocks) {
      const edge = block.terminator;
      const targets =
        edge.kind === "branch"
          ? [edge.target, edge.fallthrough]
          : edge.kind === "long-branch"
            ? [edge.jump.target, edge.fallthrough]
            : edge.kind === "jump" || edge.kind === "fallthrough"
              ? [edge.target]
              : [];
      if (
        targets.some((label) => !passThrough.has(label) && inside(current.labels.get(label))) &&
        !continuationEntry(input, current, fn, block, calls, seen, representation, originalYChanged)
      )
        return false;
      let pc = block.origin!;
      for (const [index, item] of block.instructions.entries()) {
        const address = operandAddress({
          cpu: input.checked.profile.cpu,
          instruction: item,
          pc,
          labels: current.labels,
        });
        const exposed =
          item.operand?.kind === "label" ? current.labels.get(item.operand.label) : undefined;
        if (["jsr", "jmp"].includes(item.opcode) && (item.mode !== "absolute" || address === null))
          return false;
        if (inside(address) || inside(exposed)) {
          const source = calls.find(
            ({ owner, operation }) => owner === fn.sourceFunction && operation.span === item.source,
          );
          if (
            item.opcode !== "jsr" ||
            address !== current.blocks[0]!.origin ||
            source === undefined ||
            fn.observerBodies !== undefined ||
            block.observerBodies !== undefined ||
            seen.has(source.operation) ||
            !(representation === "low-byte"
              ? query(block.label, index + 1, TEST_STATE)
              : registerMainContinuation(
                  input,
                  current,
                  fn,
                  block,
                  index + 1,
                  representation,
                  originalYChanged,
                ))
          )
            return false;
          seen.add(source.operation);
        }
        pc += item.cost.bytes;
      }
    }
  }
  return calls.length > 0 && seen.size === calls.length;
}

/**
 * Whether anything outside a selected loop observes the state its removal changed.
 *
 * The selection proof is about the loop. This one is about everything the loop
 * hands back to: the startup constructor wrapping the program, every foreign
 * entry that can reach the owning function, and the architectural differences
 * surviving to each of them. A loop can be perfectly proved and still be refused
 * here, which is why the two are asked separately.
 *
 * The final false test agrees on N/Z/C. Memory counters leave X/Y unchanged;
 * a proved register counter also carries its assigned-register difference into
 * the actual caller check. The skipped first test needs a wider first-body mask.
 * Only the exact finite index template proves V unobserved through repetitions;
 * that difference still reaches the real caller, together with removed Y setup.
 *
 * @param input Original checked source with both closed constructions.
 * @param before Independently resolved reference side.
 * @param after Selected side, whose differences these checks must discharge.
 * @param representation Counter representation the selected side used.
 * @param indexed Whether the counter is the sole typed index of one store.
 * @param hoisted Whether the selected side loads its invariant byte ahead of the
 * loop. The accumulator is then live from that load through every trip, so the
 * mask narrows at the test and the body, where it is live by construction.
 * @returns True when nothing outside the loop observes the difference.
 * @example continuations(input, before, after, "x", true, true);
 */
export function continuations(
  input: FinalObserverInput,
  before: Side,
  after: Side,
  representation: FixedCounterProof["representation"],
  indexed = false,
  hoisted = false,
): boolean {
  const state = indexed ? UPDATE_STATE & ~STATE.v : UPDATE_STATE;
  // Both constructions leave the loop owner the same way, or nothing is compared.
  if (before.continues !== after.continues) return false;
  for (const current of [before, after]) {
    // An owner that continues into the restoration hands its state straight to
    // it, so the restoration is part of what must not observe the difference.
    const query = byteContinuationQuery(
      new Map(
        [
          ...current.actual.blocks,
          ...(current.continues ? current.program.startup.blocks : []),
        ].map((block) => [block.label, block]),
      ),
      { registers: [], flags: [] },
    );
    // Where the invariant byte is loaded ahead of the loop, the accumulator is
    // live from that load through every trip by construction, so asking whether
    // a difference at the body or the test is unobserved would ask the wrong
    // question, and the mask narrows there.
    //
    // What discharges the accumulator is not this query but identity: the body
    // must be the store alone and the instruction ahead of the loop must be that
    // body's own load, matched operand for operand with the same source span and
    // no observations of its own. The query below pins the load's position and
    // cannot fail for the shape that reaches it, since a load is the first thing
    // it scans and a load defines A. The exit keeps its own obligation, which can
    // fail and does the work there.
    const carried = hoisted && current === after ? state & ~STATE.a : state;
    if (
      (hoisted && current === after && !query(current.blocks[0]!.label, 1, state)) ||
      !query(current.blocks[2]!.label, 0, representation === "low-byte" ? TEST_STATE : carried) ||
      !query(current.blocks[4]!.label, 0, TEST_STATE) ||
      !query(current.blocks[1]!.label, 0, carried) ||
      current.shared.certificate.inventory.results.some(
        ({ function: owner }) => owner === current.actual.sourceFunction,
      )
    )
      return false;
    if (!callers(input, current, representation, indexed) || !startup(current)) return false;
  }
  return true;
}

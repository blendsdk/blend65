import { C64_STARTUP_STATE_ID } from "../layout/startup.js";
import { BYTE_WINDOW_CHANGED as STATE, byteContinuationQuery } from "../machine/lower-control.js";
import { operandAddress } from "../machine/nmos6510-access.js";
import { registerMainContinuation } from "./size-observer-register-counter.js";
import type { View, Side } from "./size-observer-selected-loop-layout.js";
import type { FixedCounterProof, MachineInstruction } from "../machine/machine-types.js";
import type { FinalObserverInput } from "./size-observers.js";

/**
 * Whether anything outside a selected loop observes the state its removal changed.
 *
 * The selection proof itself is about the loop. These three checks are about
 * everything the loop hands back to: the startup constructor that wraps the
 * program, every foreign entry that can reach the owning function, and the
 * architectural differences that survive to each of them. They are separated
 * from the loop proof because a loop can be perfectly proved and still be
 * refused here, and the reason an author would want is which of the two failed.
 */
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
      if (targets.some((label) => inside(current.labels.get(label)))) return false;
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
 * The final false test agrees on N/Z/C. Memory counters leave X/Y unchanged;
 * a proved register counter also carries its assigned-register difference into
 * the actual caller check. The skipped first test needs a wider first-body mask.
 * Only the exact finite index template proves V unobserved through repetitions;
 * that difference still reaches the real caller, together with removed Y setup.
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
  for (const current of [before, after]) {
    const query = byteContinuationQuery(
      new Map(current.actual.blocks.map((block) => [block.label, block])),
      { registers: [], flags: [] },
    );
    // Where the invariant byte is loaded ahead of the loop, the accumulator is
    // live from that load through every trip by construction, so asking whether
    // a difference at the body or the test is unobserved would ask the wrong
    // question. The obligation does not go away: it moves to the load, which is
    // where an inherited accumulator stops being readable, while the exit keeps
    // its own unchanged obligation.
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

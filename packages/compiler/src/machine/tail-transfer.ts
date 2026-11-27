import type { SourceSpan } from "../project/types.js";
import type { SemanticFunction } from "../semantic/operations.js";
import type { CpuFacts } from "../target/nmos6510.js";
import { plainEntryLabel } from "./call-site-facts.js";
import { machineCost } from "./lower-control.js";
import type { MachineBlock, MachineFunction } from "./machine-types.js";
import type { AppliedRule, RuleSite } from "./optimization-rules.js";

/**
 * Instructions that read or move the stack pointer itself.
 *
 * Code that runs either of them can address the stack above its own frame,
 * where a transfer would leave the caller's caller's return address instead of
 * the caller's. Pushes and pulls are not listed: compiled code keeps them
 * balanced inside one body, so they never reach past it.
 */
const STACK_POINTER_ACCESS = new Set(["tsx", "txs"]);

/** Every body a call or transfer can name, indexed by the labels inside it. */
export function bodiesByLabel(
  bodies: readonly MachineFunction[],
): ReadonlyMap<string, MachineFunction> {
  const owners = new Map<string, MachineFunction>();
  for (const body of bodies) {
    owners.set(body.id, body);
    for (const block of body.blocks) owners.set(block.label, body);
  }
  return owners;
}

/** Instructions whose label operand names code that control can enter. */
const CONTROL_TRANSFERS = new Set(["jsr", "jmp"]);

/** Labels of code a body can pass control to: calls, jumps, branches and dispatch targets. */
function controlTargets(body: MachineFunction): readonly string[] {
  return body.blocks.flatMap((block) => [
    ...block.instructions.flatMap(({ opcode, operand }) =>
      CONTROL_TRANSFERS.has(opcode) && operand?.kind === "label" ? [operand.label] : [],
    ),
    ...(block.indirectTargets ?? []),
    ...(block.terminator.kind === "jump" || block.terminator.kind === "fallthrough"
      ? [block.terminator.target]
      : block.terminator.kind === "branch"
        ? [block.terminator.target, block.terminator.fallthrough]
        : block.terminator.kind === "long-branch"
          ? [block.terminator.jump.target, block.terminator.fallthrough]
          : []),
  ]);
}

/**
 * Whether everything reachable from a label leaves the stack above its frame alone.
 *
 * The walk is over whole bodies: entering any part of a body counts its every
 * instruction, and every body it can pass control to is walked in turn. Data
 * labels are not followed, since no code runs there. A control target that
 * belongs to no known body — firmware, or code this program does not contain —
 * answers no, because nothing can be said about what it reads.
 */
export function stackAboveFrameUnread(
  owners: ReadonlyMap<string, MachineFunction>,
  label: string,
): boolean {
  const pending = [label];
  const walked = new Set<MachineFunction>();
  while (pending.length > 0) {
    const body = owners.get(pending.pop()!);
    if (body === undefined) return false;
    if (walked.has(body)) continue;
    walked.add(body);
    if (
      body.blocks.some((block) =>
        block.instructions.some(
          ({ opcode, operand }) =>
            STACK_POINTER_ACCESS.has(opcode) ||
            // A call or jump to a numeric address enters code this program does
            // not contain, which is as unknown as a label owned by no body.
            (CONTROL_TRANSFERS.has(opcode) && operand?.kind !== "label"),
        ),
      )
    )
      return false;
    pending.push(...controlTargets(body));
  }
  return true;
}

/**
 * Whether the code a label enters is a dispatch block: a transfer through a
 * function value to one of several candidate bodies.
 *
 * Entered by a call, such a block is summarised from the call site, which knows
 * every candidate. Entered by a jump it would be summarised as part of the
 * caller, which cannot see the candidates' returns, so the decimal and
 * interrupt-disable state they leave would go unproved. Those calls keep their
 * call rather than lose that proof.
 */
function entersDispatch(owners: ReadonlyMap<string, MachineFunction>, label: string): boolean {
  const body = owners.get(label);
  const entered =
    body?.blocks.find((block) => block.label === label) ??
    (body?.id === label ? body.blocks[0] : undefined);
  return entered?.indirectTargets !== undefined;
}

/**
 * The label a block's closing call can transfer to, when the call is in tail position.
 *
 * Tail position here is exact: the call is the block's last instruction and the
 * block then returns, so nothing at all happens between the callee's return and
 * the caller's. The returned value, the flags, every memory effect and the
 * stack the caller's caller sees are therefore the callee's own, which is what
 * a transfer delivers. A call naming anything but the whole address of one
 * label, or one that belongs to a KERNAL load sequence, is left alone.
 */
function tailCallTarget(block: MachineBlock): string | undefined {
  if (block.terminator.kind !== "return") return undefined;
  const call = block.instructions.at(-1);
  if (call === undefined || call.opcode !== "jsr" || call.loadUnitRole !== undefined)
    return undefined;
  return plainEntryLabel(call);
}

/**
 * Replace each call in tail position with a transfer to the same label.
 *
 * The callee then returns straight to the caller's caller: one jump instead of
 * a call and a return, two stack bytes fewer at the peak, and nothing at all
 * when the callee's entry is the block placed next, because layout turns a
 * jump to the following block into a fall-through. Interrupt and other
 * non-mainline bodies keep their calls, since they do not leave by `RTS`.
 *
 * A transfer is refused when anything reachable from the callee reads or moves
 * the stack pointer, because it would then find a different return address
 * above its frame than the call left there, and when the callee is a dispatch
 * block through a function value, whose candidates' machine state is only
 * summarised where it is called.
 * @param cpu Selected CPU, which prices the jump.
 * @param bodies Every body in the program, startup included, so callees can be walked.
 * @param items Functions this rule may change.
 * @param mainline Whether a function runs only in the ordinary program context.
 * @param semanticFor Source function owning a machine function, if any.
 * @returns The changed functions and one applied-rule record per changed function.
 * @example
 * // `jsr child / rts` in `touch` becomes `jmp child`.
 * const { functions } = tailTransfer(cpu, [startup, ...fns], fns, mainline, semanticFor);
 */
export function tailTransfer(
  cpu: CpuFacts,
  bodies: readonly MachineFunction[],
  items: readonly MachineFunction[],
  mainline: (fn: MachineFunction) => boolean,
  semanticFor: (fn: MachineFunction) => SemanticFunction | undefined,
): { readonly functions: readonly MachineFunction[]; readonly applied: readonly AppliedRule[] } {
  const owners = bodiesByLabel(bodies);
  const applied: AppliedRule[] = [];
  const functions = items.map((fn) => {
    const semantic = semanticFor(fn);
    if (semantic === undefined || !mainline(fn)) return fn;
    const sites: RuleSite[] = [];
    const spans: SourceSpan[] = [];
    let savedCycles = 0;
    const blocks = fn.blocks.map((block) => {
      const target = tailCallTarget(block);
      const call = block.instructions.at(-1);
      const callee = target === undefined ? undefined : owners.get(target);
      if (
        target === undefined ||
        call === undefined ||
        callee === undefined ||
        !mainline(callee) ||
        (callee === fn && target === fn.id) ||
        entersDispatch(owners, target) ||
        !stackAboveFrameUnread(owners, target)
      )
        return block;
      const jump = machineCost(cpu, "jmp", "absolute");
      const rts = machineCost(cpu, "rts", "implied");
      sites.push(Object.freeze({ block: block.label, index: block.instructions.length - 1 }));
      spans.push(call.source ?? semantic.source);
      savedCycles += call.cost.minCycles + rts.minCycles - jump.minCycles;
      return Object.freeze({
        ...block,
        instructions: Object.freeze(block.instructions.slice(0, -1)),
        terminator: Object.freeze({
          kind: "jump" as const,
          opcode: "jmp" as const,
          target,
          cost: jump,
        }),
      });
    });
    if (sites.length === 0) return fn;
    applied.push(
      Object.freeze({
        ruleId: "cleanup.tail-transfer",
        functions: Object.freeze([semantic]),
        changed: Object.freeze(sites),
        obligations: Object.freeze([
          Object.freeze({ kind: "source-equivalence", sites: Object.freeze(spans) }),
          Object.freeze({
            kind: "cost",
            before: Object.freeze({ component: "T", value: String(savedCycles) }),
            after: Object.freeze({ component: "T", value: "0" }),
          }),
          Object.freeze({ kind: "final-layout", sites: Object.freeze([semantic.source]) }),
        ]),
      }),
    );
    return Object.freeze({ ...fn, blocks: Object.freeze(blocks) });
  });
  return { functions, applied };
}

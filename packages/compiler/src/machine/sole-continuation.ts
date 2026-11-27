import type { SourceSpan } from "../project/types.js";
import type { SemanticFunction } from "../semantic/operations.js";
import type { CpuFacts } from "../target/nmos6510.js";
import { directCallSites, plainEntryLabel } from "./call-site-facts.js";
import { machineCost, machineSuccessors } from "./lower-control.js";
import type { MachineBlock, MachineFunction } from "./machine-types.js";
import type { AppliedRule, RuleSite } from "./optimization-rules.js";
import { bodiesByLabel, stackAboveFrameUnread } from "./tail-transfer.js";

/** The startup code that every exit of the program entry continues into. */
const RESTORATION = "startup.restore";

/** Instructions that leave a body by themselves, outside its structured terminators. */
const SELF_EXITS = new Set(["rts", "rti", "brk", "jmp"]);

/**
 * The single block through which a body returns, when its shape allows it to
 * continue into the restoration instead.
 *
 * Every other way out of the body must stay inside it: branches, jumps and
 * fall-throughs to its own blocks, no dispatch through a function value, and
 * no instruction that leaves by itself. Exactly one block may return, so the
 * one return it gives up pays for the jump it gains; a body with several
 * returns would trade each one-byte `RTS` for a three-byte jump.
 */
function soleReturnBlock(body: MachineFunction): MachineBlock | undefined {
  const own = new Set(body.blocks.map((block) => block.label));
  let found: MachineBlock | undefined;
  for (const block of body.blocks) {
    if (block.indirectTargets !== undefined || block.observerBodies !== undefined) return undefined;
    if (block.instructions.some(({ opcode }) => SELF_EXITS.has(opcode))) return undefined;
    if (block.terminator.kind === "return") {
      if (found !== undefined) return undefined;
      found = block;
      continue;
    }
    if (block.terminator.kind === "unreachable") continue;
    if (machineSuccessors(block).some((label) => !own.has(label))) return undefined;
  }
  return found;
}

/**
 * The body a block's closing call can continue into, when the block then
 * continues into the restoration and that call is the body's only way in.
 */
function continuationCallee(
  bodies: readonly MachineFunction[],
  owners: ReadonlyMap<string, MachineFunction>,
  caller: MachineFunction,
  block: MachineBlock,
): { readonly callee: MachineFunction; readonly entry: string } | undefined {
  if (block.terminator.kind !== "jump" || block.terminator.target !== RESTORATION) return undefined;
  const call = block.instructions.at(-1);
  if (call === undefined || call.loadUnitRole !== undefined) return undefined;
  const entry = plainEntryLabel(call);
  const callee = entry === undefined ? undefined : owners.get(entry);
  if (entry === undefined || callee === undefined || callee === caller || callee.id !== entry)
    return undefined;
  const sites = directCallSites(bodies, entry);
  const site = sites?.length === 1 ? sites[0] : undefined;
  if (
    site === undefined ||
    site.caller.id !== caller.id ||
    site.block.label !== block.label ||
    site.index !== block.instructions.length - 1
  )
    return undefined;
  return { callee, entry };
}

/**
 * Let the program entry continue into a body it calls last and nobody else calls.
 *
 * The entry function has no caller to return to: its continuation is the
 * startup restoration, which it reaches by a jump. When its last act before
 * that jump is a call to a body with exactly one way in, the call and the
 * callee's own return cancel out. The entry jumps to the callee instead, and
 * the callee's return becomes the jump to the restoration. Nothing runs in
 * between either way, so values, flags, memory effects and the stack the
 * restoration finds are the same; the stack simply never holds the return
 * address. Layout can then place each body after the one that continues into
 * it, and the jumps cost nothing.
 *
 * The callee is then a continuation of the entry in its turn, and the same
 * holds for a body it calls last. A callee is refused when anything reachable
 * from it reads or moves the stack pointer, when its address is taken or it
 * can be reached any other way than by this call, when it leaves by any means
 * but one structured return, when it does not run in the ordinary program
 * context, and when it is placed at a fixed address.
 * @param cpu Selected CPU, which prices the jumps.
 * @param bodies Every body in the program, startup included.
 * @param items Functions this rule may change.
 * @param mainline Whether a function runs only in the ordinary program context.
 * @param semanticFor Source function owning a machine function, if any.
 * @returns The changed functions and one applied-rule record per changed function.
 * @example
 * // `main: jsr work / jmp restore` and `work: … rts` become
 * // `main: jmp work` and `work: … jmp restore`.
 * const { functions } = soleContinuation(cpu, [startup, ...fns], fns, mainline, semanticFor);
 */
export function soleContinuation(
  cpu: CpuFacts,
  bodies: readonly MachineFunction[],
  items: readonly MachineFunction[],
  mainline: (fn: MachineFunction) => boolean,
  semanticFor: (fn: MachineFunction) => SemanticFunction | undefined,
): { readonly functions: readonly MachineFunction[]; readonly applied: readonly AppliedRule[] } {
  const changeable = new Set(items.map(({ id }) => id));
  const current = new Map(bodies.map((body) => [body.id, body] as const));
  for (const item of items) current.set(item.id, item);
  const jump = machineCost(cpu, "jmp", "absolute");
  const rts = machineCost(cpu, "rts", "implied");
  const records = new Map<string, { sites: RuleSite[]; spans: SourceSpan[]; cycles: number }>();
  const record = (fn: MachineFunction, site: RuleSite, span: SourceSpan, cycles: number) => {
    const entry = records.get(fn.id) ?? { sites: [], spans: [], cycles: 0 };
    entry.sites.push(Object.freeze(site));
    entry.spans.push(span);
    entry.cycles += cycles;
    records.set(fn.id, entry);
  };

  const entries = items.filter(
    (fn) =>
      mainline(fn) &&
      fn.blocks.some(
        ({ terminator }) => terminator.kind === "jump" && terminator.target === RESTORATION,
      ),
  );
  const pending = entries.length === 1 ? [entries[0]!.id] : [];
  const continued = new Set(pending);
  while (pending.length > 0) {
    const caller = current.get(pending.shift()!)!;
    for (const block of caller.blocks) {
      const all = [...current.values()];
      const found = continuationCallee(all, bodiesByLabel(all), caller, block);
      if (found === undefined) continue;
      const { callee, entry } = found;
      const exit = soleReturnBlock(callee);
      if (
        exit === undefined ||
        !changeable.has(callee.id) ||
        continued.has(callee.id) ||
        callee.nmiPublicationEntry === true ||
        // A body at a fixed address keeps its place, so its exit never becomes a
        // fall-through, and the larger jump can extend the program past its end.
        callee.placement?.at != null ||
        callee.observerBodies !== undefined ||
        !mainline(callee) ||
        semanticFor(callee) === undefined ||
        !stackAboveFrameUnread(bodiesByLabel(all), entry)
      )
        continue;
      const call = block.instructions.at(-1)!;
      const span = call.source ?? semanticFor(caller)?.source;
      const latestCaller = current.get(caller.id)!;
      current.set(
        caller.id,
        Object.freeze({
          ...latestCaller,
          blocks: Object.freeze(
            latestCaller.blocks.map((item) =>
              item.label !== block.label
                ? item
                : Object.freeze({
                    ...item,
                    instructions: Object.freeze(item.instructions.slice(0, -1)),
                    terminator: Object.freeze({
                      kind: "jump" as const,
                      opcode: "jmp" as const,
                      target: entry,
                      cost: jump,
                      continuation: true as const,
                      ...(call.source == null ? {} : { source: call.source }),
                    }),
                  }),
            ),
          ),
        }),
      );
      current.set(
        callee.id,
        Object.freeze({
          ...callee,
          blocks: Object.freeze(
            callee.blocks.map((item) =>
              item !== exit
                ? item
                : Object.freeze({
                    ...item,
                    terminator: Object.freeze({
                      kind: "jump" as const,
                      opcode: "jmp" as const,
                      target: RESTORATION,
                      cost: jump,
                      continuation: true as const,
                    }),
                  }),
            ),
          ),
        }),
      );
      if (span !== undefined) {
        record(
          caller,
          { block: block.label, index: block.instructions.length - 1 },
          span,
          call.cost.minCycles,
        );
        record(
          callee,
          { block: exit.label, index: exit.instructions.length },
          span,
          rts.minCycles - jump.minCycles,
        );
      }
      continued.add(callee.id);
      pending.push(callee.id);
    }
  }

  const applied: AppliedRule[] = [];
  const functions = items.map((fn) => {
    const latest = current.get(fn.id)!;
    const entry = records.get(fn.id);
    const semantic = semanticFor(fn);
    if (latest === fn || entry === undefined || semantic === undefined) return latest;
    applied.push(
      Object.freeze({
        ruleId: "cleanup.sole-continuation",
        functions: Object.freeze([semantic]),
        changed: Object.freeze(entry.sites),
        obligations: Object.freeze([
          Object.freeze({ kind: "source-equivalence", sites: Object.freeze(entry.spans) }),
          Object.freeze({
            kind: "cost",
            before: Object.freeze({ component: "T", value: String(entry.cycles) }),
            after: Object.freeze({ component: "T", value: "0" }),
          }),
          Object.freeze({ kind: "final-layout", sites: Object.freeze([semantic.source]) }),
        ]),
      }),
    );
    return latest;
  });
  return { functions, applied };
}

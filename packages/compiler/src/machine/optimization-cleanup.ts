import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import type { SemanticFunction } from "../semantic/operations.js";
import { calleeRewritesFlags, directCallSites } from "./call-site-facts.js";
import { machineInstruction } from "./lower-control.js";
import type { MachineFunction, MachineInstruction, MachineProgram } from "./machine-types.js";
import type { OptimizationFacts } from "./optimization-facts.js";
import { argumentDelivery } from "./optimization-argument-delivery.js";
import { copyParameterLocals } from "./optimization-copy-propagation.js";
import type { AppliedRule, RuleObligation, RuleSite } from "./optimization-rules.js";

/** One direct byte store or load operand. */
function storageOperand(
  instruction: MachineInstruction,
): Extract<MachineInstruction["operand"], { readonly kind: "storage" }> | undefined {
  return instruction.operand?.kind === "storage" && instruction.operand.addressByte === undefined
    ? instruction.operand
    : undefined;
}

/** Machine registers which can carry one stored source byte. */
type StoredRegister = "a" | "x" | "y";

/** Store and load spelling for each byte-carrying register. */
const STORE_FOR = Object.freeze({ a: "sta", x: "stx", y: "sty" } as const);
const LOAD_FOR = Object.freeze({ a: "lda", x: "ldx", y: "ldy" } as const);

/**
 * Instructions whose N and Z flags are a defined function of the register they write.
 * Only these can prove that the flags before a store already describe the stored byte,
 * which is what makes an immediately following reload redundant.
 */
const PRODUCERS: Readonly<Record<StoredRegister, readonly string[]>> = Object.freeze({
  a: Object.freeze([
    "lda",
    "pla",
    "txa",
    "tya",
    "and",
    "ora",
    "eor",
    "adc",
    "sbc",
    "asl",
    "lsr",
    "rol",
    "ror",
  ]),
  x: Object.freeze(["ldx", "tax", "inx", "dex", "tsx"]),
  y: Object.freeze(["ldy", "tay", "iny", "dey"]),
});

/** Shift instructions only write their register in accumulator mode. */
const ACCUMULATOR_ONLY = new Set(["asl", "lsr", "rol", "ror"]);

/**
 * Instructions with no memory effect whose complete architectural result another
 * adjacent instruction may overwrite. Interrupt and decimal flags are excluded:
 * changing either can be observed between two instructions even when rewritten.
 */
const DEAD_SAFE = new Set([
  "clc",
  "sec",
  "tax",
  "tay",
  "txa",
  "tya",
  "inx",
  "iny",
  "dex",
  "dey",
  "lda",
  "ldx",
  "ldy",
]);

/** Instructions whose storage operand reads the addressed bytes. */
export const READS_STORAGE = new Set([
  "lda",
  "ldx",
  "ldy",
  "adc",
  "sbc",
  "and",
  "ora",
  "eor",
  "cmp",
  "cpx",
  "cpy",
  "inc",
  "dec",
  "asl",
  "lsr",
  "rol",
  "ror",
  "bit",
]);

/** Instructions whose storage operand writes the addressed bytes. */
const WRITES_STORAGE = new Set(["sta", "stx", "sty"]);

/** One direct home read or written by one instruction. */
interface StorageAccess {
  readonly requestId: string;
  readonly offset: number;
}

/** Completed foundation cleanup with every applying rule and its obligations. */
export interface FoundationCleanup {
  readonly functions: readonly MachineFunction[];
  readonly applied: readonly AppliedRule[];
}

/** Return the one direct home addressed by an instruction, rejecting any volatile effect. */
function storageAccess(
  instruction: MachineInstruction,
  _direction: "read" | "write",
): StorageAccess | null {
  if (instruction.operand?.kind !== "storage") return null;
  if (instruction.memory.some((effect) => effect.volatile)) return null;
  for (const effect of instruction.memory)
    if (
      effect.address.kind === "storage" &&
      effect.address.requestId !== instruction.operand.requestId
    )
      return null;
  return Object.freeze({
    requestId: instruction.operand.requestId,
    offset: instruction.operand.offset ?? 0,
  });
}

/** A declared or persistent home is never removed from a neighboring reload. */
function privateMainTemporary(program: MachineProgram, requestId: string): boolean {
  const request = program.requiredStorage.find(({ id }) => id === requestId);
  return (
    request !== undefined &&
    request.binding === null &&
    request.persistent !== true &&
    (request.domain === undefined || request.domain === "main")
  );
}

/** Ordinary mainline code only; interrupt entries keep their full selected sequence. */
function mainline(fn: MachineFunction): boolean {
  const context = fn.executionContext;
  return (
    context === undefined || (context.domain === "main" && context.irq === 0 && context.nmi === 0)
  );
}

/**
 * Whether a producer proves the stored register and its N/Z flags already agree.
 * Exported for the final observers that must accept the same forwarding in both
 * the canonical reference and the selected representation.
 */
export function provedProducer(
  producer: MachineInstruction | undefined,
  register: StoredRegister,
): producer is MachineInstruction {
  if (producer === undefined) return false;
  if (!PRODUCERS[register].includes(producer.opcode)) return false;
  if (ACCUMULATOR_ONLY.has(producer.opcode) && producer.mode !== "accumulator") return false;
  return (
    producer.defines.registers.includes(register) &&
    producer.defines.flags.includes("n") &&
    producer.defines.flags.includes("z")
  );
}

/** One block of generated instructions, addressed by its own label. */
type LabelledBlock = MachineFunction["blocks"][number];

/**
 * Index every block a control edge out of one body can reach, by label.
 *
 * The platform startup routine belongs in the index because an ordinary body
 * does not end at its own terminator: it jumps into the shared restore
 * sequence, which is where its last flags actually die. An ambiguous label maps
 * to `null` so a walk refuses it rather than picking one of two blocks.
 *
 * Indexing startup itself takes its blocks once rather than twice, so that every
 * label stays resolvable instead of looking ambiguous against its own copy.
 */
function labelledBlocks(
  fn: MachineFunction,
  startup: MachineFunction,
): ReadonlyMap<string, LabelledBlock | null> {
  const index = new Map<string, LabelledBlock | null>();
  for (const block of fn.id === startup.id ? fn.blocks : [...fn.blocks, ...startup.blocks])
    index.set(block.label, index.has(block.label) ? null : block);
  return index;
}

/**
 * Whether one reload is the exact redundant pair this pass itself may remove.
 *
 * Such a load must not count as a flag producer: whether it survives depends on
 * the order two candidate pairs happen to be visited in, and a proof may not
 * depend on that.
 */
function redundantReload(block: LabelledBlock, at: number): boolean {
  const load = block.instructions[at]!;
  const store = block.instructions[at - 1];
  if (store === undefined) return false;
  const register = (Object.keys(LOAD_FOR) as StoredRegister[]).find(
    (candidate) => LOAD_FOR[candidate] === load.opcode,
  );
  if (register === undefined || store.opcode !== STORE_FOR[register]) return false;
  const read = storageAccess(load, "read");
  const written = storageAccess(store, "write");
  return (
    read !== null &&
    written !== null &&
    read.requestId === written.requestId &&
    read.offset === written.offset
  );
}

/**
 * Facts a flag-death walk needs to carry on past the end of one body.
 *
 * Supplying these is what distinguishes a walk that may cross a call boundary
 * from the ordinary one, which stops at the body it was given. Their absence is
 * the conservative answer and leaves every other proof exactly as it was.
 */
interface AcrossBodies {
  /** Every body in the program, indexed by the entry label a call names. */
  readonly bodies: ReadonlyMap<string, MachineFunction>;
  /** Whether every caller leaves the still-live flags unobserved after the return. */
  readonly onReturn: (live: ReadonlySet<string>) => boolean;
}

/**
 * Whether N and Z are both dead from one position, following control flow out of
 * the block when the block itself does not rewrite them.
 *
 * A branch observes the flags and a later producer of both makes the current
 * pair dead. Other flags are not part of a byte load. A block that ends while
 * one of them is still live only proves the pair dead when every successor path
 * does: an ordinary body reaches the platform restore sequence, which rewrites
 * the flags before reading them, while a handler prologue pushes the whole
 * status register and therefore reads them.
 *
 * A return refuses unless the caller fact is supplied, because the flags a caller
 * sees are not this body's to spend; so does a path back into a block already
 * being walked. A call is only stepped over once the caller fact is in play, and
 * then only when the called body certainly rewrites the pair: a call encodes no
 * flag of its own, so without that the body behind it could read exactly what is
 * being proved dead.
 */
function flagsDead(
  blocks: ReadonlyMap<string, LabelledBlock | null>,
  block: LabelledBlock,
  start: number,
  live: ReadonlySet<string> = new Set(["n", "z"]),
  visited: ReadonlySet<string> = new Set(),
  across?: AcrossBodies,
): boolean {
  if (visited.has(block.label)) return false;
  const remaining = new Set(live);
  for (let at = start; at < block.instructions.length; at += 1) {
    const instruction = block.instructions[at]!;
    if (instruction.uses.flags.some((flag) => remaining.has(flag))) return false;
    if (across !== undefined && instruction.opcode === "jsr")
      return calleeRewritesFlags(across.bodies, instruction);
    if (!redundantReload(block, at))
      for (const flag of instruction.defines.flags) remaining.delete(flag);
    if (remaining.size === 0) return true;
  }
  const edge = block.terminator;
  if (edge.kind === "return") return across !== undefined && across.onReturn(remaining);
  if (edge.kind === "unreachable") return false;
  if (edge.kind === "branch" || edge.kind === "long-branch") {
    if (edge.uses.flags.some((flag) => remaining.has(flag))) return false;
  }
  const successors =
    edge.kind === "branch"
      ? [edge.target, edge.fallthrough]
      : edge.kind === "long-branch"
        ? [edge.jump.target, edge.fallthrough]
        : [edge.target];
  const walked = new Set(visited);
  walked.add(block.label);
  return successors.every((label) => {
    const successor = blocks.get(label);
    return (
      successor !== undefined &&
      successor !== null &&
      flagsDead(blocks, successor, 0, remaining, walked, across)
    );
  });
}

/** Remove `sta home; lda home` when the stored value and flags are still in place. */
function copyForward(
  program: MachineProgram,
  items: readonly MachineFunction[],
  semanticFor: (fn: MachineFunction) => SemanticFunction | undefined,
): { readonly functions: readonly MachineFunction[]; readonly applied: readonly AppliedRule[] } {
  const applied: AppliedRule[] = [];
  // Candidate layouts may forward a private source-local reload; the canonical
  // reference keeps it, which is the copy-free pair the byte-window proof expects.
  const policy = program.storageSelection?.sourceFacts.loopPolicy;
  const sourceProgram = program.storageSelection?.sourceFacts.program;
  const routes = sourceProgram?.interruptRoutes;
  const asyncFunctions = new Set(
    [
      ...(routes ?? []).map((route) => route.handler),
      ...(sourceProgram?.roots ?? []).flatMap((root) =>
        root.kind === "interrupt" ? [root.function] : [],
      ),
    ].map(bindingIdentityKey),
  );
  /**
   * A private local can still be forwarded across an asynchronous route when
   * no handler closure names its home. The handler bodies are already lowered
   * into `items`, so a direct operand/memory reference is the conservative
   * observation test; a handler with no reference cannot see the private byte.
   */
  const asyncObserves = (requestId: string): boolean =>
    items.some(
      (fn) =>
        fn.sourceFunction !== undefined &&
        asyncFunctions.has(bindingIdentityKey(fn.sourceFunction)) &&
        fn.blocks.some((block) =>
          block.instructions.some(
            (instruction) =>
              (instruction.operand?.kind === "storage" &&
                instruction.operand.requestId === requestId) ||
              instruction.memory.some(
                (effect) =>
                  (effect.address.kind === "storage" || effect.address.kind === "indirect-y") &&
                  effect.address.requestId === requestId,
              ),
          ),
        ),
    );
  const localForwarding = policy === "mixed";
  // Every body at the state this pass sees, which is what the program will emit:
  // the passes that still run after it only drop a write the next instruction
  // already overwrites, so a flag-death conclusion drawn here keeps holding.
  const current = new Map(items.map((fn) => [fn.id, fn] as const));
  const bodies = [program.startup, ...program.functions.map((fn) => current.get(fn.id) ?? fn)];
  const byEntry = new Map(bodies.map((body) => [body.id, body] as const));
  const indexes = new Map<string, ReadonlyMap<string, LabelledBlock | null>>();
  const blocksOf = (body: MachineFunction) => {
    const cached = indexes.get(body.id);
    if (cached !== undefined) return cached;
    const built = labelledBlocks(body, program.startup);
    indexes.set(body.id, built);
    return built;
  };
  /**
   * Whether every caller of one body leaves N and Z unobserved once it returns.
   *
   * This is the fact a body cannot establish from its own instructions. The call
   * convention hands back no flags, but that is a statement about what a caller
   * may rely on, not about what the generated caller actually does, so the answer
   * has to be read off every call site: the walk simply continues in the caller
   * from the instruction after the call. A body whose callers cannot be
   * enumerated refuses.
   *
   * So does a cycle of bodies, whose callers would otherwise prove each other.
   * The language already rejects recursion outright, so no accepted program
   * reaches that barrier; it stays because the soundness of a proof should not
   * rest on a diagnostic raised somewhere else.
   */
  const callersIgnoreFlags = (
    body: MachineFunction,
    live: ReadonlySet<string>,
    walked: ReadonlySet<string>,
  ): boolean => {
    if (walked.has(body.id)) return false;
    const sites = directCallSites(bodies, body.id);
    if (sites === null) return false;
    const nested = new Set(walked).add(body.id);
    return sites.every((site) =>
      flagsDead(blocksOf(site.caller), site.block, site.index + 1, live, new Set(), {
        bodies: byEntry,
        onReturn: (remaining) => callersIgnoreFlags(site.caller, remaining, nested),
      }),
    );
  };
  const functions = items.map((fn) => {
    const reachable = labelledBlocks(fn, program.startup);
    const across: AcrossBodies = {
      bodies: byEntry,
      onReturn: (live) => callersIgnoreFlags(fn, live, new Set()),
    };
    const sites: RuleSite[] = [];
    const spans: SourceSpan[] = [];
    let savedBytes = 0;
    const blocks = fn.blocks.map((block) => {
      const kept: MachineInstruction[] = [];
      for (let index = 0; index < block.instructions.length; index += 1) {
        const instruction = block.instructions[index]!;
        const next = block.instructions[index + 1];
        if (next === undefined) {
          kept.push(instruction);
          continue;
        }
        const store = storageAccess(instruction, "write");
        const register = (Object.keys(STORE_FOR) as StoredRegister[]).find(
          (candidate) => STORE_FOR[candidate] === instruction.opcode,
        );
        if (
          store === null ||
          register === undefined ||
          next.opcode !== LOAD_FOR[register] ||
          instruction.observerOrigins !== undefined ||
          next.observerOrigins !== undefined ||
          instruction.source === null ||
          next.source === null
        ) {
          kept.push(instruction);
          continue;
        }
        const load = storageAccess(next, "read");
        const producer = block.instructions[index - 1];
        // At block entry A still holds whatever the predecessors left, and the
        // store wrote exactly that byte. A reload there needs no producer when
        // its N/Z result is dead before any observer; an interior pair still
        // needs the adjacent producer proof. A delivery that ends at a return
        // reaches its own callers for that answer.
        const entryForwarding =
          index === 0 &&
          block !== fn.blocks[0] &&
          flagsDead(reachable, block, index + 2, undefined, undefined, across);
        if (
          load === null ||
          load.requestId !== store.requestId ||
          load.offset !== store.offset ||
          (!entryForwarding && !provedProducer(producer, register)) ||
          !(
            privateMainTemporary(program, store.requestId) ||
            (localForwarding &&
              !asyncObserves(store.requestId) &&
              store.requestId.includes(":local:") &&
              // A residual reload ends its block and feeds its branch. A reload
              // feeding an adjacent compare is the byte-window producer and is
              // forwarded to that compare instead.
              ((index + 2 === block.instructions.length &&
                (block.terminator.kind === "branch" || block.terminator.kind === "long-branch")) ||
                (["cmp", "cpx", "cpy", "eor"].includes(
                  block.instructions[index + 2]?.opcode ?? "",
                ) &&
                  provedProducer(producer, register))))
          )
        ) {
          kept.push(instruction);
          continue;
        }
        // The stored byte is still in the register and N/Z still describe it.
        kept.push(instruction);
        sites.push(Object.freeze({ block: block.label, index: index + 1 }));
        spans.push(instruction.source, next.source);
        savedBytes += next.cost.bytes;
        index += 1;
      }
      return Object.freeze({ ...block, instructions: Object.freeze(kept) });
    });
    const semantic = semanticFor(fn);
    if (sites.length === 0 || semantic === undefined) return fn;
    applied.push(
      Object.freeze({
        ruleId: "cleanup.copy-forward",
        functions: Object.freeze([semantic]),
        changed: Object.freeze(sites),
        obligations: Object.freeze([
          Object.freeze({ kind: "source-equivalence", sites: Object.freeze(spans) }),
          Object.freeze({
            kind: "cost",
            before: Object.freeze({ component: "B", value: String(savedBytes) }),
            after: Object.freeze({ component: "B", value: "0" }),
          }),
        ]),
      }),
    );
    return Object.freeze({ ...fn, blocks: Object.freeze(blocks) });
  });
  return { functions, applied };
}

/**
 * Fold a later `ldx local` into a `tax` at the store that produced the byte.
 * The interval must be call-free, must not write X, must not store the local
 * again, and the load's N/Z must be dead because the next instruction defines
 * them. Applied to every size layout, so the canonical and selected shapes stay
 * identical and the shift proof sees the same `cpx` gate.
 */
function foldRegisterReloads(
  program: MachineProgram,
  cpu: import("../target/nmos6510.js").CpuFacts,
  items: readonly MachineFunction[],
  semanticFor: (fn: MachineFunction) => SemanticFunction | undefined,
): { readonly functions: readonly MachineFunction[]; readonly applied: readonly AppliedRule[] } {
  if (program.storageSelection === undefined) return { functions: items, applied: [] };
  const applied: AppliedRule[] = [];
  const functions = items.map((fn) => {
    const sites: RuleSite[] = [];
    const spans: SourceSpan[] = [];
    let savedBytes = 0;
    const blocks = fn.blocks.map((block) => {
      const instructions = [...block.instructions];
      const remove = new Set<number>();
      const inserts = new Map<number, MachineInstruction>();
      for (let at = 0; at < instructions.length; at += 1) {
        const store = instructions[at]!;
        if (store.opcode !== "sta") continue;
        const target = storageOperand(store);
        if (target === undefined) continue;
        let load = -1;
        for (let cursor = at + 1; cursor < instructions.length; cursor += 1) {
          const instruction = instructions[cursor]!;
          if (
            instruction.opcode === "ldx" &&
            storageOperand(instruction)?.requestId === target.requestId
          ) {
            load = cursor;
            break;
          }
          if (
            instruction.opcode === "jsr" ||
            instruction.defines.registers.includes("x") ||
            instruction.uses.registers.includes("x")
          )
            break;
          if (
            instruction.opcode === "sta" &&
            storageOperand(instruction)?.requestId === target.requestId
          )
            break;
        }
        if (load < 0) continue;
        const after = instructions[load + 1];
        const terminatorFlags =
          block.terminator.kind === "branch" || block.terminator.kind === "long-branch"
            ? block.terminator.uses.flags
            : [];
        const flagsDead =
          after === undefined
            ? !terminatorFlags.some((flag) => flag === "n" || flag === "z")
            : after.defines.flags.includes("n") && after.defines.flags.includes("z");
        if (instructions[load]!.noReloadFold === true) continue;
        if (!flagsDead || remove.has(load) || inserts.has(at)) continue;
        inserts.set(
          at,
          machineInstruction(
            cpu,
            "tax",
            "implied",
            null,
            [],
            store.source ?? instructions[load]!.source ?? null,
          ),
        );
        remove.add(load);
        sites.push(Object.freeze({ block: block.label, index: at }));
        spans.push(store.source ?? instructions[load]!.source!);
        savedBytes += instructions[load]!.cost.bytes - 1;
      }
      if (remove.size === 0) return block;
      const kept: MachineInstruction[] = [];
      for (let at = 0; at < instructions.length; at += 1) {
        if (remove.has(at)) continue;
        kept.push(instructions[at]!);
        const inserted = inserts.get(at);
        if (inserted !== undefined) kept.push(inserted);
      }
      return Object.freeze({ ...block, instructions: Object.freeze(kept) });
    });
    const semantic = semanticFor(fn);
    if (sites.length === 0 || semantic === undefined) return fn;
    applied.push(
      Object.freeze({
        ruleId: "cleanup.fold-register-reload",
        functions: Object.freeze([semantic]),
        changed: Object.freeze(sites),
        obligations: Object.freeze([
          Object.freeze({ kind: "source-equivalence", sites: Object.freeze(spans) }),
          Object.freeze({
            kind: "cost",
            before: Object.freeze({ component: "B", value: String(savedBytes) }),
            after: Object.freeze({ component: "B", value: "0" }),
          }),
        ]),
      }),
    );
    return Object.freeze({ ...fn, blocks: Object.freeze(blocks) });
  });
  return { functions, applied };
}

/**
 * Remove a block-entry `lda home` that only repeats the byte the sole
 * predecessor already loaded into A immediately before its branch. A, N/Z and
 * every other flag at entry are then identical, so the reload is redundant.
 */
function entryReloadForward(
  items: readonly MachineFunction[],
  semanticFor: (fn: MachineFunction) => SemanticFunction | undefined,
): { readonly functions: readonly MachineFunction[]; readonly applied: readonly AppliedRule[] } {
  const applied: AppliedRule[] = [];
  const functions = items.map((fn) => {
    const predecessors = new Map<string, string[]>();
    const add = (target: string, label: string) => {
      const list = predecessors.get(target) ?? [];
      list.push(label);
      predecessors.set(target, list);
    };
    for (const block of fn.blocks) {
      const term = block.terminator;
      if (term.kind === "branch" || term.kind === "long-branch") {
        add(term.kind === "branch" ? term.target : term.jump.target, block.label);
        add(term.fallthrough, block.label);
      } else if (term.kind === "jump" || term.kind === "fallthrough") {
        add(term.target, block.label);
      }
    }
    const sites: RuleSite[] = [];
    const spans: SourceSpan[] = [];
    let savedBytes = 0;
    const blocks = fn.blocks.map((block) => {
      const incoming = predecessors.get(block.label) ?? [];
      const load = block.instructions[0];
      const home = load === undefined ? undefined : storageOperand(load);
      if (
        incoming.length !== 1 ||
        incoming[0] === block.label ||
        load === undefined ||
        home === undefined ||
        load.opcode !== "lda" ||
        load.observerOrigins !== undefined
      )
        return block;
      const producer = fn.blocks.find((candidate) => candidate.label === incoming[0]);
      const term = producer?.terminator;
      const previous = producer?.instructions.at(-1);
      const previousHome = previous === undefined ? undefined : storageOperand(previous);
      if (
        producer === undefined ||
        previous === undefined ||
        previousHome === undefined ||
        previous.opcode !== "lda" ||
        previous.observerOrigins !== undefined ||
        previousHome.requestId !== home.requestId ||
        (previousHome.offset ?? 0) !== (home.offset ?? 0) ||
        term === undefined ||
        (term.kind !== "branch" && term.kind !== "long-branch")
      )
        return block;
      const target = term.kind === "branch" ? term.target : term.jump.target;
      if (target !== block.label && term.fallthrough !== block.label) return block;
      sites.push(Object.freeze({ block: block.label, index: 0 }));
      if (load.source !== null) spans.push(load.source);
      savedBytes += load.cost.bytes;
      return Object.freeze({
        ...block,
        instructions: Object.freeze(block.instructions.slice(1)),
      });
    });
    const semantic = semanticFor(fn);
    if (sites.length === 0 || semantic === undefined) return fn;
    applied.push(
      Object.freeze({
        ruleId: "cleanup.entry-reload",
        functions: Object.freeze([semantic]),
        changed: Object.freeze(sites),
        obligations: Object.freeze([
          Object.freeze({ kind: "source-equivalence", sites: Object.freeze(spans) }),
          Object.freeze({
            kind: "cost",
            before: Object.freeze({ component: "B", value: String(savedBytes) }),
            after: Object.freeze({ component: "B", value: "0" }),
          }),
        ]),
      }),
    );
    return Object.freeze({ ...fn, blocks: Object.freeze(blocks) });
  });
  return { functions, applied };
}

/**
 * Remove a store to a private argument stage that no candidate instruction
 * reads. Delivery forwarding can leave the stage write behind after its only
 * reload disappears; with no reader and no interrupt route the write is dead.
 */
function deadStageStores(
  program: MachineProgram,
  items: readonly MachineFunction[],
  semanticFor: (fn: MachineFunction) => SemanticFunction | undefined,
): { readonly functions: readonly MachineFunction[]; readonly applied: readonly AppliedRule[] } {
  const routes = program.storageSelection?.sourceFacts.program.interruptRoutes;
  if (routes === undefined || routes.length !== 0) return { functions: items, applied: [] };
  const reads = readHomes([program.startup, ...items]);
  const eligible = (requestId: string): boolean =>
    (requestId.includes(":argument-stage:") || requestId.includes(":retained-value:")) &&
    !reads.has(requestId);
  const applied: AppliedRule[] = [];
  const functions = items.map((fn) => {
    if (!mainline(fn)) return fn;
    const sites: RuleSite[] = [];
    const spans: SourceSpan[] = [];
    let savedBytes = 0;
    const blocks = fn.blocks.map((block) => {
      const remove = new Set<number>();
      for (let index = 0; index < block.instructions.length; index += 1) {
        const instruction = block.instructions[index]!;
        const home = storageOperand(instruction);
        if (
          home === undefined ||
          instruction.opcode !== "sta" ||
          instruction.observerOrigins !== undefined ||
          !eligible(home.requestId)
        )
          continue;
        remove.add(index);
        sites.push(Object.freeze({ block: block.label, index }));
        if (instruction.source !== null) spans.push(instruction.source);
        savedBytes += instruction.cost.bytes;
      }
      if (remove.size === 0) return block;
      return Object.freeze({
        ...block,
        instructions: Object.freeze(block.instructions.filter((_, at) => !remove.has(at))),
      });
    });
    const semantic = semanticFor(fn);
    if (sites.length === 0 || semantic === undefined) {
      // A function with no record still returns its possibly rewritten blocks.
      return sites.length === 0 ? fn : Object.freeze({ ...fn, blocks: Object.freeze(blocks) });
    }
    applied.push(
      Object.freeze({
        ruleId: "cleanup.dead-stage-store",
        functions: Object.freeze([semantic]),
        changed: Object.freeze(sites),
        obligations: Object.freeze([
          Object.freeze({ kind: "source-equivalence", sites: Object.freeze(spans) }),
          Object.freeze({
            kind: "cost",
            before: Object.freeze({ component: "B", value: String(savedBytes) }),
            after: Object.freeze({ component: "B", value: "0" }),
          }),
        ]),
      }),
    );
    return Object.freeze({ ...fn, blocks: Object.freeze(blocks) });
  });
  return { functions, applied };
}

/** Remove a register/flag write that the immediately following instruction fully overwrites. */
function deadInstruction(
  items: readonly MachineFunction[],
  semanticFor: (fn: MachineFunction) => SemanticFunction | undefined,
): { readonly functions: readonly MachineFunction[]; readonly applied: readonly AppliedRule[] } {
  const applied: AppliedRule[] = [];
  const functions = items.map((fn) => {
    const sites: RuleSite[] = [];
    const spans: SourceSpan[] = [];
    let savedBytes = 0;
    const blocks = fn.blocks.map((block) => {
      const kept: MachineInstruction[] = [];
      for (let index = 0; index < block.instructions.length; index += 1) {
        const instruction = block.instructions[index]!;
        const next = block.instructions[index + 1];
        if (
          next === undefined ||
          !DEAD_SAFE.has(instruction.opcode) ||
          instruction.observerOrigins !== undefined ||
          instruction.memory.length !== 0 ||
          instruction.source === null ||
          next.source === null
        ) {
          kept.push(instruction);
          continue;
        }
        const defines = [...instruction.defines.registers, ...instruction.defines.flags];
        if (defines.length === 0) {
          kept.push(instruction);
          continue;
        }
        const nextDefines = new Set([...next.defines.registers, ...next.defines.flags]);
        const nextUses = new Set([...next.uses.registers, ...next.uses.flags]);
        if (
          !defines.every((entry) => nextDefines.has(entry)) ||
          defines.some((entry) => nextUses.has(entry))
        ) {
          kept.push(instruction);
          continue;
        }
        sites.push(Object.freeze({ block: block.label, index }));
        spans.push(instruction.source, next.source);
        savedBytes += instruction.cost.bytes;
      }
      return Object.freeze({ ...block, instructions: Object.freeze(kept) });
    });
    const semantic = semanticFor(fn);
    if (sites.length === 0 || semantic === undefined) return fn;
    applied.push(
      Object.freeze({
        ruleId: "cleanup.dead-instruction",
        functions: Object.freeze([semantic]),
        changed: Object.freeze(sites),
        obligations: Object.freeze([
          Object.freeze({ kind: "source-equivalence", sites: Object.freeze(spans) }),
          Object.freeze({
            kind: "cost",
            before: Object.freeze({ component: "B", value: String(savedBytes) }),
            after: Object.freeze({ component: "B", value: "0" }),
          }),
        ]),
      }),
    );
    return Object.freeze({ ...fn, blocks: Object.freeze(blocks) });
  });
  return { functions, applied };
}

/**
 * Collect every request that any instruction in these functions reads directly,
 * indirectly through a pointer, or through a declared memory effect.
 * @param functions Exact machine functions to scan.
 * @returns Read request identities, never a claim about their values.
 * @example const reads = readHomes(program.functions);
 */
function readHomes(functions: readonly MachineFunction[]): ReadonlySet<string> {
  const reads = new Set<string>();
  for (const fn of functions)
    for (const block of fn.blocks)
      for (const instruction of block.instructions) {
        if (instruction.operand?.kind === "storage" && READS_STORAGE.has(instruction.opcode))
          reads.add(instruction.operand.requestId);
        // An indirect operand reads its pointer even when the opcode writes memory.
        if (instruction.operand?.kind === "indirect-y") reads.add(instruction.operand.requestId);
        for (const effect of instruction.memory)
          if (effect.address.kind === "storage") reads.add(effect.address.requestId);
      }
  return reads;
}

/**
 * Collect every private temporary home whose stored value no instruction reads.
 * This runs on the canonical draft before any representation diverges, so the
 * resulting set is the same fact for every admitted layout.
 * @param program Canonical draft machine program with its declared storage.
 * @returns Exact request identities of unread private mainline temporaries.
 * @example const homes = deadTemporaryHomes(draft);
 */
export function deadTemporaryHomes(program: MachineProgram): ReadonlySet<string> {
  const functions = [program.startup, ...program.functions];
  const reads = readHomes(functions);
  const dead = new Set<string>();
  for (const fn of functions)
    for (const block of fn.blocks)
      for (const instruction of block.instructions) {
        const store = storageAccess(instruction, "write");
        if (
          store !== null &&
          WRITES_STORAGE.has(instruction.opcode) &&
          !reads.has(store.requestId) &&
          privateMainTemporary(program, store.requestId)
        )
          dead.add(store.requestId);
      }
  return dead;
}

/**
 * Remove a store to a temporary that {@link deadTemporaryHomes} proved unread in
 * the canonical reference. The value stays exactly where the producer left it, so
 * no consumer, ABI or effect order changes; only an unobservable home write
 * disappears. A representation that unexpectedly reads the home keeps its store.
 */
function deadStore(
  facts: OptimizationFacts,
  program: MachineProgram,
  items: readonly MachineFunction[],
  semanticFor: (fn: MachineFunction) => SemanticFunction | undefined,
): { readonly functions: readonly MachineFunction[]; readonly applied: readonly AppliedRule[] } {
  const deadHomes = facts.deadHomes;
  if (deadHomes === undefined || deadHomes.size === 0) return { functions: items, applied: [] };
  const reads = readHomes(items);
  const applied: AppliedRule[] = [];
  const functions = items.map((fn) => {
    const sites: RuleSite[] = [];
    const spans: SourceSpan[] = [];
    let savedBytes = 0;
    const blocks = fn.blocks.map((block) => {
      const kept = block.instructions.filter((instruction, index) => {
        const store = storageAccess(instruction, "write");
        if (
          store === null ||
          !WRITES_STORAGE.has(instruction.opcode) ||
          instruction.observerOrigins !== undefined ||
          instruction.source === null ||
          !deadHomes.has(store.requestId) ||
          reads.has(store.requestId) ||
          !privateMainTemporary(program, store.requestId)
        )
          return true;
        sites.push(Object.freeze({ block: block.label, index }));
        spans.push(instruction.source);
        savedBytes += instruction.cost.bytes;
        return false;
      });
      return Object.freeze({ ...block, instructions: Object.freeze(kept) });
    });
    const semantic = semanticFor(fn);
    if (sites.length === 0 || semantic === undefined) return fn;
    applied.push(
      Object.freeze({
        ruleId: "cleanup.dead-store",
        functions: Object.freeze([semantic]),
        changed: Object.freeze(sites),
        obligations: Object.freeze([
          Object.freeze({ kind: "source-equivalence", sites: Object.freeze(spans) }),
          Object.freeze({
            kind: "cost",
            before: Object.freeze({ component: "B", value: String(savedBytes) }),
            after: Object.freeze({ component: "B", value: "0" }),
          }),
        ]),
      }),
    );
    return Object.freeze({ ...fn, blocks: Object.freeze(blocks) });
  });
  return { functions, applied };
}

/** Collect every label mentioned by a function's control flow or retained proofs. */
function referencedLabels(fn: MachineFunction): ReadonlySet<string> {
  const labels = new Set<string>();
  for (const block of fn.blocks) {
    for (const instruction of block.instructions)
      if (instruction.operand?.kind === "label") labels.add(instruction.operand.label);
    const terminator = block.terminator;
    if (terminator.kind === "jump" || terminator.kind === "fallthrough")
      labels.add(terminator.target);
    else if (terminator.kind === "branch") {
      labels.add(terminator.target);
      labels.add(terminator.fallthrough);
    } else if (terminator.kind === "long-branch") {
      labels.add(terminator.jump.target);
      labels.add(terminator.fallthrough);
    }
  }
  for (const [, blockLabels] of fn.observerBlocks ?? [])
    for (const label of blockLabels) labels.add(label);
  for (const proof of fn.fixedLoopProofs ?? [])
    for (const occurrence of proof.occurrences)
      for (const label of occurrence.blocks) labels.add(label);
  for (const proof of fn.nativeStoreProofs ?? []) labels.add(proof.block);
  for (const proof of fn.byteAvailabilityProofs ?? []) {
    labels.add(proof.from);
    labels.add(proof.to);
  }
  for (const proof of fn.booleanCallProofs ?? []) labels.add(proof.block);
  return labels;
}

/** Remove an empty, unreferenced fallthrough block; no emitted byte is changed. */
function emptyBlock(
  items: readonly MachineFunction[],
  semanticFor: (fn: MachineFunction) => SemanticFunction | undefined,
): { readonly functions: readonly MachineFunction[]; readonly applied: readonly AppliedRule[] } {
  const applied: AppliedRule[] = [];
  const functions = items.map((fn) => {
    const labels = referencedLabels(fn);
    const sites: RuleSite[] = [];
    const kept = fn.blocks.filter((block, index) => {
      if (
        index === 0 ||
        block.instructions.length !== 0 ||
        block.terminator.kind !== "fallthrough" ||
        block.observerBodies !== undefined ||
        labels.has(block.label)
      )
        return true;
      sites.push(Object.freeze({ block: block.label, index: 0 }));
      return false;
    });
    const semantic = semanticFor(fn);
    if (sites.length === 0 || semantic === undefined) return fn;
    applied.push(
      Object.freeze({
        ruleId: "cleanup.empty-block",
        functions: Object.freeze([semantic]),
        changed: Object.freeze(sites),
        obligations: Object.freeze([
          Object.freeze({ kind: "final-layout", sites: Object.freeze([semantic.source]) }),
        ]),
      }),
    );
    return Object.freeze({ ...fn, blocks: Object.freeze(kept) });
  });
  return { functions, applied };
}

/**
 * Apply the ordered foundation cleanup rules to already lowered machine functions.
 * Every rule proves its changed sites from the shared facts; untouched code keeps its
 * canonical form, and no rule changes storage demand, ABI or interrupt structure.
 * @param facts Immutable facts derived from the same checked source.
 * @param program Draft machine program before storage projection.
 * @returns Transformed functions and one applied-rule record per changed identity.
 */
export function applyFoundationCleanup(
  facts: OptimizationFacts,
  program: MachineProgram,
): FoundationCleanup {
  const semanticByKey = new Map(
    [...facts.functions.keys()].map(
      (fn: SemanticFunction) => [bindingIdentityKey(fn.id), fn] as const,
    ),
  );
  const semanticFor = (fn: MachineFunction) =>
    fn.sourceFunction === undefined
      ? undefined
      : semanticByKey.get(bindingIdentityKey(fn.sourceFunction));
  const eligible = program.functions.filter(
    (fn) =>
      fn.sourceFunction !== undefined &&
      semanticByKey.has(bindingIdentityKey(fn.sourceFunction)) &&
      mainline(fn),
  );
  const reloads = foldRegisterReloads(program, facts.profile.cpu, eligible, semanticFor);
  const delivery = argumentDelivery(reloads.functions, semanticFor);
  const copies = copyParameterLocals(
    delivery.functions,
    semanticFor,
    program.storageSelection?.sourceFacts.loopPolicy,
  );
  const entry = entryReloadForward(copies.functions, semanticFor);
  const forward = copyForward(program, entry.functions, semanticFor);
  const stages = deadStageStores(program, forward.functions, semanticFor);
  const stores = deadStore(facts, program, stages.functions, semanticFor);
  const dead = deadInstruction(stores.functions, semanticFor);
  const empty = emptyBlock(dead.functions, semanticFor);
  const selected = new Map(empty.functions.map((fn) => [fn.id, fn] as const));
  return Object.freeze({
    functions: Object.freeze(program.functions.map((fn) => selected.get(fn.id) ?? fn)),
    applied: mergeAppliedRules([
      ...reloads.applied,
      ...delivery.applied,
      ...copies.applied,
      ...entry.applied,
      ...forward.applied,
      ...stages.applied,
      ...stores.applied,
      ...dead.applied,
      ...empty.applied,
    ]),
  });
}

/** One rule identity is declared once even when it changed several functions. */
function mergeAppliedRules(applied: readonly AppliedRule[]): readonly AppliedRule[] {
  const merged = new Map<
    string,
    {
      readonly functions: SemanticFunction[];
      readonly changed: RuleSite[];
      readonly obligations: RuleObligation[];
    }
  >();
  for (const rule of applied) {
    const entry = merged.get(rule.ruleId) ?? {
      functions: [],
      changed: [],
      obligations: [],
    };
    for (const fn of rule.functions) if (!entry.functions.includes(fn)) entry.functions.push(fn);
    entry.changed.push(...rule.changed);
    entry.obligations.push(...rule.obligations);
    merged.set(rule.ruleId, entry);
  }
  return Object.freeze(
    [...merged.entries()].map(([ruleId, entry]) =>
      Object.freeze({
        ruleId,
        functions: Object.freeze(entry.functions),
        changed: Object.freeze(entry.changed),
        obligations: Object.freeze(entry.obligations),
      }),
    ),
  );
}

/** Flatten every obligation from one ordered cleanup result. */
export function cleanupObligations(applied: readonly AppliedRule[]): readonly RuleObligation[] {
  return Object.freeze(applied.flatMap(({ obligations }) => obligations));
}

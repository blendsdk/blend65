import { bindingIdentityKey } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import type { SemanticFunction } from "../semantic/operations.js";
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

/**
 * Whether N and Z are both overwritten before any instruction observes them.
 * A branch or return observes them; a later producer of both makes the current
 * pair dead. Other flags are not part of a byte load.
 */
function flagsDead(block: MachineFunction["blocks"][number], start: number): boolean {
  const dead = new Set<string>();
  for (const instruction of block.instructions.slice(start)) {
    const uses = instruction.uses.flags.filter((flag) => flag === "n" || flag === "z");
    if (uses.some((flag) => !dead.has(flag))) return false;
    for (const flag of instruction.defines.flags) if (flag === "n" || flag === "z") dead.add(flag);
  }
  const edge = block.terminator;
  if (edge.kind === "unreachable") return false;
  if (edge.kind === "branch" || edge.kind === "long-branch") {
    const uses = edge.uses.flags.filter((flag) => flag === "n" || flag === "z");
    if (uses.some((flag) => !dead.has(flag))) return false;
  }
  return dead.size === 2;
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
  const routes = program.storageSelection?.sourceFacts.program.interruptRoutes;
  const localForwarding = policy === "mixed" && routes?.length === 0;
  const functions = items.map((fn) => {
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
        // needs the adjacent producer proof.
        const entryForwarding =
          index === 0 && block !== fn.blocks[0] && flagsDead(block, index + 2);
        if (
          load === null ||
          load.requestId !== store.requestId ||
          load.offset !== store.offset ||
          (!entryForwarding && !provedProducer(producer, register)) ||
          !(
            privateMainTemporary(program, store.requestId) ||
            (localForwarding &&
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
          if (instruction.opcode === "jsr" || instruction.defines.registers.includes("x")) break;
          if (
            instruction.opcode === "sta" &&
            storageOperand(instruction)?.requestId === target.requestId
          )
            break;
        }
        if (load < 0) continue;
        const after = instructions[load + 1];
        const flagsDead =
          after === undefined ||
          (after.defines.flags.includes("n") && after.defines.flags.includes("z"));
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
  const delivery = argumentDelivery(facts, reloads.functions, semanticFor);
  const copies = copyParameterLocals(
    delivery.functions,
    semanticFor,
    program.storageSelection?.sourceFacts.loopPolicy,
  );
  const entry = entryReloadForward(copies.functions, semanticFor);
  const forward = copyForward(program, entry.functions, semanticFor);
  const stores = deadStore(facts, program, forward.functions, semanticFor);
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

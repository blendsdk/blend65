import type { SourceSpan } from "../project/types.js";
import type { SemanticFunction } from "../semantic/operations.js";
import type { MachineFunction, MachineInstruction } from "./machine-types.js";
import type { AppliedRule, RuleSite } from "./optimization-rules.js";

/** One direct byte store or load operand. */
function storageOperand(
  instruction: MachineInstruction,
): Extract<MachineInstruction["operand"], { readonly kind: "storage" }> | undefined {
  return instruction.operand?.kind === "storage" && instruction.operand.addressByte === undefined
    ? instruction.operand
    : undefined;
}

/** One proved local-to-parameter copy and every read it replaces. */
interface Copy {
  /** Reference copy store occurrence. */
  readonly load: MachineInstruction;
  /** Reference copy load occurrence. */
  readonly store: MachineInstruction;
  /** Local request whose reads are redirected. */
  readonly local: string;
  /** Parameter request that already holds the copied byte. */
  readonly parameter: string;
  /** Block label containing the copy pair. */
  readonly block: string;
  /** Copy load instruction index. */
  readonly index: number;
}

/**
 * Candidate-only copy propagation for a local initialized directly from a
 * parameter that is never written. The local has exactly one store and every
 * read is a direct byte load, so each read can read the parameter instead and
 * the copy pair disappears. The reference keeps the copy for the field windows.
 * @param items Candidate machine functions, already rule-cleaned.
 * @param semanticFor Source owner of one machine function.
 * @param policy Selected loop policy; only the mixed plan applies this rule.
 * @returns Rewritten functions and one applied-rule record.
 * @example copyParameterLocals(functions, semanticFor, "mixed")
 */
export function copyParameterLocals(
  items: readonly MachineFunction[],
  semanticFor: (fn: MachineFunction) => SemanticFunction | undefined,
  policy: string | undefined,
): { readonly functions: readonly MachineFunction[]; readonly applied: readonly AppliedRule[] } {
  if (policy !== "mixed") return { functions: items, applied: [] };
  const applied: AppliedRule[] = [];
  const functions = items.map((fn) => {
    const copies: Copy[] = [];
    for (const block of fn.blocks) {
      for (let at = 0; at + 1 < block.instructions.length; at += 1) {
        const load = block.instructions[at]!,
          store = block.instructions[at + 1]!;
        const source = storageOperand(load),
          target = storageOperand(store);
        if (
          load.opcode !== "lda" ||
          store.opcode !== "sta" ||
          source === undefined ||
          target === undefined ||
          !source.requestId.includes(":parameter:") ||
          !target.requestId.includes(":local:") ||
          (source.offset ?? 0) !== 0 ||
          (target.offset ?? 0) !== 0 ||
          load.observerOrigins !== undefined ||
          store.observerOrigins !== undefined
        )
          continue;
        const writes = fn.blocks.flatMap((entry) =>
          entry.instructions.filter((instruction) => {
            const operand = storageOperand(instruction);
            return operand?.requestId === target.requestId && instruction.opcode === "sta";
          }),
        );
        const reads = fn.blocks.flatMap((entry) =>
          entry.instructions.filter((instruction) => {
            const operand = storageOperand(instruction);
            return operand?.requestId === target.requestId && instruction.opcode === "lda";
          }),
        );
        const parameterWrites = fn.blocks.flatMap((entry) =>
          entry.instructions.filter((instruction) => {
            const operand = storageOperand(instruction);
            return operand?.requestId === source.requestId && instruction.opcode === "sta";
          }),
        );
        if (
          writes.length !== 1 ||
          writes[0] !== store ||
          reads.length === 0 ||
          parameterWrites.length !== 0 ||
          reads.some((instruction) => (storageOperand(instruction)?.offset ?? 0) !== 0)
        )
          continue;
        copies.push({
          load,
          store,
          local: target.requestId,
          parameter: source.requestId,
          block: block.label,
          index: at,
        });
      }
    }
    if (copies.length === 0) return fn;
    const sites: RuleSite[] = copies.map((copy) =>
      Object.freeze({ block: copy.block, index: copy.index }),
    );
    const spans: SourceSpan[] = [];
    let savedBytes = 0;
    for (const copy of copies) {
      if (copy.load.source !== null) spans.push(copy.load.source);
      if (copy.store.source !== null) spans.push(copy.store.source);
      savedBytes += copy.load.cost.bytes + copy.store.cost.bytes;
    }
    const redirect = new Map(copies.map((copy) => [copy.local, copy.parameter] as const));
    const removed = new Set(copies.flatMap((copy) => [copy.load, copy.store]));
    const blocks = fn.blocks.map((block) => {
      const instructions = block.instructions
        .filter((instruction) => !removed.has(instruction))
        .map((instruction) => {
          const operand = storageOperand(instruction);
          const parameter = operand === undefined ? undefined : redirect.get(operand.requestId);
          if (operand === undefined || parameter === undefined || instruction.opcode !== "lda")
            return instruction;
          return Object.freeze({
            ...instruction,
            operand: Object.freeze({ ...operand, requestId: parameter }),
          });
        });
      return Object.freeze({ ...block, instructions: Object.freeze(instructions) });
    });
    const semantic = semanticFor(fn);
    if (semantic === undefined) return fn;
    applied.push(
      Object.freeze({
        ruleId: "cleanup.copy-parameter-local",
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

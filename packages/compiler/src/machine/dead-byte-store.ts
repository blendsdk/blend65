import type { SourceSpan } from "../project/types.js";
import type { SemanticFunction } from "../semantic/operations.js";
import type { MachineFunction, MachineProgram } from "./machine-types.js";
import {
  privateMainTemporary,
  READS_STORAGE,
  storageAccess,
  WRITES_STORAGE,
} from "./optimization-cleanup.js";
import type { AppliedRule, RuleSite } from "./optimization-rules.js";

/** Bytes the program reads, by request and offset, and requests read as a whole. */
interface ByteReads {
  /** `requestId:offset` for every byte one instruction reads directly. */
  readonly bytes: ReadonlySet<string>;
  /** Requests read in a way that does not name one byte. */
  readonly whole: ReadonlySet<string>;
}

/**
 * Addressing modes that touch exactly the byte their operand names.
 *
 * An indexed form reaches the operand's byte plus a register, so it cannot be
 * tied to one byte of the request; `storage` is the direct form before homes
 * are bound.
 */
const DIRECT_MODES = new Set(["storage", "absolute", "zero-page"]);

/** Key naming one byte of one storage request. */
function byteKey(requestId: string, offset: number): string {
  return `${requestId}:${offset}`;
}

/**
 * Collect every storage byte any body reads.
 *
 * A direct operand names its byte. Anything that does not — an indexed form,
 * whose byte depends on a register; an indirect pointer, which reads two
 * bytes; a memory effect, whose width is recorded separately; or an operand
 * used by an instruction that is neither a plain read nor a plain store —
 * counts as reading the whole request, so no byte of it can be called unread.
 */
function byteReads(bodies: readonly MachineFunction[]): ByteReads {
  const bytes = new Set<string>();
  const whole = new Set<string>();
  for (const body of bodies)
    for (const block of body.blocks)
      for (const instruction of block.instructions) {
        const operand = instruction.operand;
        if (operand?.kind === "storage") {
          if (READS_STORAGE.has(instruction.opcode)) {
            if (DIRECT_MODES.has(instruction.mode))
              bytes.add(byteKey(operand.requestId, operand.offset ?? 0));
            else whole.add(operand.requestId);
          } else if (!WRITES_STORAGE.has(instruction.opcode)) whole.add(operand.requestId);
        }
        if (operand?.kind === "indirect-y") whole.add(operand.requestId);
        for (const effect of instruction.memory)
          if (effect.kind === "read" && effect.address.kind === "storage")
            whole.add(effect.address.requestId);
      }
  return { bytes, whole };
}

/**
 * Remove stores to single bytes of private temporaries that nothing reads.
 *
 * The request-level rule removes a store only when its whole temporary is
 * unread. A word temporary often has one live byte and one dead one: a word
 * result built in scratch whose high byte also goes straight to X, and whose
 * low byte alone is reloaded. Its high store is then work no one observes.
 * The temporary keeps its full home, so storage closure and layout are
 * unchanged; only the instruction goes.
 *
 * Only direct stores to ordinary mainline temporaries qualify, with no
 * observer association and no volatile access. The read census covers every
 * body in the program — startup, interrupt bodies and bodies this pass does
 * not rewrite included — so a byte read anywhere else stays.
 * A representation other than the reference also needs the byte to be unread
 * in the reference (`allowed`): the observers that prove a representation
 * compare it with the reference instruction for instruction, so a store must
 * never exist in one and not the other.
 * @param program Draft machine program, whose declared storage identifies temporaries.
 * @param items Functions this rule may change, in their current form.
 * @param semanticFor Source function owning a machine function, if any.
 * @param allowed Bytes unread in the reference, when this lowering is not the reference.
 * @returns The changed functions and one applied-rule record per changed function.
 * @example
 * // `sta hi / tax / lda lo / rts` loses `sta hi` when `hi` is never reloaded.
 * const { functions } = deadByteStore(program, functions, semanticFor);
 */
export function deadByteStore(
  program: MachineProgram,
  items: readonly MachineFunction[],
  semanticFor: (fn: MachineFunction) => SemanticFunction | undefined,
  allowed?: ReadonlySet<string>,
): { readonly functions: readonly MachineFunction[]; readonly applied: readonly AppliedRule[] } {
  const current = new Map(items.map((fn) => [fn.id, fn] as const));
  const reads = byteReads([
    program.startup,
    ...program.functions.map((fn) => current.get(fn.id) ?? fn),
  ]);
  const applied: AppliedRule[] = [];
  const functions = items.map((fn) => {
    const semantic = semanticFor(fn);
    if (semantic === undefined) return fn;
    const sites: RuleSite[] = [];
    const spans: SourceSpan[] = [];
    let savedBytes = 0;
    const blocks = fn.blocks.map((block) => {
      const kept = block.instructions.filter((instruction, index) => {
        const store = storageAccess(instruction, "write");
        if (
          store === null ||
          !WRITES_STORAGE.has(instruction.opcode) ||
          !DIRECT_MODES.has(instruction.mode) ||
          instruction.observerOrigins !== undefined ||
          instruction.source === null ||
          reads.whole.has(store.requestId) ||
          reads.bytes.has(byteKey(store.requestId, store.offset)) ||
          (allowed !== undefined && !allowed.has(byteKey(store.requestId, store.offset))) ||
          !privateMainTemporary(program, store.requestId)
        )
          return true;
        sites.push(Object.freeze({ block: block.label, index }));
        spans.push(instruction.source);
        savedBytes += instruction.cost.bytes;
        return false;
      });
      return kept.length === block.instructions.length
        ? block
        : Object.freeze({ ...block, instructions: Object.freeze(kept) });
    });
    if (sites.length === 0) return fn;
    applied.push(
      Object.freeze({
        ruleId: "cleanup.dead-byte-store",
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
 * Every byte of a private mainline temporary that no body of a program reads.
 *
 * Computed on the canonical reference's final lowering and handed to every
 * other representation, so they remove only stores the reference could remove.
 * @param program A finished machine program.
 * @returns `requestId:offset` keys of the unread temporary bytes.
 * @example
 * const unreadBytes = unreadTemporaryBytes(reference.lowered.program);
 */
export function unreadTemporaryBytes(program: MachineProgram): ReadonlySet<string> {
  const reads = byteReads([program.startup, ...program.functions]);
  const unread = new Set<string>();
  for (const request of program.requiredStorage) {
    if (reads.whole.has(request.id) || !privateMainTemporary(program, request.id)) continue;
    for (let offset = 0; offset < request.bytes; offset += 1)
      if (!reads.bytes.has(byteKey(request.id, offset))) unread.add(byteKey(request.id, offset));
  }
  return unread;
}

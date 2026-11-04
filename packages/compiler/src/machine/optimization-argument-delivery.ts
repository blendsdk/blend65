import type { SourceSpan } from "../project/types.js";
import type { SemanticFunction } from "../semantic/operations.js";
import type { MachineFunction, MachineInstruction, MachineOperand } from "./machine-types.js";
import type { AppliedRule, RuleSite } from "./optimization-rules.js";
import { provedProducer, READS_STORAGE } from "./optimization-cleanup.js";

/**
 * Deliver a byte argument directly from its private stage into the callee's
 * parameter home. The producer store is retargeted and the later
 * `lda stage; sta parameter` pair disappears. Only a one-byte argument whose
 * stage has this single read qualifies. The retargeted store keeps the delivery
 * store's call span so the preserved-guard proof sees a call-time parameter
 * write; the pointer-delivery windows locate their chain by identity.
 */
export function argumentDelivery(
  items: readonly MachineFunction[],
  semanticFor: (fn: MachineFunction) => SemanticFunction | undefined,
): { readonly functions: readonly MachineFunction[]; readonly applied: readonly AppliedRule[] } {
  const applied: AppliedRule[] = [];
  const functions = items.map((fn) => {
    if (fn.sourceFunction === undefined) return fn;
    const sites: RuleSite[] = [];
    const spans: SourceSpan[] = [];
    let savedBytes = 0;
    const blocks = fn.blocks.map((block) => {
      const remove = new Set<number>();
      const retarget = new Map<
        number,
        { readonly operand: MachineOperand; readonly source: SourceSpan | null }
      >();
      for (let index = 0; index < block.instructions.length; index += 1) {
        if (block.instructions[index]!.opcode !== "jsr") continue;
        const pairs: { load: number; store: number }[] = [];
        for (let cursor = index - 1; cursor >= 1; cursor -= 2) {
          const load = block.instructions[cursor - 1]!,
            store = block.instructions[cursor]!;
          const source = storageOperand(load),
            destination = storageOperand(store);
          if (
            source === undefined ||
            destination === undefined ||
            load.opcode !== "lda" ||
            store.opcode !== "sta" ||
            !destination.requestId.includes(":parameter:")
          )
            break;
          pairs.push({ load: cursor - 1, store: cursor });
        }
        const widths = new Map<string, number>();
        for (const pair of pairs) {
          const source = storageOperand(block.instructions[pair.load]!);
          const destination = storageOperand(block.instructions[pair.store]!);
          const key = `${source?.requestId ?? ""}\0${destination?.requestId ?? ""}`;
          widths.set(key, (widths.get(key) ?? 0) + 1);
        }
        for (const pair of pairs) {
          const load = block.instructions[pair.load]!,
            store = block.instructions[pair.store]!;
          const source = storageOperand(load),
            destination = storageOperand(store);
          if (
            source === undefined ||
            destination === undefined ||
            widths.get(`${source.requestId}\0${destination.requestId}`) !== 1 ||
            load.observerOrigins !== undefined ||
            store.observerOrigins !== undefined ||
            !(
              source.requestId.includes(":argument-stage:") ||
              source.requestId.includes(":retained-value:")
            )
          )
            continue;
          const reads = fn.blocks.flatMap((item) =>
            item.instructions.filter((instruction) => {
              const operand = storageOperand(instruction);
              return (
                operand?.requestId === source.requestId &&
                READS_STORAGE.has(instruction.opcode) &&
                (operand.offset ?? 0) === (source.offset ?? 0)
              );
            }),
          );
          if (reads.length !== 1) continue;
          const producer = block.instructions.findLastIndex((instruction, at) => {
            const operand = storageOperand(instruction);
            return (
              at < pair.load &&
              operand?.requestId === source.requestId &&
              instruction.opcode === "sta"
            );
          });
          if (producer < 0) continue;
          const producerInstruction = block.instructions[producer]!;
          const produced = storageOperand(producerInstruction);
          if (
            produced === undefined ||
            (produced.offset ?? 0) !== (source.offset ?? 0) ||
            producerInstruction.observerOrigins !== undefined ||
            !provedProducer(block.instructions[producer - 1], "a") ||
            remove.has(producer) ||
            remove.has(pair.load) ||
            remove.has(pair.store) ||
            retarget.has(producer) ||
            block.instructions.slice(producer + 1, pair.store).some((instruction) => {
              const operand = storageOperand(instruction);
              return (
                operand?.requestId === destination.requestId &&
                instruction.opcode === "sta" &&
                (operand.offset ?? 0) === (destination.offset ?? 0)
              );
            })
          )
            continue;
          retarget.set(
            producer,
            Object.freeze({
              operand: Object.freeze({
                kind: "storage",
                requestId: destination.requestId,
                offset: destination.offset ?? 0,
              }),
              // The write to the callee parameter home is part of the call
              // delivery, so it carries the call's source span.
              source: store.source,
            }),
          );
          remove.add(pair.load);
          remove.add(pair.store);
          sites.push(
            Object.freeze({ block: block.label, index: pair.load }),
            Object.freeze({ block: block.label, index: pair.store }),
          );
          spans.push(producerInstruction.source ?? load.source!, load.source!, store.source!);
          savedBytes += load.cost.bytes + store.cost.bytes;
        }
      }
      if (remove.size === 0) return block;
      return Object.freeze({
        ...block,
        instructions: Object.freeze(
          block.instructions.flatMap((instruction, at) => {
            if (remove.has(at)) return [];
            const change = retarget.get(at);
            return [
              change === undefined
                ? instruction
                : Object.freeze({
                    ...instruction,
                    operand: change.operand,
                    ...(change.source === null ? {} : { source: change.source }),
                  }),
            ];
          }),
        ),
      });
    });
    const semantic = semanticFor(fn);
    if (sites.length === 0 || semantic === undefined) return fn;
    applied.push(
      Object.freeze({
        ruleId: "cleanup.argument-delivery",
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

/** One direct storage operand, ignoring byte-split address forms. */
function storageOperand(
  instruction: MachineInstruction,
): Extract<MachineOperand, { readonly kind: "storage" }> | undefined {
  return instruction.operand?.kind === "storage" && instruction.operand.addressByte === undefined
    ? instruction.operand
    : undefined;
}

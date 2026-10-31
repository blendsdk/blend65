import { encodeComptimeScalar } from "../frontend/constant-bytes.js";
import { semanticTypesEqual } from "../frontend/semantic-type-relations.js";
import type { SemanticType } from "../frontend/semantic-types.js";
import type { MachineBlock } from "../machine/machine-types.js";
import type { SemanticBlock } from "../semantic/operations.js";
import type { ResidualFailure } from "./size-observer-raw-layout.js";

/**
 * Match a checked one-byte constant return to an existing shared LDA/RTS fragment.
 * The parent owns source associations, invocation context and the alias resolver.
 * Only empty same-PC fallthrough aliases are transparent; an extra instruction or
 * JMP still needs its own proof. Shared materialization keeps the function's span,
 * so it must not be compared with one particular return branch's span.
 *
 * Type and mathematical range are checked before encoding. The existing encoder
 * deliberately wraps values, which cannot turn malformed source evidence into a
 * valid return. Enum width follows its byte-backed nominal type, not integer facts.
 *
 * @param source Exact source block already associated with this actual construction.
 * @param resultType Checked function result type, including nominal enum identity.
 * @param block Actual source block that transfers to the shared return fragment.
 * @param endpoint Already resolved actual terminal label.
 * @param actual Complete actual caller blocks; never a different construction's map.
 * @param canonicalTarget Parent's checked acyclic, empty same-PC alias resolver.
 * @returns Whether only this typed return fragment is proved; never tuple acceptance.
 * @example const shared = isOriginalSharedByteReturn(source, resultType, block, endpoint, actual, canonicalTarget);
 */
export function isOriginalSharedByteReturn(
  source: SemanticBlock,
  resultType: SemanticType,
  block: MachineBlock,
  endpoint: string,
  actual: ReadonlyMap<string, MachineBlock>,
  canonicalTarget: (label: string) => string | ResidualFailure,
): boolean {
  const edge = source.terminator;
  const constant = source.operations.length === 1 ? source.operations[0] : undefined;
  if (edge.kind !== "return" || constant?.kind !== "constant" || constant.result !== edge.value)
    return false;
  const value = constant.value;
  const type = constant.type;
  if (typeof value !== "boolean" && typeof value !== "bigint") return false;
  if (type.kind === "enum") {
    if (typeof value !== "bigint" || value < 0n || value > 255n) return false;
  } else if (type.kind === "scalar") {
    if (type.name === "boolean") {
      if (typeof value !== "boolean") return false;
    } else if (type.name === "byte" || type.name === "sbyte") {
      const signed = type.name === "sbyte";
      if (
        typeof value !== "bigint" ||
        value < (signed ? -128n : 0n) ||
        value > (signed ? 127n : 255n)
      )
        return false;
    } else return false;
  } else return false;
  if (!semanticTypesEqual(type, resultType)) return false;
  const encoded = encodeComptimeScalar(value, type);
  const terminal = actual.get(endpoint);
  const load = terminal?.instructions[0];
  return (
    block.instructions.length === 0 &&
    block.terminator.kind === "fallthrough" &&
    canonicalTarget(block.label) === endpoint &&
    terminal?.terminator.kind === "return" &&
    terminal.terminator.opcode === "rts" &&
    terminal.instructions.length === 1 &&
    load?.opcode === "lda" &&
    load.mode === "immediate" &&
    load.memory.length === 0 &&
    load.operand?.kind === "immediate" &&
    load.operand.value === encoded[0]
  );
}

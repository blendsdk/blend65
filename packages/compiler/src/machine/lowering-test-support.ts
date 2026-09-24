import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import type { SourceSpan } from "../project/types.js";
import type {
  SemanticBlock,
  SemanticFunction,
  SemanticOperation,
  SemanticProgram,
  SemanticTerminator,
  StorageValue,
} from "../semantic/operations.js";
import type { ValueLifetime, WholeProgram } from "../semantic/whole-program.js";
import { allocateStorage } from "../storage/allocate.js";
import { buildInterference } from "../storage/interference.js";
import { inventoryStorage } from "../storage/inventory.js";
import { selectTargetProfile } from "../target/profile.js";
import { lowerMachineProgram } from "./lower.js";
import type { MachineInstruction } from "./machine-types.js";

export const BYTE: SemanticType = Object.freeze({ kind: "scalar", name: "byte" });
export const BOOLEAN: SemanticType = Object.freeze({ kind: "scalar", name: "boolean" });
export const WORD: SemanticType = Object.freeze({ kind: "scalar", name: "word" });
export const VOID: SemanticType = Object.freeze({ kind: "scalar", name: "void" });
export const BYTE_PAIR: SemanticType = Object.freeze({
  kind: "array",
  element: BYTE,
  length: 2,
  size: 2,
});

export function sourceSpan(start: number): SourceSpan {
  return Object.freeze({ sourceId: "src/machine-impl.blend", start, end: start + 1 });
}

export function sourceBinding(start: number): BindingId {
  return Object.freeze({ sourceId: "src/machine-impl.blend", span: sourceSpan(start) });
}

export function sourceParameter(start: number, type: SemanticType): StorageValue {
  return Object.freeze({ id: sourceBinding(start), type });
}

export function semanticBlock(
  id: string,
  operations: readonly SemanticOperation[],
  terminator: SemanticTerminator,
): SemanticBlock {
  return Object.freeze({ id, operations: Object.freeze(operations), terminator });
}

export function semanticFunction(
  start: number,
  name: string,
  parameters: readonly StorageValue[],
  result: SemanticType,
  blocks: readonly SemanticBlock[],
): SemanticFunction {
  return Object.freeze({
    id: sourceBinding(start),
    name,
    parameters: Object.freeze(parameters),
    result,
    entry: blocks[0]!.id,
    blocks: Object.freeze(blocks),
    source: sourceSpan(start),
  });
}

export function wholeProgramFor(
  functions: readonly SemanticFunction[],
  lifetimes: readonly ValueLifetime[] = [],
): WholeProgram {
  const main = functions[0]!;
  const semantic: SemanticProgram = Object.freeze({
    main: main.id,
    globals: Object.freeze([]),
    functions: Object.freeze(functions),
    assets: Object.freeze([]),
    initializerOrder: Object.freeze([]),
  });
  return Object.freeze({
    semantic,
    roots: Object.freeze([
      Object.freeze({ kind: "startup" as const }),
      Object.freeze({ kind: "main" as const, function: main.id }),
    ]),
    callGraph: Object.freeze(
      functions.map((fn) =>
        Object.freeze({
          function: fn.id,
          callees: Object.freeze(
            fn.blocks.flatMap(({ operations }) =>
              operations.flatMap((operation) =>
                operation.kind === "call" ? [operation.callee] : [],
              ),
            ),
          ),
        }),
      ),
    ),
    effects: Object.freeze([]),
    lifetimes: Object.freeze(lifetimes),
    reachableFunctions: Object.freeze(functions.map(({ id }) => id)),
    reachableAssets: Object.freeze([]),
  });
}

/** Lower a small semantic fixture with the selected inline array-safety option. */
export function lowerFunctions(
  functions: readonly SemanticFunction[],
  lifetimes: readonly ValueLifetime[] = [],
  boundsCheck = false,
) {
  const program = wholeProgramFor(functions, lifetimes);
  const profile = selectedProfile();
  const inventory = inventoryStorage(program);
  const allocation = allocateStorage(inventory, buildInterference(inventory), profile.storage);
  if (allocation.kind !== "complete") throw new Error("Expected provisional storage allocation");
  return lowerMachineProgram({ program, placement: allocation.placement, profile, boundsCheck });
}

export function loadOperation(
  result: string,
  value: StorageValue,
  start: number,
): SemanticOperation {
  return Object.freeze({
    kind: "load",
    result,
    type: value.type,
    integer: null,
    place: Object.freeze({ root: value.id, path: Object.freeze([]) }),
    span: sourceSpan(start),
  });
}

export function selectedProfile() {
  const result = selectTargetProfile("c64-pal-prg-kernal-6581");
  if (result.kind !== "complete") throw new Error("Expected selected profile");
  return result.profile;
}

export function state(
  registers: readonly ("a" | "x" | "y" | "s")[] = [],
  flags: readonly ("n" | "v" | "d" | "i" | "z" | "c")[] = [],
) {
  return Object.freeze({ registers: Object.freeze(registers), flags: Object.freeze(flags) });
}

export function nop(): MachineInstruction {
  return Object.freeze({
    opcode: "nop",
    mode: "implied",
    operand: null,
    uses: state(),
    defines: state(),
    memory: Object.freeze([]),
    cost: Object.freeze({ bytes: 1, minCycles: 2, maxCycles: 2 }),
    source: null,
  });
}

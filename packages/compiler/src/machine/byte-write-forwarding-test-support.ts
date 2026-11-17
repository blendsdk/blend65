import { fileURLToPath } from "node:url";
import { analyzeProjectOverlay, loadProject } from "../frontend/index.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import { buildSemanticProgram } from "../semantic/lower.js";
import type {
  BinaryOperation,
  MemoryWriteOperation,
  SemanticBlock,
  SemanticFunction,
  SemanticOperation,
} from "../semantic/operations.js";
import { closeWholeProgram } from "../semantic/whole-program.js";
import { selectTargetProfile } from "../target/profile.js";
import { selectAnonymousByteWriteValues } from "./byte-write-forwarding.js";
import type { MachineLoweringInput } from "./machine-types.js";

const body = "let counter:byte=0; while(true){poke($D005,counter+21);counter+=1;}";

/** A runtime counter keeps the tested sum distinct from a compile-time constant write. */
export const sourceText = `module Main; function main():void{${body}}`;

/** Close real source so observer facts come from the compiler's public analysis stages. */
export async function fixture(text?: string) {
  const loaded = await loadProject({
    project: fileURLToPath(
      new URL("../../../../examples/boing-ball/blend65.json", import.meta.url),
    ),
  });
  if (loaded.kind !== "success") throw new Error("Could not load the boing project");
  const analysis = await analyzeProjectOverlay(
    loaded.snapshot,
    text === undefined ? [] : [{ sourceId: "src/main.blend", text }],
  );
  if (analysis.kind !== "complete") throw new Error("Source analysis did not complete");
  const semantic = buildSemanticProgram(analysis);
  if (semantic.kind !== "complete") throw new Error("Semantic construction did not complete");
  const selected = selectTargetProfile("c64-pal-prg-kernal-6581");
  if (selected.kind !== "complete") throw new Error("Target profile is unavailable");
  const closed = closeWholeProgram(
    semantic.program,
    selected.profile.interrupts,
    selected.profile.storage,
  );
  if (closed.kind !== "complete") throw new Error("Whole-program closure did not complete");
  const input: MachineLoweringInput = { program: closed.program, profile: selected.profile };
  const source = closed.program.semantic.functions.find(
    (fn) => bindingIdentityKey(fn.id) === bindingIdentityKey(closed.program.semantic.main),
  );
  if (!source) throw new Error("Closed source has no main function");
  // Negative tests may remove adjacency or change the operator. Keep the original
  // candidate identity so their setup does not require the very premise they vary.
  return { input, source, candidate: witness(source).operation.result };
}

/** Real closed input paired with its actual main, before a test-owned semantic mutation. */
export type Fixture = Awaited<ReturnType<typeof fixture>>;

/** Locate the source's explicit byte addition and its immediately following device write. */
export function witness(source: SemanticFunction) {
  for (const block of source.blocks) {
    for (const [index, operation] of block.operations.entries()) {
      const write = block.operations[index + 1];
      if (
        operation.kind === "binary" &&
        operation.operator === "+" &&
        write?.kind === "memory-write" &&
        write.value === operation.result
      )
        return { block, index, operation, write };
    }
  }
  throw new Error("Fixture has no adjacent arithmetic/write witness");
}

/** Keep source/program identity consistent while deliberately varying one semantic premise. */
export function replaceBlocks(base: Fixture, blocks: readonly SemanticBlock[]): Fixture {
  const source = { ...base.source, blocks };
  return {
    ...base,
    source,
    input: {
      ...base.input,
      program: {
        ...base.input.program,
        semantic: {
          ...base.input.program.semantic,
          functions: base.input.program.semantic.functions.map((fn) =>
            fn === base.source ? source : fn,
          ),
        },
      },
    },
  };
}

/** Replace only the witness block; other source and execution metadata remain intact. */
export function alter(
  base: Fixture,
  transform: (
    operations: readonly SemanticOperation[],
    producer: BinaryOperation,
    write: MemoryWriteOperation,
    index: number,
  ) => readonly SemanticOperation[],
): Fixture {
  const found = witness(base.source);
  return replaceBlocks(
    base,
    base.source.blocks.map((block) =>
      block === found.block
        ? {
            ...block,
            operations: transform(block.operations, found.operation, found.write, found.index),
          }
        : block,
    ),
  );
}

/** Supply one deliberately narrow use set without hiding the selector's independent count. */
export function select(
  base: Fixture,
  allowed: ReadonlySet<string> = new Set([base.candidate]),
): ReadonlySet<string> {
  return selectAnonymousByteWriteValues(base.input, base.source, base.source.blocks, allowed);
}

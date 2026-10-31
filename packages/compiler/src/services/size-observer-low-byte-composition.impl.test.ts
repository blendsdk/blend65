import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import type { MachineFunction, MachineInstruction } from "../machine/machine-types.js";
import type { SemanticOperation } from "../semantic/operations.js";
import { body, side } from "./size-observer-complement-field-layout.js";
import { validateComposedLowByte } from "./size-observer-low-byte-composition.js";
import { matchLowByteOccurrences } from "./size-observer-low-byte-occurrences.js";
import { validateResidualEffects } from "./size-observer-effects.js";
import { validateByteComplementObservers } from "./size-observer-byte-complements.js";
import { validateFieldComplements } from "./size-observer-complement-fields.js";
import { validateSizeObservers } from "./size-observers.js";

const savedSource = readFileSync(
  new URL("../../../../test/rd05/fixtures/input-saved-caller.blend", import.meta.url),
  "utf8",
);

/** A direct main call gives both proof owners the same four delivery removals. */
const DIRECT_MAIN = `module Game;struct Cell{rows:byte[8];value:byte;}
let cell:Cell={rows:[;3],value:7};let observed:boolean=false;
function work(p:const Cell,salt:byte):boolean{
  let inverse:byte=~p.value;if(salt==255){return false;}
  for(let i:word=0;i<8;i+=1){let left:byte=p.rows[i];if(left==0){return false;}
    for(let j:word=i+1;j<8;j+=1){if((~p.rows[j]&~inverse)==0){return false;}}}
  return true;
}
function main():void{observed=work(cell,1);poke($C100,7);}`;

describe("composed memory-counter observer closure", () => {
  it.each([false, true])(
    "should reject indexed frame bytes before publishing counter premises with bounds=%s",
    (bounds) => {
      const input = effectFixture(savedSource, "size", bounds, "low-byte");
      const group = validateComposedLowByte(input);
      if (group === null || "kind" in group) throw new Error("Expected the actual positive group");
      const packets = input.candidate.lowered.program.storageSelection!.sourceFacts.functions;
      for (const selected of [false, true]) {
        const shared = selected ? input.candidate.shared : input.reference.shared;
        const functions = selected
          ? input.candidate.lowered.program.functions
          : input.reference.checked.lowered.program.functions;
        for (const [source, changes] of group.functions) {
          const pair = body(side(shared, functions), source.id, source);
          if (pair === null) throw new Error("Expected the actual counter body");
          for (const { proof } of changes.counters.values()) {
            const loop = proof.loop;
            const operations: SemanticOperation[] = [
              loop.initialization,
              loop.comparison,
              loop.increment,
              loop.updateStore,
            ];
            if (loop.initial.kind === "parent-next") {
              const sum = source.blocks
                .flatMap((block) => block.operations)
                .find(
                  (operation) =>
                    "result" in operation && operation.result === loop.initialization.value,
                );
              if (sum === undefined) throw new Error("Expected parent-next temporary arithmetic");
              operations.push(sum);
            }
            for (const operation of operations) {
              const targets = pair.items.filter(
                (item) =>
                  item.source.source === operation.span &&
                  item.source.operand?.kind === "storage" &&
                  item.source.operand.addressByte === undefined &&
                  ["lda", "sta", "adc", "inc"].includes(item.source.opcode),
              );
              // Selected INC represents the whole update; its increment operation has no separate bytes.
              if (selected && operation === loop.increment && targets.length === 0) continue;
              expect(targets.length).toBeGreaterThan(0);
              for (const target of targets) {
                expect(["absolute", "zero-page"]).toContain(target.instruction.mode);
                let edits = 0;
                const corrupt = (values: readonly MachineFunction[]) =>
                  values.map((fn) =>
                    fn.sourceFunction !== source.id
                      ? fn
                      : {
                          ...fn,
                          blocks: fn.blocks.map((block) =>
                            block.label !== target.block.label
                              ? block
                              : {
                                  ...block,
                                  instructions: block.instructions.map(
                                    (item, index): MachineInstruction => {
                                      if (index !== target.index) return item;
                                      edits += 1;
                                      return {
                                        ...item,
                                        mode:
                                          target.instruction.mode === "zero-page"
                                            ? "zero-page-x"
                                            : "absolute-x",
                                      };
                                    },
                                  ),
                                },
                          ),
                        },
                  );
                const changedShared = {
                  ...shared,
                  layout: {
                    ...shared.layout,
                    program: {
                      ...shared.layout.program,
                      functions: corrupt(shared.layout.program.functions),
                    },
                  },
                };
                const changedFunctions = corrupt(functions);
                expect(edits).toBe(2);
                const rebound = body(side(changedShared, changedFunctions), source.id, source);
                expect(rebound).not.toBeNull();
                if (rebound === null) throw new Error("Expected unchanged counter geometry");
                const changed = selected
                  ? {
                      ...input,
                      candidate: {
                        ...input.candidate,
                        shared: changedShared,
                        lowered: {
                          ...input.candidate.lowered,
                          program: {
                            ...input.candidate.lowered.program,
                            functions: changedFunctions,
                          },
                        },
                      },
                    }
                  : {
                      ...input,
                      reference: {
                        ...input.reference,
                        shared: changedShared,
                        checked: {
                          ...input.reference.checked,
                          lowered: {
                            ...input.reference.checked.lowered,
                            program: {
                              ...input.reference.checked.lowered.program,
                              functions: changedFunctions,
                            },
                          },
                        },
                      },
                    };
                const label = `${selected}/${source.name}/${operation.kind}/${target.index}`;
                // The occurrence owner must reject the mutation before any claim,
                // independently of whether another owner's proof also refuses it.
                expect
                  .soft(
                    matchLowByteOccurrences(
                      changed,
                      packets.get(source)!,
                      pair,
                      rebound,
                      new Map(),
                    ),
                    `${label} direct`,
                  )
                  .toBe("Composed frame data reference needs an unindexed byte proof");
                const result = validateComposedLowByte(changed);
                const outcome =
                  result === null
                    ? "outside-class"
                    : "kind" in result
                      ? `${result.kind}:${result.reason}`
                      : "accepted-group";
                expect.soft(outcome, label).toMatch(/^rejected:/);
              }
            }
          }
        }
      }
    },
  );

  it.each([false, true])(
    "should reject missing, partial, stale and wrong-class composition with bounds=%s",
    (bounds) => {
      const input = effectFixture(savedSource, "size", bounds, "low-byte");
      const effects = validateResidualEffects(input);
      if (effects.kind !== "complete") throw new Error(effects.reason);
      expect(validateByteComplementObservers(input, effects)).toBeNull();
      const { lowByteComposition, ...withoutComposition } = effects;
      if (lowByteComposition === undefined) throw new Error("Expected the actual composed group");
      const fn = input.candidate.lowered.program.functions.find(
        (fn) => (fn.byteComplementProofs?.length ?? 0) > 0,
      )!;
      const source = [...lowByteComposition.functions.keys()].find(
        (source) => source.id === fn.sourceFunction,
      )!;
      const record = lowByteComposition.functions.get(source)!;
      for (const fault of [
        "missing-group",
        "missing-function",
        "missing-loop",
        "stale-context",
      ] as const) {
        const functions = new Map(lowByteComposition.functions),
          loops = new Set(lowByteComposition.loops);
        if (fault === "missing-function") functions.delete(source);
        if (fault === "missing-loop") loops.delete([...loops][0]!);
        if (fault === "stale-context") functions.set(source, { ...record, after: record.before });
        const changed =
          fault === "missing-group"
            ? withoutComposition
            : { ...effects, lowByteComposition: { ...lowByteComposition, functions, loops } };
        expect(validateByteComplementObservers(input, changed)?.kind, fault).toBe("rejected");
      }
      for (const fault of ["cache", "mixed"] as const) {
        const functions = input.candidate.lowered.program.functions.map(
          (entry): MachineFunction =>
            entry !== fn
              ? entry
              : {
                  ...entry,
                  byteComplementProofs:
                    fault === "cache"
                      ? entry.byteComplementProofs!.map((proof) => ({ ...proof, kind: "cache" }))
                      : [
                          ...entry.byteComplementProofs!,
                          { ...entry.byteComplementProofs![0]!, kind: "cache" },
                        ],
                },
        );
        const changed = {
          ...input,
          candidate: {
            ...input.candidate,
            lowered: {
              ...input.candidate.lowered,
              program: { ...input.candidate.lowered.program, functions },
            },
          },
        };
        expect(validateByteComplementObservers(changed, effects)?.kind, fault).toBe("rejected");
      }
    },
  );

  it.each([false, true])(
    "should reject missing and duplicate entry loads in either layout with bounds=%s",
    (bounds) => {
      const input = effectFixture(savedSource, "size", bounds, "low-byte");
      const effects = validateResidualEffects(input);
      if (effects.kind !== "complete") throw new Error(effects.reason);
      const selected = input.candidate.lowered.program.functions.find(
        (fn) => (fn.byteComplementProofs?.length ?? 0) > 0,
      )!;
      const facts = input.candidate.lowered.program.storageSelection!.sourceFacts;
      const packet = [...facts.functions.values()].find(
        (packet) => packet.function.id === selected.sourceFunction,
      )!;
      const recipe = selected.byteComplementProofs![0]!.selection![1];
      expect(validateFieldComplements(input, effects, selected, packet)).toBeNull();
      for (const reference of [true, false])
        for (const fault of ["missing", "duplicate"] as const) {
          const shared = reference ? input.reference.shared : input.candidate.shared;
          let edits = 0;
          const functions = shared.layout.program.functions.map((fn) =>
            fn.sourceFunction !== packet.function.id
              ? fn
              : {
                  ...fn,
                  blocks: fn.blocks.map((block) => {
                    const at = block.instructions.findIndex((item) =>
                      item.observerOrigins?.some(
                        (origin) =>
                          origin.kind === "typed" &&
                          origin.operation === recipe.load &&
                          origin.position === 0 &&
                          origin.length === 1,
                      ),
                    );
                    if (at < 0) return block;
                    const origins = block.instructions[at]!.observerOrigins!;
                    return {
                      ...block,
                      instructions: block.instructions.map((item, index) => {
                        if (index !== at + (fault === "missing" ? 0 : 1)) return item;
                        edits += 1;
                        return { ...item, observerOrigins: fault === "missing" ? [] : origins };
                      }),
                    };
                  }),
                },
          );
          expect(edits, fault).toBe(1);
          const changedShared = {
            ...shared,
            layout: { ...shared.layout, program: { ...shared.layout.program, functions } },
          };
          const changed = reference
            ? { ...input, reference: { ...input.reference, shared: changedShared } }
            : { ...input, candidate: { ...input.candidate, shared: changedShared } };
          expect(
            validateFieldComplements(changed, effects, selected, packet),
            `${reference}/${fault}`,
          ).toBe("Original field read or inverse occupancy is incomplete");
        }
    },
  );

  it.each([false, true])(
    "should merge only identical main delivery removals with bounds=%s",
    (bounds) => {
      const input = effectFixture(DIRECT_MAIN, "size", bounds, "low-byte");
      const effects = validateResidualEffects(input);
      if (effects.kind !== "complete") throw new Error(effects.reason);
      expect(validateByteComplementObservers(input, effects)).toBeNull();
      expect(validateSizeObservers(input).kind).toBe("complete");
      const group = effects.lowByteComposition;
      if (group === undefined) throw new Error("Expected the real direct-main composition");
      const main = [...group.functions.keys()].find(
        (source) => source.id === input.checked.program.semantic.main,
      )!;
      const changes = group.functions.get(main)!;
      expect(changes.removed.size).toBe(4);
      const from = [...changes.removed][0]!,
        target = [...group.functions.values()].find((record) => record.source !== main)!;
      const replacement = new Map(changes.replacements);
      replacement.set(from, JSON.stringify([target.after.id, target.after.blocks[0]!.label, 0]));
      const functions = new Map(group.functions);
      functions.set(main, { ...changes, replacements: replacement });
      expect(
        validateByteComplementObservers(input, {
          ...effects,
          lowByteComposition: { ...group, functions },
        })?.kind,
      ).toBe("rejected");
    },
  );

  it.each([false, true])(
    "should retain rejection of source processor-state observation with bounds=%s",
    (bounds) => {
      expect(
        validateSizeObservers(effectFixture(savedSource, "size", bounds, "low-byte")).kind,
      ).toBe("complete");
      const source = savedSource.replace(
        "  poke($C103, keyResult);",
        "  asm_php(); asm_plp();\n  poke($C103, keyResult);",
      );
      expect(source).not.toBe(savedSource);
      const input = effectFixture(source, "size", bounds, "low-byte");
      expect(input.reference.kind).toBe("feasible");
      expect(validateSizeObservers(input).kind).toBe("rejected");
    },
  );

  it.each([false, true])("should close the actual Saved LowByte group with bounds=%s", (bounds) => {
    const input = effectFixture(savedSource, "size", bounds, "low-byte");
    const functions = input.candidate.lowered.program.functions.filter(
      (fn) => (fn.fixedCounterProofs?.length ?? 0) > 0,
    );
    expect(functions).toHaveLength(3);
    const proofs = functions.flatMap((fn) => fn.fixedCounterProofs ?? []);
    expect(proofs).toHaveLength(4);
    expect(proofs.every((proof) => proof.representation === "low-byte")).toBe(true);
    expect(proofs.some((proof) => proof.loop.initial.kind === "parent-next")).toBe(true);
    expect(input.reference.kind).toBe("feasible");
    expect(validateSizeObservers(effectFixture(savedSource, "size", bounds, "original")).kind).toBe(
      "complete",
    );
    const outcome = validateSizeObservers(input);
    expect(outcome.kind, outcome.kind === "complete" ? "" : outcome.reason).toBe("complete");
  });
});

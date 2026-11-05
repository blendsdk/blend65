import { describe, expect, it } from "vitest";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import { validateSizeObservers } from "./size-observers.js";
import { validateSelectedLoops } from "./size-observer-selected-loops.js";
import { physical, side, view } from "./size-observer-selected-loop-layout.js";
import type {
  FixedCounterProof,
  MachineFunction,
  MachineInstruction,
} from "../machine/machine-types.js";
import type { StorageRequest } from "../storage/storage-types.js";
import type { FinalObserverInput } from "./size-observers.js";

/** Real independently lowered and closed reference/selected constructions. */
type Fixture = ReturnType<typeof effectFixture>;
/** Mutations always identify which independently resolved construction they damage. */
type Construction = "before" | "after";
/** The exact five source roles, not generated-label naming patterns. */
type Role = "entry" | "test" | "body" | "update" | "exit";

/** Ordinary source exercises truncation without exposing the private word counter. */
const SUM_SOURCE = `module Game;let answer:byte;
function work():void{for(let i:word=0;i<4;i+=1){answer+=byte(i);}}
function main():void{work();}`;

/** Source variations share semantics, not a source recognizer in the observer. */
function source(body: string, limit = 4, suffix = ""): string {
  return `module Game;let answer:byte;function work():void{for(let i:word=0;i<${limit};i+=1){${body}}}function main():void{work();${suffix}}`;
}

/** Use actual producer records to recover the source owner and representation. */
function selected(input: Fixture) {
  const fn = input.candidate.lowered.program.functions.find(
    (fn) => fn.fixedCounterProofs?.length === 1,
  );
  const proof = fn?.fixedCounterProofs?.[0];
  if (fn === undefined || proof === undefined) throw new Error("Expected a real selected counter");
  return { fn, proof, owner: proof.loop.function.id, loop: proof.loop };
}

/** Replace a real function on both symbolic/final sides without minting new provenance. */
function withFunction(
  input: Fixture,
  construction: Construction,
  change: (fn: MachineFunction, physical: boolean) => MachineFunction,
): Fixture {
  const lowered =
    construction === "before" ? input.reference.checked.lowered : input.candidate.lowered;
  const shared = construction === "before" ? input.reference.shared : input.candidate.shared;
  const next = {
    ...lowered,
    program: {
      ...lowered.program,
      functions: lowered.program.functions.map((fn) => change(fn, false)),
    },
  };
  const output = {
    ...shared,
    layout: {
      ...shared.layout,
      program: {
        ...shared.layout.program,
        functions: shared.layout.program.functions.map((fn) => change(fn, true)),
      },
    },
  };
  return construction === "before"
    ? {
        ...input,
        reference: {
          ...input.reference,
          checked: { ...input.reference.checked, lowered: next },
          shared: output,
        },
      }
    : { ...input, candidate: { lowered: next, shared: output } };
}

/** Change one exact source role rather than guessing a block from its label. */
function withInstruction(
  input: Fixture,
  construction: Construction,
  role: Role,
  index: number,
  change: (item: MachineInstruction, physical: boolean) => MachineInstruction,
): Fixture {
  const { owner, loop } = selected(input);
  const roles = {
    entry: loop.preheader,
    test: loop.header,
    body: loop.body,
    update: loop.update,
    exit: loop.exit,
  };
  return withFunction(input, construction, (fn, physical) => {
    if (fn.sourceFunction !== owner) return fn;
    const label = fn.observerBlocks?.find(([block]) => block === roles[role])?.[1][0];
    return {
      ...fn,
      blocks: fn.blocks.map((block) =>
        block.label === label
          ? {
              ...block,
              instructions: block.instructions.map((item, ordinal) =>
                ordinal === index ? change(item, physical) : item,
              ),
            }
          : block,
      ),
    };
  });
}

/** Damaged records must fail the focused semantic proof, not merely outer receipt checks. */
function withProof(
  input: Fixture,
  change: (proof: FixedCounterProof) => FixedCounterProof,
): Fixture {
  const { fn } = selected(input);
  return {
    ...input,
    candidate: {
      ...input.candidate,
      lowered: {
        ...input.candidate.lowered,
        program: {
          ...input.candidate.lowered.program,
          functions: input.candidate.lowered.program.functions.map((item) =>
            item === fn
              ? { ...item, fixedCounterProofs: item.fixedCounterProofs!.map(change) }
              : item,
          ),
        },
      },
    },
  };
}

/** Corrupt one actual inventory premise without changing another construction's demand. */
function withRequest(
  input: Fixture,
  construction: Construction,
  id: string,
  change: (request: StorageRequest) => StorageRequest,
): Fixture {
  const shared = construction === "before" ? input.reference.shared : input.candidate.shared;
  const output = {
    ...shared,
    certificate: {
      ...shared.certificate,
      inventory: {
        ...shared.certificate.inventory,
        requests: shared.certificate.inventory.requests.map((request) =>
          request.id === id ? change(request) : request,
        ),
      },
    },
  };
  return construction === "before"
    ? { ...input, reference: { ...input.reference, shared: output } }
    : { ...input, candidate: { ...input.candidate, shared: output } };
}

/** Check the intended focused boundary and the independent outer authentication boundary. */
function invalid(input: Fixture, reason: string): void {
  const result = validateSelectedLoops(input);
  expect("kind" in result ? result : null).toMatchObject({ kind: "rejected", reason });
  expect(validateSizeObservers(input).kind).toBe("error");
}

describe("final selected LowByte observers", () => {
  it.each([true, false])("should close the actual scalar loop with bounds=%s", (bounds) => {
    const input = effectFixture(SUM_SOURCE, "size", bounds, "low-byte");
    const proofs = input.candidate.lowered.program.functions.flatMap(
      (fn) => fn.fixedCounterProofs ?? [],
    );
    expect(proofs).toHaveLength(1);
    expect(proofs[0]).toMatchObject({ representation: "low-byte", firstTestElided: false });
    const result = validateSizeObservers(input);
    expect(result.kind, result.kind === "complete" ? "" : result.reason).toBe("complete");
  });

  describe.each(["answer+=byte(i);", "let small:byte=byte(i);answer+=small;"])("%s", (body) => {
    it.each([1, 4, 8])("should preserve complete scalar correspondence for bound=%i", (limit) => {
      for (const bounds of [true, false])
        for (const suffix of ["", "answer+=120;"]) {
          const input = effectFixture(source(body, limit, suffix), "size", bounds, "low-byte");
          const { proof, loop } = selected(input);
          const result = validateSelectedLoops(input);
          expect("kind" in result ? result : result.has(loop)).toBe(true);
          expect(validateSizeObservers(input).kind).toBe("complete");
          expect(loop.type).toMatchObject({ kind: "scalar", name: "word" });
          const before = side(
            view(input.reference.shared, input.reference.checked.lowered),
            loop,
            proof.originalRequestId,
          )!;
          const after = side(
            view(input.candidate.shared, input.candidate.lowered),
            loop,
            proof.requestId!,
          )!;
          expect(before.blocks[3]!.instructions).toHaveLength(11);
          expect(after.blocks[3]!.instructions.map(({ opcode }) => opcode)).toEqual(["inc"]);
          expect(after.blocks[3]!.instructions[0]).toMatchObject({
            mode: "absolute",
            cost: { bytes: 3, minCycles: 6, maxCycles: 6 },
          });
          expect(before.homes.get(proof.originalRequestId)?.bytes).toBe(2);
          expect(after.homes.get(proof.requestId!)?.bytes).toBe(1);
          // Source answers are independently derived; native qualification executes these outputs separately.
          expect(
            Array.from({ length: limit }, (_, ordinal) => ordinal).reduce(
              (sum, value) => sum + value,
              0,
            ),
          ).toBe((limit * (limit - 1)) / 2);
        }
    });
  });

  it.each([
    ["V cycle", "answer=byte(i);"],
    ["high-byte use", "answer+=hi(i);"],
    ["raw observer", "answer=peek($C110);answer+=byte(i);"],
    ["status observer", "asm_php();asm_plp();answer+=byte(i);"],
    ["conditional body", "if(i!=1){answer+=byte(i);}"],
  ])("should retain rejection for %s", (_name, body) => {
    const input = effectFixture(source(body), "size", true, "low-byte");
    expect(validateSizeObservers(input).kind).toBe("rejected");
    expect(
      validateSizeObservers(effectFixture(source(body), "size", true, "original")).kind,
    ).not.toBe("error");
  });

  it.each(["flat-eight-x-first", "flat-eight-y-first"] as const)(
    "should not discharge the separate %s family",
    (policy) => {
      const input = effectFixture(source("answer+=byte(i);", 8), "size", true, policy);
      expect(validateSizeObservers(input).kind).toBe("rejected");
    },
  );

  it.each([
    ["context", (proof: FixedCounterProof) => ({ ...proof, context: "other" })],
    ["missing read", (proof: FixedCounterProof) => ({ ...proof, reads: [] })],
    [
      "duplicate read",
      (proof: FixedCounterProof) => ({ ...proof, reads: [...proof.reads, ...proof.reads] }),
    ],
    [
      "staged read",
      (proof: FixedCounterProof) => ({
        ...proof,
        reads: proof.reads.map((read) => ({ ...read, stagingRequestId: proof.originalRequestId })),
      }),
    ],
    ["elided first test", (proof: FixedCounterProof) => ({ ...proof, firstTestElided: true })],
  ] as const)("should reject a damaged %s record", (_name, change) => {
    invalid(
      withProof(effectFixture(SUM_SOURCE, "size", true, "low-byte"), change),
      "Selected loop source, read or context premises are unresolved",
    );
  });

  describe.each(["before", "after"] as const)("actual %s construction", (construction) => {
    it.each(["entry", "test"] as const)("should reject the changed %s immediate", (role) => {
      const input = effectFixture(SUM_SOURCE, "size", true, "low-byte");
      const changed = withInstruction(
        input,
        construction,
        role,
        role === "entry" ? 0 : 1,
        (item) => ({ ...item, operand: { kind: "immediate", value: 1 } }),
      );
      invalid(changed, "Selected loop control templates or complete scratch references disagree");
    });

    it("should reject an actual final addressing mismatch independently of source annotations", () => {
      const input = effectFixture(SUM_SOURCE, "size", true, "low-byte");
      const changed = withInstruction(input, construction, "body", 2, (item, physical) =>
        physical && item.operand?.kind === "absolute"
          ? { ...item, operand: { ...item.operand, value: item.operand.value + 1 } }
          : item,
      );
      invalid(changed, "Selected loop binding or actual physical interference is unresolved");
    });

    it("should reject a reversed conditional edge", () => {
      const input = effectFixture(SUM_SOURCE, "size", true, "low-byte");
      const { owner, loop } = selected(input);
      const changed = withFunction(input, construction, (fn) =>
        fn.sourceFunction !== owner
          ? fn
          : {
              ...fn,
              blocks: fn.blocks.map((block) =>
                block.label !==
                  fn.observerBlocks?.find(([source]) => source === loop.header)?.[1][0] ||
                block.terminator.kind !== "branch"
                  ? block
                  : {
                      ...block,
                      terminator: {
                        ...block.terminator,
                        target: block.terminator.fallthrough,
                        fallthrough: block.terminator.target,
                      },
                    },
              ),
            },
      );
      invalid(changed, "Selected loop needs exactly five unshared actual source blocks");
    });

    it("should reject a physically misplaced false continuation", () => {
      const input = effectFixture(SUM_SOURCE, "size", true, "low-byte");
      const { owner, loop } = selected(input);
      const changed = withFunction(input, construction, (fn, physical) =>
        fn.sourceFunction !== owner || !physical
          ? fn
          : {
              ...fn,
              blocks: fn.blocks.map((block) =>
                block.label === fn.observerBlocks?.find(([source]) => source === loop.exit)?.[1][0]
                  ? { ...block, origin: block.origin! + 1 }
                  : block,
              ),
            },
      );
      invalid(changed, "Selected loop needs exactly five unshared actual source blocks");
    });

    it.each(["lifetime", "stage", "owner", "width"] as const)(
      "should reject a changed actual %s",
      (damage) => {
        const input = effectFixture(SUM_SOURCE, "size", true, "low-byte");
        const { proof } = selected(input);
        const id = construction === "before" ? proof.originalRequestId : proof.requestId!;
        const changed = withRequest(input, construction, id, (request) =>
          damage === "lifetime"
            ? {
                ...request,
                lifetime: { ...request.lifetime, liveAt: request.lifetime.liveAt.slice(1) },
              }
            : damage === "stage"
              ? { ...request, storageClass: "argument-stage" }
              : damage === "owner"
                ? { ...request, owner: { ...request.owner } }
                : { ...request, bytes: request.bytes + 1 },
        );
        invalid(changed, "Selected loop body, storage or lifetime correspondence is unresolved");
      },
    );

    it("should reject non-SFA overlap for a retained body capture", () => {
      const input = effectFixture(SUM_SOURCE, "size", true, "low-byte");
      const { owner, loop, proof } = selected(input);
      const shared = construction === "before" ? input.reference.shared : input.candidate.shared;
      const counter = construction === "before" ? proof.originalRequestId : proof.requestId!;
      const retained = shared.certificate.inventory.requests.find(
        (request) => request.owner === owner && request.id !== counter && request.bytes === 1,
      )!;
      const home = shared.certificate.certificate.homes.find(
        ({ requestId }) => requestId === retained.id,
      )!;
      const changed = {
        ...shared,
        layout: {
          ...shared.layout,
          intervals: [
            ...shared.layout.intervals,
            {
              ...shared.layout.intervals.find(({ id }) => id === "platform.startup-state")!,
              id: "another-resident-object",
              start: home.address,
              end: home.address,
            },
          ],
        },
      };
      const good = side(
        view(
          shared,
          construction === "before" ? input.reference.checked.lowered : input.candidate.lowered,
        ),
        loop,
        counter,
      )!;
      const bad = { ...good, shared: changed };
      const scratch = construction === "before" ? good.symbols[3]!.instructions[3]!.operand : null;
      const id = scratch?.kind === "storage" ? scratch.requestId : null;
      expect(physical(input, good, id)).toBe(true);
      expect(physical(input, bad, id)).toBe(false);
    });
  });

  it("should account for every reference scratch occurrence even when an object is reused", () => {
    const input = effectFixture(SUM_SOURCE, "size", true, "low-byte");
    const { owner, loop } = selected(input);
    const changed = withFunction(input, "before", (fn) => {
      if (fn.sourceFunction !== owner) return fn;
      const update = fn.blocks.find(
        (block) =>
          block.label === fn.observerBlocks?.find(([source]) => source === loop.update)?.[1][0],
      )!;
      const body = fn.observerBlocks?.find(([source]) => source === loop.body)?.[1][0];
      return {
        ...fn,
        blocks: fn.blocks.map((block) =>
          block.label === body
            ? {
                ...block,
                instructions: block.instructions.map((item, index) =>
                  index === 4 ? update.instructions[7]! : item,
                ),
              }
            : block,
        ),
      };
    });
    invalid(changed, "Selected loop control templates or complete scratch references disagree");
  });

  it("should preserve the exact actual increment association", () => {
    const input = effectFixture(SUM_SOURCE, "size", true, "low-byte");
    const changed = withInstruction(input, "before", "update", 0, (item) => ({
      ...item,
      source: selected(input).loop.comparison.span,
    }));
    invalid(changed, "Selected loop control templates or complete scratch references disagree");
  });

  it("should reject a reference increment by two", () => {
    const input = effectFixture(SUM_SOURCE, "size", true, "low-byte");
    invalid(
      withInstruction(input, "before", "update", 2, (item) => ({
        ...item,
        operand: { kind: "immediate", value: 2 },
      })),
      "Selected loop control templates or complete scratch references disagree",
    );
  });

  it("should reject caller transfers into the interior of the owner", () => {
    const input = effectFixture(SUM_SOURCE, "size", true, "low-byte");
    const { fn, owner, loop } = selected(input);
    const interior = fn.observerBlocks?.find(([source]) => source === loop.body)?.[1][0]!;
    const changed = withFunction(input, "after", (body) =>
      body.sourceFunction === owner
        ? body
        : {
            ...body,
            blocks: body.blocks.map((block) => ({
              ...block,
              instructions: block.instructions.map((item) =>
                item.opcode === "jsr"
                  ? { ...item, operand: { kind: "label", label: interior } }
                  : item,
              ),
            })),
          },
    );
    invalid(changed, "Selected loop state, caller or startup continuation is unresolved");
  });

  it("should reject a falsely described caller CPU overwrite", () => {
    const input = effectFixture(
      source("answer+=byte(i);", 4, "answer+=120;"),
      "size",
      true,
      "low-byte",
    );
    const { owner } = selected(input);
    const changed = withFunction(input, "after", (fn, physical) =>
      fn.sourceFunction === owner || !physical
        ? fn
        : {
            ...fn,
            blocks: fn.blocks.map((block) => ({
              ...block,
              instructions: block.instructions.map((item) =>
                item.opcode === "lda" ? { ...item, defines: { registers: [], flags: [] } } : item,
              ),
            })),
          },
    );
    invalid(changed, "Selected loop binding or actual physical interference is unresolved");
  });

  it("should not invent an empty layout for a rejected reference", () => {
    const input = effectFixture(SUM_SOURCE, "size", true, "low-byte");
    const rejected: FinalObserverInput = {
      ...input,
      reference: {
        kind: "resource-rejected",
        stage: "allocation",
        failure: {
          kind: "failure",
          category: "compiler",
          diagnostics: [],
        },
        facts: { inventory: input.reference.shared.certificate.inventory },
      },
    };
    expect(validateSelectedLoops(rejected)).toMatchObject({ kind: "rejected" });
  });
});

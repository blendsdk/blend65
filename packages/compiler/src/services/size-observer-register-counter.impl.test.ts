import { describe, expect, it } from "vitest";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import { validateSizeObservers } from "./size-observers.js";
import { validateSelectedLoops } from "./size-observer-selected-loops.js";
import {
  registerCounterSnapshot,
  registerMainContinuation,
} from "./size-observer-register-counter.js";
import { view, side } from "./size-observer-selected-loop-layout.js";
import { machineInstruction } from "../machine/lower-control.js";
import type {
  FixedCounterProof,
  MachineFunction,
  MachineInstruction,
} from "../machine/machine-types.js";
import type { Side } from "./size-observer-selected-loop-layout.js";

/** Mutations use independently constructed real source/reference/candidate closures. */
type Fixture = ReturnType<typeof effectFixture>;
/** Each damaged premise belongs to one actual construction, not an inferred peer layout. */
type Construction = "before" | "after";
/** Exact checked source roles avoid generated-label parsing in mutation tests. */
type Role = "preheader" | "header" | "body" | "update" | "exit";

/** Explicit initialization gives the independent arithmetic oracle a defined starting value. */
const SOURCE = `module Game;let answer:byte=0;
function work():void{for(let i:word=0;i<4;i+=1){answer+=byte(i);}}
function main():void{work();}`;

/** Source initialization fixes answers without injecting memory after compiler startup. */
function source(body = "answer+=byte(i);", limit = 4, suffix = ""): string {
  return `module Game;let answer:byte=0;function work():void{for(let i:word=0;i<${limit};i+=1){${body}}}function main():void{work();${suffix}}`;
}

/** Recover the actual selected source record, not a machine name or generated request spelling. */
function selected(input: Fixture) {
  const fn = input.candidate.lowered.program.functions.find(
    (fn) => fn.fixedCounterProofs?.length === 1,
  );
  const proof = fn?.fixedCounterProofs?.[0];
  if (fn === undefined || proof === undefined)
    throw new Error("Expected one real register counter");
  return { fn, proof };
}

/** Focused factor checks use the same independently resolved indexes as the parent. */
function sides(input: Fixture) {
  const { proof } = selected(input);
  const before = side(
    view(input.reference.shared, input.reference.checked.lowered),
    proof.loop,
    proof.originalRequestId,
  );
  const after = side(
    view(input.candidate.shared, input.candidate.lowered),
    proof.loop,
    proof.requestId,
    true,
  );
  if (before === null || after === null) throw new Error("Expected actual five-role constructions");
  return { proof, before, after };
}

/** Change actual/symbolic functions separately; every outer provenance check must still reject tampering. */
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

/** Isolate one control or body instruction by its immutable source-role association. */
function withInstruction(
  input: Fixture,
  construction: Construction,
  role: Role,
  index: number,
  change: (item: MachineInstruction, physical: boolean) => MachineInstruction,
): Fixture {
  const { proof } = selected(input);
  return withFunction(input, construction, (fn, physical) =>
    fn.sourceFunction !== proof.loop.function.id
      ? fn
      : {
          ...fn,
          blocks: fn.blocks.map((block) =>
            block.label !==
            fn.observerBlocks?.find(([source]) => source === proof.loop[role])?.[1][0]
              ? block
              : {
                  ...block,
                  instructions: block.instructions.map((item, ordinal) =>
                    ordinal === index ? change(item, physical) : item,
                  ),
                },
          ),
        },
  );
}

/** Damage only the pending representation record; a content seal is not a semantic oracle. */
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
            item !== fn
              ? item
              : { ...item, fixedCounterProofs: item.fixedCounterProofs!.map(change) },
          ),
        },
      },
    },
  };
}

/** A focused rejection and an outer authentication error are independent expectations. */
function invalid(input: Fixture): void {
  expect(validateSelectedLoops(input)).toMatchObject({ kind: "rejected" });
  expect(validateSizeObservers(input).kind).toBe("error");
}

/** Probe only an actual main call's continuation, retaining the factor's terminal restrictions. */
function continuation(input: Fixture, current: Side): boolean {
  const { proof } = selected(input);
  if (proof.representation === "low-byte") throw new Error("Expected a held register");
  const main = current.program.functions.find(
    ({ sourceFunction }) => sourceFunction === input.checked.program.semantic.main,
  )!;
  const block = main.blocks.find((block) =>
    block.instructions.some((item) => item.opcode === "jsr"),
  )!;
  return registerMainContinuation(
    input,
    current,
    main,
    block,
    block.instructions.findIndex((item) => item.opcode === "jsr") + 1,
    proof.representation,
  );
}

describe("final scalar register-counter observers", () => {
  describe.each(["x-first", "y-first"] as const)("%s", (policy) => {
    it.each([true, false])(
      "should discharge the snapshot with bounds=%s without changing source word semantics",
      (bounds) => {
        const input = effectFixture(SOURCE, "size", bounds, policy);
        expect(validateSizeObservers(input).kind).toBe("complete");
      },
    );

    it.each([1, 4, 8])(
      "should preserve complete correspondence and word typing at bound=%i",
      (limit) => {
        for (const bounds of [true, false])
          for (const body of ["answer+=byte(i);", "answer+=byte(i);answer+=1;"]) {
            const input = effectFixture(source(body, limit), "size", bounds, policy);
            const { proof, before, after } = sides(input);
            const snapshot = registerCounterSnapshot(proof, before, after);
            expect(snapshot).not.toBeNull();
            expect(after.counter).toBeNull();
            expect(after.requests.get(snapshot!)).toMatchObject({
              bytes: 1,
              value: proof.reads[0]!.value,
            });
            expect(proof.loop.type).toMatchObject({ kind: "scalar", name: "word" });
            expect(proof.firstTestElided).toBe(true);
            expect(validateSizeObservers(input).kind).toBe("complete");
          }
      },
    );

    it("should retain exact assembly and resource costs for the complete scalar construction", () => {
      const input = effectFixture(source(), "size", true, policy);
      const { proof, before, after } = sides(input);
      const register = proof.representation;
      expect(
        after.actual.blocks.flatMap((block) => block.instructions.map(({ opcode }) => opcode)),
      ).toEqual([
        `ld${register}`,
        `st${register}`,
        "lda",
        "clc",
        "adc",
        "sta",
        "lda",
        "sta",
        `in${register}`,
        `cp${register}`,
      ]);
      const bytes = (current: Side) =>
        current.actual.blocks.reduce(
          (sum, block) =>
            sum +
            block.instructions.reduce((size, item) => size + item.cost.bytes, 0) +
            (block.terminator.kind === "return"
              ? 1
              : block.terminator.kind === "fallthrough" || block.terminator.kind === "unreachable"
                ? 0
                : block.terminator.cost.bytes),
          0,
        );
      expect([bytes(before), bytes(after)]).toEqual([71, 27]);
      expect(input.candidate.shared.certificate.certificate.staticBytes).toEqual({
        ram: 2,
        zeroPage: 0,
      });
      expect(input.candidate.shared.certificate.certificate.hardwareStackProgramPeak).toBe(3);
      expect(continuation(input, before)).toBe(true);
      expect(continuation(input, after)).toBe(true);
    });
  });

  it.each(["flat-eight-x-first", "flat-eight-y-first"] as const)(
    "should close a nonexpanded register counter under %s",
    (policy) => {
      expect(validateSizeObservers(effectFixture(source(), "size", true, policy)).kind).toBe(
        "complete",
      );
    },
  );

  it.each([
    ["missing reads", (proof: FixedCounterProof) => ({ ...proof, reads: [] })],
    [
      "duplicate reads",
      (proof: FixedCounterProof) => ({ ...proof, reads: [...proof.reads, ...proof.reads] }),
    ],
    [
      "staged read",
      (proof: FixedCounterProof) => ({
        ...proof,
        reads: proof.reads.map((read) => ({ ...read, stagingRequestId: proof.originalRequestId })),
      }),
    ],
    [
      "memory counter",
      (proof: FixedCounterProof) => ({ ...proof, requestId: proof.originalRequestId }),
    ],
    ["retained first test", (proof: FixedCounterProof) => ({ ...proof, firstTestElided: false })],
    ["foreign context", (proof: FixedCounterProof) => ({ ...proof, context: "another-owner" })],
    [
      "index use",
      (proof: FixedCounterProof) => ({
        ...proof,
        indexUses: [{ value: proof.reads[0]!.value, consumer: proof.loop.updateStore }],
      }),
    ],
  ] as const)("should reject %s without relying on the outer content seal", (_name, change) => {
    invalid(withProof(effectFixture(source(), "size", true, "x-first"), change));
  });

  describe.each(["before", "after"] as const)("actual %s layout", (construction) => {
    it.each(["preheader", "header", "update"] as const)(
      "should reject an incorrect %s control",
      (role) => {
        const input = effectFixture(source(), "size", true, "x-first");
        const index = construction === "before" && role === "header" ? 1 : 0;
        invalid(
          withInstruction(input, construction, role, index, (item) =>
            role === "update" && construction === "after"
              ? { ...item, opcode: "iny" }
              : { ...item, operand: { kind: "immediate", value: 1 } },
          ),
        );
      },
    );

    it("should reject an actual bound address that disagrees with its symbolic source", () => {
      invalid(
        withInstruction(
          effectFixture(source(), "size", true, "x-first"),
          construction,
          "body",
          construction === "before" ? 2 : 3,
          (item, physical) =>
            physical && item.operand?.kind === "absolute"
              ? { ...item, operand: { ...item.operand, value: item.operand.value + 1 } }
              : item,
        ),
      );
    });
  });

  it.each(["read", "clobber"] as const)(
    "should reject an unproved assigned-register %s in paired bodies",
    (kind) => {
      let input = effectFixture(source(), "size", true, "x-first");
      const actual = sides(input);
      for (const construction of ["before", "after"] as const) {
        const current = construction === "before" ? actual.before : actual.after;
        const index = current.symbols[2]!.instructions.length - (kind === "read" ? 1 : 2);
        input = withInstruction(input, construction, "body", index, (item) => ({
          ...item,
          ...machineInstruction(
            input.checked.profile.cpu,
            kind === "read" ? "stx" : "ldx",
            item.mode,
            item.operand,
            item.memory,
            item.source,
          ),
        }));
      }
      const pair = sides(input);
      expect(registerCounterSnapshot(pair.proof, pair.before, pair.after)).toBeNull();
      invalid(input);
    },
  );

  it.each(["value", "type", "definition", "lifetime", "owner"] as const)(
    "should reject a snapshot with changed %s",
    (damage) => {
      const input = effectFixture(source(), "size", true, "x-first");
      const { proof } = selected(input);
      const shared = input.candidate.shared;
      const changed = {
        ...input,
        candidate: {
          ...input.candidate,
          shared: {
            ...shared,
            certificate: {
              ...shared.certificate,
              inventory: {
                ...shared.certificate.inventory,
                requests: shared.certificate.inventory.requests.map((request) =>
                  request.value !== proof.reads[0]!.value
                    ? request
                    : damage === "value"
                      ? { ...request, value: "unrelated-source-value" }
                      : damage === "type"
                        ? { ...request, type: { kind: "scalar" as const, name: "word" as const } }
                        : damage === "definition"
                          ? {
                              ...request,
                              lifetime: {
                                ...request.lifetime,
                                definition: { ...request.lifetime.definition, operation: 0 },
                              },
                            }
                          : damage === "lifetime"
                            ? {
                                ...request,
                                lifetime: {
                                  ...request.lifetime,
                                  liveAt: request.lifetime.liveAt.slice(1),
                                },
                              }
                            : { ...request, owner: { ...request.owner! } },
                ),
              },
            },
          },
        },
      };
      invalid(changed);
    },
  );

  it("should reject an extra snapshot occurrence in a foreign caller", () => {
    const input = effectFixture(source(), "size", true, "x-first");
    const { proof, after } = sides(input);
    invalid(
      withFunction(input, "after", (fn) =>
        fn.sourceFunction === proof.loop.function.id
          ? fn
          : {
              ...fn,
              blocks: fn.blocks.map((block) => ({
                ...block,
                instructions: [...block.instructions, after.symbols[2]!.instructions[0]!],
              })),
            },
      ),
    );
  });

  it("should reject a register entry redirected through its elided test", () => {
    const input = effectFixture(source(), "size", true, "x-first");
    const { proof } = selected(input);
    invalid(
      withFunction(input, "after", (fn) =>
        fn.sourceFunction !== proof.loop.function.id
          ? fn
          : {
              ...fn,
              blocks: fn.blocks.map((block, index) =>
                index !== 0 ||
                (block.terminator.kind !== "jump" && block.terminator.kind !== "fallthrough")
                  ? block
                  : {
                      ...block,
                      terminator: {
                        ...block.terminator,
                        target: fn.observerBlocks!.find(
                          ([source]) => source === proof.loop.header,
                        )![1][0]!,
                      },
                    },
              ),
            },
      ),
    );
  });

  it.each(["before", "after"] as const)(
    "should retain complete counter/capture occupancy in %s",
    (construction) => {
      const input = effectFixture(source(), "size", true, "x-first");
      const { proof, before, after } = sides(input);
      const shared = construction === "before" ? input.reference.shared : input.candidate.shared;
      const id =
        construction === "before"
          ? proof.originalRequestId
          : registerCounterSnapshot(proof, before, after)!;
      const changed = {
        ...shared,
        certificate: {
          ...shared.certificate,
          inventory: {
            ...shared.certificate.inventory,
            requests: shared.certificate.inventory.requests.map((request) =>
              request.id !== id
                ? request
                : {
                    ...request,
                    lifetime: { ...request.lifetime, liveAt: request.lifetime.liveAt.slice(1) },
                  },
            ),
          },
        },
      };
      invalid(
        construction === "before"
          ? { ...input, reference: { ...input.reference, shared: changed } }
          : { ...input, candidate: { ...input.candidate, shared: changed } },
      );
    },
  );

  it("should reject overlapping actual snapshot and retained-value homes", () => {
    const input = effectFixture(source(), "size", true, "x-first");
    const { proof, before, after } = sides(input);
    const id = registerCounterSnapshot(proof, before, after)!;
    const peer = [...after.requests.values()].find(
      (request) => request.owner === proof.loop.function.id && request.id !== id,
    )!;
    const address = after.homes.get(peer.id)!.address;
    const shared = input.candidate.shared;
    invalid({
      ...input,
      candidate: {
        ...input.candidate,
        shared: {
          ...shared,
          certificate: {
            ...shared.certificate,
            certificate: {
              ...shared.certificate.certificate,
              homes: shared.certificate.certificate.homes.map((home) =>
                home.requestId === id ? { ...home, address } : home,
              ),
            },
          },
        },
      },
    });
  });

  it("should retain complete reference-only T0 occurrence checks", () => {
    const input = effectFixture(source(), "size", true, "x-first");
    const { before } = sides(input);
    const operand = before.symbols[3]!.instructions[3]!.operand;
    const changed = withInstruction(input, "before", "body", 2, (item) => ({ ...item, operand }));
    expect(validateSelectedLoops(changed)).toMatchObject({
      kind: "rejected",
      reason: "Selected loop control templates or complete scratch references disagree",
    });
    invalid(changed);
  });

  it.each(["return", "register-read", "status-read"] as const)(
    "should reject %s before the real startup terminal",
    (damage) => {
      const input = effectFixture(source(), "size", true, "x-first");
      const changed = withFunction(input, "after", (fn) =>
        fn.sourceFunction !== input.checked.program.semantic.main
          ? fn
          : {
              ...fn,
              blocks: fn.blocks.map((block) =>
                damage === "return"
                  ? { ...block, terminator: { kind: "return" as const } }
                  : damage === "register-read"
                    ? {
                        ...block,
                        instructions: [
                          ...block.instructions,
                          machineInstruction(input.checked.profile.cpu, "txa", "implied", null),
                        ],
                      }
                    : {
                        ...block,
                        terminator: {
                          kind: "branch" as const,
                          opcode: "bvs",
                          target: "startup.restore",
                          fallthrough: "startup.restore",
                          uses: { registers: [], flags: ["v" as const] },
                          cost: { bytes: 2, minCycles: 2, maxCycles: 4 },
                        },
                      },
              ),
            },
      );
      const pair = sides(changed);
      expect(continuation(changed, pair.after)).toBe(false);
      invalid(changed);
    },
  );

  it("should retain the full return-observation boundary at non-main callers", () => {
    const text = source().replace(
      "function main():void{work();}",
      "function relay():void{work();}function main():void{relay();}",
    );
    expect(validateSizeObservers(effectFixture(text, "size", true, "x-first")).kind).toBe(
      "rejected",
    );
  });

  it("should reject a main transfer outside its restricted terminal graph", () => {
    const input = effectFixture(source(), "size", true, "x-first");
    const changed = withFunction(input, "after", (fn) =>
      fn.sourceFunction !== input.checked.program.semantic.main
        ? fn
        : {
            ...fn,
            blocks: fn.blocks.map((block) =>
              block.terminator.kind === "jump"
                ? {
                    ...block,
                    terminator: { ...block.terminator, target: "startup.entry" },
                  }
                : block,
            ),
          },
    );
    expect(continuation(changed, sides(changed).after)).toBe(false);
    invalid(changed);
  });

  it.each([
    ["high-byte use", source("answer+=hi(i);")],
    ["unproved V cycle", source("answer=byte(i);")],
    ["raw observer", source("answer+=byte(i);", 4, "poke($C100,answer);")],
    ["status observer", source("answer+=byte(i);", 4, "asm_php();asm_plp();")],
    ["multiple counter reads", source("answer+=byte(i);answer+=byte(i);")],
    ["direct transfer without a snapshot", source("let small:byte=byte(i);answer+=small;")],
    ["conditional body", source("if(i!=1){answer+=byte(i);}")],
    [
      "native indexed store",
      "module Game;let answers:byte[8]=[;0];function work():void{let value:byte=0;for(let i:word=0;i<4;i+=1){value+=3;answers[i]=value;}}function main():void{work();}",
    ],
  ])("should retain ordinary lowering but reject the unsupported %s tuple", (_name, text) => {
    const input = effectFixture(text, "size", true, "x-first");
    expect(input.reference.kind).toBe("feasible");
    expect(validateSizeObservers(input).kind).toBe("rejected");
  });
});

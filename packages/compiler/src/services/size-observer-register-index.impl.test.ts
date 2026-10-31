import { describe, expect, it } from "vitest";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import { validateSizeObservers } from "./size-observers.js";
import { validateSelectedLoops } from "./size-observer-selected-loops.js";
import {
  registerCounterIndex,
  registerMainContinuation,
} from "./size-observer-register-counter.js";
import { view, side, physical } from "./size-observer-selected-loop-layout.js";
import { instructionAccessEnvelope } from "../machine/nmos6510-access.js";
import { machineInstruction } from "../machine/lower-control.js";
import type {
  MachineFunction,
  MachineInstruction,
  FixedCounterProof,
} from "../machine/machine-types.js";
import type { StorageRequest } from "../storage/storage-types.js";

/** Every case uses independently lowered, closed and physically bound real source. */
type Fixture = ReturnType<typeof effectFixture>;
/** Deliberate damage belongs to one construction, never a borrowed peer address map. */
type Construction = "before" | "after";
/** Source-role identity avoids matching generated block or request names. */
type Role = "preheader" | "header" | "body" | "update" | "exit";

/** A real initialized global exposes packed displacement without a source-address workaround. */
const SOURCE = `module Game;struct Saved{quality:byte;rows:byte[8];}
let saved:Saved={quality:2,rows:[;0]};
function work():void{for(let i:word=0;i<4;i+=1){saved.rows[i]=7;}}
function main():void{work();}`;

/** Initialized padding makes nonzero packed offsets and untouched bytes independently observable. */
function source(offset = 0, bound = 4, variable = false): string {
  const declarations =
    offset === 0
      ? "let rows:byte[8]=[;0];"
      : `struct Saved{padding:byte[${offset}];rows:byte[8];}let saved:Saved={padding:[;2],rows:[;0]};`;
  return `module Game;${declarations}${variable ? "let value:byte=7;" : ""}function work():void{for(let i:word=0;i<${bound};i+=1){${offset === 0 ? "rows" : "saved.rows"}[i]=${variable ? "value" : "7"};}}function main():void{work();}`;
}

/** Recover the actual counter record and owner without source-name recognition. */
function owner(input: Fixture) {
  const fn = input.candidate.lowered.program.functions.find(
    (fn) => fn.fixedCounterProofs?.length === 1,
  );
  const proof = fn?.fixedCounterProofs?.[0];
  if (fn === undefined || proof === undefined)
    throw new Error("Expected an actual selected counter");
  return { fn, proof };
}

/** Keep independent source-to-symbol-to-physical indexes for the two constructions. */
function pair(input: Fixture) {
  const { proof } = owner(input);
  const before = side(
    view(input.reference.shared, input.reference.checked.lowered),
    proof.loop,
    proof.originalRequestId,
  );
  const after = side(view(input.candidate.shared, input.candidate.lowered), proof.loop, null, true);
  if (before === null || after === null) throw new Error("Expected actual five-role layouts");
  return { proof, before, after };
}

/** Change symbolic and actual members explicitly; authentication must reject either corruption. */
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
  const result = {
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
          shared: result,
        },
      }
    : { ...input, candidate: { lowered: next, shared: result } };
}

/** Match a source role, then mutate only its specified instruction occurrence. */
function instruction(
  input: Fixture,
  construction: Construction,
  role: Role,
  ordinal: number,
  change: (item: MachineInstruction, physical: boolean) => MachineInstruction,
): Fixture {
  const { proof } = owner(input);
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
                  instructions: block.instructions.map((item, index) =>
                    index === ordinal ? change(item, physical) : item,
                  ),
                },
          ),
        },
  );
}

/** Corrupt one declared owner demand without changing its authenticated producer. */
function request(
  input: Fixture,
  construction: Construction,
  id: string,
  change: (request: StorageRequest) => StorageRequest,
): Fixture {
  const shared = construction === "before" ? input.reference.shared : input.candidate.shared;
  const result = {
    ...shared,
    certificate: {
      ...shared.certificate,
      inventory: {
        ...shared.certificate.inventory,
        requests: shared.certificate.inventory.requests.map((item) =>
          item.id === id ? change(item) : item,
        ),
      },
    },
  };
  return construction === "before"
    ? { ...input, reference: { ...input.reference, shared: result } }
    : { ...input, candidate: { ...input.candidate, shared: result } };
}

/** Focused proof rejection is checked separately from outer content authentication. */
function invalid(input: Fixture): void {
  expect(validateSelectedLoops(input)).toMatchObject({ kind: "rejected" });
  expect(validateSizeObservers(input).kind).toBe("error");
}

/** Mutate only the pending selected counter record, leaving real machine evidence available. */
function withProof(
  input: Fixture,
  change: (proof: FixedCounterProof) => FixedCounterProof,
): Fixture {
  const { fn } = owner(input);
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
              : {
                  ...item,
                  fixedCounterProofs: item.fixedCounterProofs!.map(change),
                },
          ),
        },
      },
    },
  };
}

describe("final held-counter typed stores", () => {
  it.each(["x-first", "y-first"] as const)(
    "should discharge the exact %s packed-byte store without inventing snapshot storage",
    (policy) => {
      expect(validateSizeObservers(effectFixture(SOURCE, "size", false, policy)).kind).toBe(
        "complete",
      );
    },
  );

  describe.each(["x-first", "y-first"] as const)("%s", (policy) => {
    it.each([1, 4, 8])(
      "should retain word ordinals and exact no-new-home resources for bound=%i",
      (bound) => {
        for (const offset of [0, 1])
          for (const variable of [false, true]) {
            const input = effectFixture(source(offset, bound, variable), "size", false, policy);
            const { proof, before, after } = pair(input);
            const index = registerCounterIndex(input, proof, before, after);
            expect(index).toMatchObject({ offset, maximum: bound - 1 });
            expect(proof.loop.type).toMatchObject({ kind: "scalar", name: "word" });
            expect(before.requests.size).toBe(3);
            expect(after.requests.size).toBe(0);
            expect(input.candidate.shared.certificate.certificate.staticBytes).toEqual({
              ram: 0,
              zeroPage: 0,
            });
            expect(input.candidate.shared.certificate.certificate.hardwareStackProgramPeak).toBe(3);
            expect(validateSizeObservers(input).kind).toBe("complete");
            expect(
              after.symbols[2]!.instructions.map(({ opcode, mode }) => [opcode, mode]),
            ).toEqual([
              ["lda", variable ? "absolute" : "immediate"],
              ["sta", `absolute-${proof.representation}`],
            ]);
            if (index === null) throw new Error("Expected a proved typed store");
            expect(before.symbols[2]!.instructions[7]!.operand).toEqual({
              kind: "immediate",
              value: offset,
            });
            expect(
              physical(
                input,
                before,
                before.symbols[3]!.instructions[3]!.operand?.kind === "storage"
                  ? before.symbols[3]!.instructions[3]!.operand.requestId
                  : null,
                index,
              ),
            ).toBe(true);
            expect(physical(input, after, null, index)).toBe(true);
          }
      },
    );

    it("should preserve a byte-sized displacement at the packed-offset boundary", () => {
      expect(validateSizeObservers(effectFixture(source(255), "size", false, policy)).kind).toBe(
        "complete",
      );
    });

    it("should retain the canonical 62-byte work reduction without attributing frame bytes to code", () => {
      const input = effectFixture(source(), "size", false, policy);
      const { before, after } = pair(input);
      const bytes = (current: typeof before) =>
        current.actual.blocks.reduce(
          (sum, block) =>
            sum +
            block.instructions.reduce((sum, item) => sum + item.cost.bytes, 0) +
            (block.terminator.kind === "return"
              ? 1
              : block.terminator.kind === "fallthrough" || block.terminator.kind === "unreachable"
                ? 0
                : block.terminator.cost.bytes),
          0,
        );
      expect([bytes(before), bytes(after)]).toEqual([75, 13]);
    });
  });

  it.each(["flat-eight-x-first", "flat-eight-y-first"] as const)(
    "should close a nonexpanded typed store under %s",
    (policy) => {
      expect(validateSizeObservers(effectFixture(source(), "size", false, policy)).kind).toBe(
        "complete",
      );
    },
  );

  it.each([
    ["missing index", (proof: FixedCounterProof) => ({ ...proof, indexUses: [] })],
    [
      "duplicate index",
      (proof: FixedCounterProof) => ({
        ...proof,
        indexUses: [...proof.indexUses!, ...proof.indexUses!],
      }),
    ],
    [
      "staged ordinal",
      (proof: FixedCounterProof) => ({
        ...proof,
        reads: proof.reads.map((read) => ({ ...read, stagingRequestId: proof.originalRequestId })),
      }),
    ],
    [
      "foreign ordinal",
      (proof: FixedCounterProof) => ({
        ...proof,
        indexUses: proof.indexUses!.map((use) => ({ ...use, value: "another-source-value" })),
      }),
    ],
    [
      "memory counter",
      (proof: FixedCounterProof) => ({ ...proof, requestId: proof.originalRequestId }),
    ],
    ["unproved first entry", (proof: FixedCounterProof) => ({ ...proof, firstTestElided: false })],
    ["wrong register", (proof: FixedCounterProof) => ({ ...proof, representation: "y" as const })],
  ] as const)("should reject %s", (_name, change) => {
    invalid(withProof(effectFixture(source(), "size", false, "x-first"), change));
  });

  describe.each(["before", "after"] as const)("actual %s construction", (construction) => {
    it.each(["displacement", "stride", "recipe", "place", "bound"] as const)(
      "should reject changed typed %s provenance",
      (damage) => {
        const input = effectFixture(source(1), "size", false, "x-first");
        const { proof } = owner(input);
        invalid(
          instruction(input, construction, "body", construction === "before" ? 9 : 1, (item) => ({
            ...item,
            observerOrigins:
              item.observerOrigins?.map((origin) =>
                origin.kind !== "typed"
                  ? origin
                  : damage === "displacement"
                    ? { ...origin, displacement: 0 }
                    : damage === "stride"
                      ? { ...origin, stride: 2 }
                      : damage === "recipe"
                        ? { ...origin, recipe: "typed-fixed" as const }
                        : damage === "place"
                          ? { ...origin, place: proof.loop.initialization.place }
                          : { ...origin, indexBounds: new Map([[proof.reads[0]!.value, 255n]]) },
              ) ?? [],
          })),
        );
      },
    );

    it("should reject a symbolic/actual target mismatch", () => {
      invalid(
        instruction(
          effectFixture(source(), "size", false, "x-first"),
          construction,
          "body",
          construction === "before" ? 9 : 1,
          (item, physical) =>
            !physical
              ? item
              : {
                  ...item,
                  operand:
                    item.operand?.kind === "absolute"
                      ? { ...item.operand, value: item.operand.value + 1 }
                      : item.operand?.kind === "label"
                        ? { ...item.operand, offset: (item.operand.offset ?? 0) + 1 }
                        : item.operand,
                },
        ),
      );
    });

    it.each(["preheader", "header", "update"] as const)(
      "should reject an incorrect %s control",
      (role) => {
        invalid(
          instruction(
            effectFixture(source(), "size", false, "x-first"),
            construction,
            role,
            0,
            (item) => ({ ...item, opcode: "nop" }),
          ),
        );
      },
    );

    it("should reject an added machine memory effect", () => {
      invalid(
        instruction(
          effectFixture(source(), "size", false, "x-first"),
          construction,
          "body",
          0,
          (item) => ({
            ...item,
            memory: [
              {
                kind: "read",
                address: { kind: "absolute", value: 0xc100 },
                width: 1,
                volatile: true,
                order: 0,
              },
            ],
          }),
        ),
      );
    });
  });

  it.each(["width", "occupancy", "owner", "page-safe"] as const)(
    "should retain complete pointer %s requirements",
    (damage) => {
      const input = effectFixture(source(), "size", false, "x-first");
      const { proof, before, after } = pair(input);
      const index = registerCounterIndex(input, proof, before, after)!;
      invalid(
        request(input, "before", index.pointer, (item) =>
          damage === "width"
            ? { ...item, bytes: 1 }
            : damage === "occupancy"
              ? { ...item, lifetime: { ...item.lifetime, liveAt: item.lifetime.liveAt.slice(1) } }
              : damage === "owner"
                ? { ...item, owner: { ...item.owner } }
                : { ...item, pageSafeIndirect: true },
        ),
      );
    },
  );

  it("should reject a surviving selected request instead of fabricating an empty owner", () => {
    const input = effectFixture(source(), "size", false, "x-first");
    const shared = input.candidate.shared;
    const retained = input.reference.shared.certificate.inventory.requests[0]!;
    invalid({
      ...input,
      candidate: {
        ...input.candidate,
        shared: {
          ...shared,
          certificate: {
            ...shared.certificate,
            inventory: { ...shared.certificate.inventory, requests: [retained] },
          },
        },
      },
    });
  });

  it("should reject a foreign occurrence of the reference-only pointer", () => {
    const input = effectFixture(source(), "size", false, "x-first");
    const { proof, before } = pair(input);
    invalid(
      withFunction(input, "before", (fn) =>
        fn.sourceFunction === proof.loop.function.id
          ? fn
          : {
              ...fn,
              blocks: fn.blocks.map((block) => ({
                ...block,
                instructions: [...block.instructions, before.symbols[2]!.instructions[3]!],
              })),
            },
      ),
    );
  });

  it("should reject the loss of an update scratch occurrence", () => {
    invalid(
      instruction(
        effectFixture(source(), "size", false, "x-first"),
        "before",
        "update",
        7,
        (item) => ({ ...item, operand: { kind: "immediate", value: 0 } }),
      ),
    );
  });

  it.each(["v", "y"] as const)(
    "should observe %s before its real main-terminal overwrite",
    (state) => {
      const input = effectFixture(source(), "size", false, "x-first");
      const changed = withFunction(input, "after", (fn) =>
        fn.sourceFunction !== input.checked.program.semantic.main
          ? fn
          : {
              ...fn,
              blocks: fn.blocks.map((block) => ({
                ...block,
                instructions: [
                  ...block.instructions,
                  machineInstruction(
                    input.checked.profile.cpu,
                    state === "v" ? "php" : "tya",
                    "implied",
                    null,
                  ),
                ],
              })),
            },
      );
      const { proof, after } = pair(changed);
      const main = after.program.functions.find(
        ({ sourceFunction }) => sourceFunction === input.checked.program.semantic.main,
      )!;
      const block = main.blocks.find((block) =>
        block.instructions.some(({ opcode }) => opcode === "jsr"),
      )!;
      if (proof.representation === "low-byte") throw new Error("Expected a native index register");
      expect(
        registerMainContinuation(changed, after, main, block, 1, proof.representation, true),
      ).toBe(false);
      invalid(changed);
    },
  );

  it("should reject a V reader inside the otherwise finite native loop", () => {
    const input = effectFixture(source(), "size", false, "x-first");
    invalid(
      withFunction(input, "after", (fn) =>
        fn.sourceFunction !== owner(input).proof.loop.function.id
          ? fn
          : {
              ...fn,
              blocks: fn.blocks.map((block) => ({
                ...block,
                instructions: block.instructions.map((item) =>
                  item.opcode === "sta"
                    ? {
                        ...item,
                        uses: { ...item.uses, flags: ["v" as const] },
                      }
                    : item,
                ),
              })),
            },
      ),
    );
  });

  it.each([
    ["checked split reference", source(), true],
    ["wide packed displacement", source(256), false],
    ["expanded body", source(0, 8), false, "flat-eight-x-first"],
    ["raw observer", source().replace("work();}", "work();poke($C100,1);}"), false],
    [
      "ordinary intermediate caller",
      source().replace(
        "function main():void{work();}",
        "function relay():void{work();}function main():void{relay();}",
      ),
      false,
    ],
    [
      "unrelated indexed source path",
      source().replace("work();}", "work();let another:byte=rows[0];}"),
      false,
    ],
    [
      "mutable local retention",
      "module Game;let rows:byte[8]=[;0];function work():void{let value:byte=0;for(let i:word=0;i<4;i+=1){value+=3;rows[i]=value;}}function main():void{work();}",
      false,
    ],
  ] as const)(
    "should retain ordinary source but reject the unsupported %s tuple",
    (_name, text, bounds, policy?: "flat-eight-x-first") => {
      expect(
        validateSizeObservers(effectFixture(text, "size", bounds, policy ?? "x-first")).kind,
      ).toBe("rejected");
    },
  );

  it("should distinguish reference displacement dummy reads from an equal native target", () => {
    const input = effectFixture(source(), "size", false, "x-first");
    const cpu = input.checked.profile.cpu;
    const reference = instructionAccessEnvelope({
      cpu,
      pc: 0x900,
      instruction: machineInstruction(cpu, "sta", "indirect-indexed-y", {
        kind: "absolute",
        value: 2,
      }),
      pointees: [{ start: 0x2ff, end: 0x2ff }],
      index: { start: 1, end: 1 },
    });
    const selected = instructionAccessEnvelope({
      cpu,
      pc: 0x900,
      instruction: machineInstruction(cpu, "sta", "absolute-x", { kind: "absolute", value: 0x300 }),
      index: { start: 0, end: 0 },
    });
    expect(reference?.find(({ role }) => role === "dummy")?.ranges).toEqual([
      { start: 0x200, end: 0x200 },
    ]);
    expect(selected?.find(({ role }) => role === "dummy")?.ranges).toEqual([
      { start: 0x300, end: 0x300 },
    ]);
    for (const accesses of [reference, selected])
      expect(accesses?.find(({ role }) => role === "data")?.ranges).toEqual([
        { start: 0x300, end: 0x300 },
      ]);
  });
});

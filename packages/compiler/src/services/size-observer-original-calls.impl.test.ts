import { describe, expect, it } from "vitest";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import { serializeAcme } from "../artifacts/acme-serializer.js";
import type {
  MachineBlock,
  MachineFunction,
  MachineInstruction,
} from "../machine/machine-types.js";
import { validateResidualEffects } from "./size-observer-effects.js";
import { validateOriginalCallSites } from "./size-observer-original-call-sites.js";
import { validateSizeObservers } from "./size-observers.js";

/** Real independently closed constructions; damaged copies can only test rejection. */
type Input = ReturnType<typeof effectFixture>;
/** Keep the two physical constructions separate even when their code happens to match. */
type Side = "reference" | "candidate";

/** Resolve source and actual ownership from producer evidence rather than generated names. */
function owner(input: Input, side: Side) {
  const loop = [
    ...input.candidate.lowered.program.storageSelection!.sourceFacts.functions.values(),
  ].flatMap((packet) => packet.loops)[0]!;
  const shared = input[side].shared;
  const fn = shared.layout.program.functions.find((fn) => fn.sourceFunction === loop.function.id)!;
  return { loop, shared, fn };
}

/** Change actual layout only; never fabricate a new symbolic authority or valid receipt. */
function alter(input: Input, side: Side, update: (fn: MachineFunction) => MachineFunction): Input {
  const shared = input[side].shared;
  const replacement = {
    ...shared,
    layout: {
      ...shared.layout,
      program: { ...shared.layout.program, functions: shared.layout.program.functions.map(update) },
    },
  };
  return side === "reference"
    ? { ...input, reference: { ...input.reference, shared: replacement } }
    : { ...input, candidate: { ...input.candidate, shared: replacement } };
}

/** The component must reject independently of the outer producer-provenance guard. */
function local(input: Input, side: Side) {
  const { loop, shared, fn } = owner(input, side);
  return validateOriginalCallSites(input, loop, shared, fn);
}

/** Preserve the exact ordinary source whose unsupported call row moves into this concern. */
const OUTSIDE_CALL =
  "module Game;let data:byte[8]=[;0];function touch():void{poke($C140,1);}function main():void{for(let i:word=0;i<8;i+=1){data[i]=byte(i);}touch();}";
/** The counter stays an ordinary source word in every independently closed construction. */
const LOOP = "for(let i:word=0;i<8;i+=1){data[i]=byte(i);}";
/** Small source variants exercise the call ABI rather than a special input/library name. */
const SOURCES = [
  ["exact migrated suffix", OUTSIDE_CALL],
  [
    "prefix",
    `module Game;let data:byte[8]=[;0];let total:word=0;function touch():void{total+=1;}function main():void{touch();${LOOP}}`,
  ],
  [
    "between loops",
    `module Game;let data:byte[8]=[;0];let total:word=0;function touch():void{total+=1;}function main():void{${LOOP}touch();for(let j:word=0;j<8;j+=1){data[j]=byte(j+1);}}`,
  ],
  [
    "ordered calls",
    `module Game;let data:byte[8]=[;0];let total:word=0;function first():void{total=1;}function second():void{total=2;}function main():void{${LOOP}first();second();}`,
  ],
  [
    "byte result",
    `module Game;let data:byte[8]=[;0];let total:byte=0;function next(value:byte):byte{return value+1;}function main():void{${LOOP}total=next(7);}`,
  ],
  [
    "word result",
    `module Game;let data:byte[8]=[;0];let total:word=0;function next(value:word):word{return value+1;}function main():void{${LOOP}total=next($12FF);}`,
  ],
  [
    "named borrowing",
    `module Game;let data:byte[8]=[;0];let total:byte=0;function sample(p:const byte[8]):byte{return p[0];}function main():void{${LOOP}total=sample(data);}`,
  ],
  [
    "transitive callee",
    `module Game;let data:byte[8]=[;0];let total:word=0;function child():void{total+=1;}function touch():void{child();}function main():void{${LOOP}touch();}`,
  ],
  [
    "callee helper",
    `module Game;let data:byte[8]=[;0];let total:byte=0;function calculate(a:byte,b:byte):byte{return a*b;}function main():void{${LOOP}total=calculate(3,4);}`,
  ],
] as const;

describe("Original outside-loop call correspondence", () => {
  describe.each(SOURCES)("%s", (_name, source) => {
    it.each([false, true])("should close the ordinary call with bounds=%s", (bounds) => {
      const input = effectFixture(source, "size", bounds, "original");
      expect(input.candidate.shared).not.toBe(input.reference.shared);
      expect(validateResidualEffects(input).kind).toBe("complete");
      expect(validateSizeObservers(input).kind).toBe("complete");
    });
  });

  describe.each(["reference", "candidate"] as const)("%s occurrence rejection", (side) => {
    it.each([
      "wrong callee",
      "block entry",
      "offset",
      "address byte",
      "transform",
      "span",
      "missing",
      "extra",
      "reordered",
      "same object",
      "late",
      "unassociated",
      "duplicate block",
      "missing mapping",
      "callee activation",
      "callee domain",
      "callee sharing",
      "callee source",
    ] as const)("should reject %s locally and atomically", (damage) => {
      const input = effectFixture(SOURCES[3][1], "size", false, "original");
      const { fn, shared } = owner(input, side);
      const block = fn.blocks.find((block) =>
        block.instructions.some((item) => item.opcode === "jsr"),
      )!;
      const jsrs = block.instructions.filter((item) => item.opcode === "jsr");
      const operand = jsrs[0]!.operand;
      if (operand?.kind !== "label") throw new Error("Expected the real direct call");
      const callee = shared.layout.program.functions.find((fn) => fn.id === operand.label)!;
      const context = callee.executionContext;
      if (context === undefined || callee.sourceFunction === undefined)
        throw new Error("Expected main source association");
      const changed = alter(input, side, (actual) => {
        if (actual === callee) {
          if (damage === "callee activation")
            return { ...actual, executionContext: { ...context, activationRoot: "unknown" } };
          if (damage === "callee domain")
            return { ...actual, executionContext: { ...context, domain: "irq" } };
          if (damage === "callee sharing")
            return {
              ...actual,
              observerBodies: [
                { sourceFunction: callee.sourceFunction!, executionContext: context },
                { sourceFunction: callee.sourceFunction!, executionContext: context },
              ],
            };
          if (damage === "callee source") {
            const { sourceFunction: _source, ...unknown } = actual;
            return unknown;
          }
        }
        if (actual !== fn) return actual;
        if (damage === "missing mapping") {
          const { observerBlocks: _mapping, ...unknown } = actual;
          return unknown;
        }
        if (damage === "duplicate block") return { ...actual, blocks: [...actual.blocks, block] };
        if (damage === "unassociated")
          return {
            ...actual,
            blocks: [
              ...actual.blocks,
              { ...block, label: "unassociated.call", instructions: [jsrs[0]!] },
            ],
          };
        if (damage === "late") {
          const later: MachineBlock = { ...block, label: "later.call", instructions: jsrs };
          return {
            ...actual,
            blocks: [
              ...actual.blocks.map<MachineBlock>((item) =>
                item !== block
                  ? item
                  : {
                      ...item,
                      instructions: item.instructions.filter((item) => item.opcode !== "jsr"),
                      terminator: { kind: "fallthrough", target: later.label },
                    },
              ),
              later,
            ],
            observerBlocks: actual.observerBlocks!.map(
              ([source, labels]) =>
                [source, labels.includes(block.label) ? [...labels, later.label] : labels] as const,
            ),
          };
        }
        let ordinal = 0;
        let instructions = block.instructions.map<MachineInstruction>((item) => {
          if (item.opcode !== "jsr") return item;
          const index = ordinal++;
          if (damage === "reordered") return jsrs[1 - index]!;
          if (damage === "same object") return jsrs[0]!;
          if (index !== 0) return item;
          if (damage === "wrong callee") return { ...item, operand: jsrs[1]!.operand };
          if (damage === "block entry")
            return { ...item, operand: { kind: "label", label: callee.blocks[0]!.label } };
          if (damage === "offset") return { ...item, operand: { ...operand, offset: 1 } };
          if (damage === "address byte")
            return { ...item, operand: { ...operand, addressByte: "low" } };
          if (damage === "transform")
            return { ...item, operand: { ...operand, transform: "vic-sprite-block" } };
          if (damage === "span") {
            if (item.source === null) throw new Error("Expected call source span");
            return { ...item, source: { ...item.source, start: item.source.start + 1 } };
          }
          return item;
        });
        if (damage === "missing")
          instructions = instructions.filter((item) => item.opcode !== "jsr");
        if (damage === "extra") instructions = [...instructions, jsrs[0]!];
        return {
          ...actual,
          blocks: actual.blocks.map((item) => (item === block ? { ...item, instructions } : item)),
        };
      });
      expect(local(changed, side)).not.toBeNull();
      expect(validateSizeObservers(changed).kind).toBe("error");
    });

    it("should match callee value keys and span values without granting a forged receipt", () => {
      const input = effectFixture(SOURCES[3][1], "size", false, "original");
      const { fn } = owner(input, side);
      const block = fn.blocks.find((block) =>
        block.instructions.some((item) => item.opcode === "jsr"),
      )!;
      const operand = block.instructions.find((item) => item.opcode === "jsr")!.operand;
      if (operand?.kind !== "label") throw new Error("Expected real callee label");
      const changed = alter(input, side, (actual) =>
        actual.id === operand.label && actual.sourceFunction !== undefined
          ? { ...actual, sourceFunction: { ...actual.sourceFunction } }
          : actual !== fn
            ? actual
            : {
                ...actual,
                blocks: actual.blocks.map((block) => ({
                  ...block,
                  instructions: block.instructions.map((item) =>
                    item.opcode === "jsr" && item.source !== null
                      ? { ...item, source: { ...item.source } }
                      : item,
                  ),
                })),
              },
      );
      expect(local(changed, side)).toBeNull();
      expect(validateSizeObservers(changed).kind).toBe("error");
    });

    it("should still reject a direct intervening write to the counter", () => {
      const input = effectFixture(OUTSIDE_CALL, "size", false, "original");
      const { fn, loop } = owner(input, side);
      const initial = fn.observerBlocks!.find(([source]) => source === loop.preheader)![1];
      const store = fn.blocks
        .filter((block) => initial.includes(block.label))
        .flatMap((block) => block.instructions)
        .find((item) => item.opcode === "sta" && item.source === loop.initialization.span)!;
      const changed = alter(input, side, (actual) =>
        actual !== fn
          ? actual
          : {
              ...actual,
              blocks: actual.blocks.map((block) =>
                !block.instructions.some((item) => item.opcode === "jsr")
                  ? block
                  : { ...block, instructions: [store, ...block.instructions] },
              ),
            },
      );
      expect(local(changed, side)).toBeNull();
      expect(validateResidualEffects(changed).kind).toBe("rejected");
      expect(validateSizeObservers(changed).kind).toBe("error");
    });
  });

  it.each(["reference", "candidate"] as const)(
    "should keep closed storage prerequisite authoritative in %s",
    (side) => {
      const input = effectFixture(SOURCES[8][1], "size", false, "original");
      const shared = input[side].shared;
      const replacement = {
        ...shared,
        certificate: {
          ...shared.certificate,
          certificate: {
            ...shared.certificate.certificate,
            homes: [],
            interference: [],
            helperCalls: [],
          },
        },
      };
      const changed =
        side === "reference"
          ? { ...input, reference: { ...input.reference, shared: replacement } }
          : { ...input, candidate: { ...input.candidate, shared: replacement } };
      expect(local(changed, side)).toBeNull();
      expect(validateSizeObservers(changed).kind).toBe("error");
    },
  );

  it("should retain raw exclusion against both actual counter homes", () => {
    const pilot = effectFixture(OUTSIDE_CALL, "size", false, "original");
    const { loop, shared } = owner(pilot, "reference");
    const request = shared.certificate.inventory.requests.find(
      (request) => request.binding === loop.counter,
    )!;
    const home = shared.certificate.certificate.homes.find(
      (home) => home.requestId === request.id,
    )!;
    const source = OUTSIDE_CALL.replace("$C140", `$${home.address.toString(16).padStart(4, "0")}`);
    const input = effectFixture(source, "size", false, "original");
    expect(local(input, "candidate")).toBeNull();
    const result = validateSizeObservers(input);
    expect(result.kind).toBe("rejected");
    if (result.kind !== "complete")
      expect(result.reason).toContain("overlaps an actual original or selected object");
  });

  it.each([
    [
      "own region",
      `module Game;let data:byte[8]=[;0];function touch():void{}function main():void{for(let i:word=0;i<8;i+=1){data[i]=byte(i);touch();}}`,
    ],
    [
      "parent region",
      "module Game;let data:byte[8]=[;0];function touch():void{}function main():void{for(let i:word=0;i<8;i+=1){touch();for(let j:word=i+1;j<8;j+=1){data[j]=byte(i);}}}",
    ],
    [
      "unknown raw",
      `module Game;let data:byte[8]=[;0];function touch():void{poke(peekw($C140),1);}function main():void{${LOOP}touch();}`,
    ],
    [
      "aggregate result",
      `module Game;let data:byte[8]=[;0];function make():byte[2]{return [1,2];}function main():void{${LOOP}let value:byte[2]=make();}`,
    ],
    [
      "callable root",
      `module Game;let data:byte[8]=[;0];function touch():void{}let callback:fn():void=&touch;function main():void{${LOOP}touch();}`,
    ],
    [
      "asynchronous root",
      `module Game;import {setIRQ,restoreIRQ} from c64.system;let data:byte[8]=[;0];interrupt function handler():void{}function touch():void{}function main():void{setIRQ(&handler);${LOOP}touch();restoreIRQ();}`,
    ],
  ])("should keep %s unsupported", (_name, source) => {
    expect(validateSizeObservers(effectFixture(source, "size", false, "original")).kind).toBe(
      "rejected",
    );
  });

  it.each([false, true])(
    "should preserve both exact serializations and resource certificates, bounds=%s",
    (bounds) => {
      const input = effectFixture(SOURCES[8][1], "size", bounds, "original");
      const before = [input.reference.shared, input.candidate.shared].map((shared) => ({
        assembly: serializeAcme({
          layout: shared.layout,
          certificate: shared.certificate.certificate,
          profile: input.checked.profile,
        }),
        resources: JSON.stringify(
          [shared.certificate.inventory.requests, shared.certificate.certificate],
          (_key, value) => (typeof value === "bigint" ? value.toString() : value),
        ),
      }));
      expect(validateSizeObservers(input).kind).toBe("complete");
      for (const [index, shared] of [input.reference.shared, input.candidate.shared].entries()) {
        expect(before[index]!.assembly.kind).toBe("complete");
        expect(
          serializeAcme({
            layout: shared.layout,
            certificate: shared.certificate.certificate,
            profile: input.checked.profile,
          }),
        ).toEqual(before[index]!.assembly);
        expect(
          JSON.stringify(
            [shared.certificate.inventory.requests, shared.certificate.certificate],
            (_key, value) => (typeof value === "bigint" ? value.toString() : value),
          ),
        ).toBe(before[index]!.resources);
      }
    },
  );
});

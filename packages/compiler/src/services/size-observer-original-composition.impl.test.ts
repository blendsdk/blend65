import { describe, expect, it } from "vitest";
import { effectFixture } from "../../test-support/size-observer-effects-fixture.js";
import { validateResidualEffects } from "./size-observer-effects.js";
import { validateSizeObservers } from "./size-observers.js";
import { serializeAcme } from "../artifacts/acme-serializer.js";
import type { MachineFunction } from "../machine/machine-types.js";

/** One real independently closed pair; invalid copies never acquire producer authority. */
type Input = ReturnType<typeof effectFixture>;

/** Collect actual conditional facts, never construct a fact or infer it from a name. */
function loops(input: Input) {
  const facts = input.candidate.lowered.program.storageSelection!.sourceFacts;
  return [...facts.functions.values()].flatMap((packet) => packet.loops);
}

/** Resolve retained word homes in this construction rather than borrowing its peer's addresses. */
function homes(input: Input, shared: Input["candidate"]["shared"]) {
  return loops(input).map((loop) => {
    const request = shared.certificate.inventory.requests.find(
      (request) => request.owner === loop.function.id && request.binding === loop.counter,
    );
    const home = shared.certificate.certificate.homes.find(
      (home) => home.requestId === request?.id,
    );
    if (request === undefined || home === undefined)
      throw new Error("Expected an actual word home");
    return { request, home };
  });
}

/** Target one actual source owner; keep symbolic authority untouched for atomic-rejection tests. */
function actual(input: Input, change: (fn: MachineFunction) => MachineFunction): Input {
  const shared = input.candidate.shared;
  return {
    ...input,
    candidate: {
      ...input.candidate,
      shared: {
        ...shared,
        layout: {
          ...shared.layout,
          program: {
            ...shared.layout.program,
            functions: shared.layout.program.functions.map(change),
          },
        },
      },
    },
  };
}

/** Retain the exact ordinary source previously isolated as an unsupported constant nest. */
const CONSTANT_NEST =
  "module Game;let data:byte[8];function main():void{for(let i:word=0;i<8;i+=1){for(let j:word=0;j<8;j+=1){data[j]=byte(i);}}}";
/** Explicit initialization makes every unwritten byte an independent behavior expectation. */
const SOURCES = [
  ["constant nest", CONSTANT_NEST],
  [
    "parent-next",
    "module Game;let data:byte[8]=[;0];function main():void{for(let i:word=0;i<8;i+=1){for(let j:word=i+1;j<8;j+=1){data[j]=byte(i);}}}",
  ],
  [
    "prefixed entry",
    "module Game;let data:byte[8]=[;0];let stop:byte=0;function work():boolean{if(stop!=0){return false;}for(let i:word=0;i<8;i+=1){data[i]=byte(i);}return true;}function main():void{work();}",
  ],
  [
    "sequential",
    "module Game;let data:byte[8]=[;0];function main():void{for(let i:word=0;i<8;i+=1){data[i]=byte(i);}for(let j:word=0;j<8;j+=1){data[j]=byte(j+1);}}",
  ],
  [
    "nested exits",
    "module Game;let data:byte[8]=[;0];let stop:byte=0;function work():boolean{if(stop!=0){return false;}for(let i:word=0;i<8;i+=1){if(i==1){continue;}for(let j:word=i+1;j<8;j+=1){if(j==4){break;}if(j==7){return false;}data[j]=byte(i);}}return true;}function main():void{work();}",
  ],
  [
    "bounded left shift",
    "module Game;let data:byte[8]=[;0];let seed:byte=3;let answer:byte=0;function main():void{for(let i:word=0;i<8;i+=1){data[i]=byte(i);}let count:byte=seed&7;answer=1<<count;}",
  ],
  [
    "bounded right shift",
    "module Game;let data:byte[8]=[;0];let seed:byte=3;let answer:byte=0;function main():void{for(let i:word=0;i<8;i+=1){data[i]=byte(i);}let count:byte=seed&7;answer=byte(128)>>count;}",
  ],
  [
    "fresh left count flags",
    "module Game;let data:byte[8]=[;0];let seed:byte=3;let answer:byte=0;function main():void{for(let i:word=0;i<8;i+=1){data[i]=byte(i);}let value:byte=seed;let count:byte=seed&7;answer=value<<count;}",
  ],
  [
    "fresh right count flags",
    "module Game;let data:byte[8]=[;0];let seed:byte=128;let answer:byte=0;function main():void{for(let i:word=0;i<8;i+=1){data[i]=byte(i);}let value:byte=seed;let count:byte=seed&7;answer=value>>count;}",
  ],
  [
    "full-width left count",
    "module Game;let data:byte[8]=[;0];let seed:word=256;let answer:byte=0;function main():void{for(let i:word=0;i<8;i+=1){data[i]=byte(i);}answer=1<<seed;}",
  ],
  [
    "full-width right count",
    "module Game;let data:byte[8]=[;0];let seed:word=65535;let answer:byte=0;function main():void{for(let i:word=0;i<8;i+=1){data[i]=byte(i);}answer=byte(128)>>seed;}",
  ],
  [
    "shared byte returns",
    "module Game;let data:byte[8]=[;0];let seed:byte=1;let answer:byte=0;function work():byte{for(let i:word=0;i<8;i+=1){data[i]=byte(i);}if(seed==0){return 0;}if(seed==1){return 127;}if(seed==2){return 255;}if(seed==3){return 0;}if(seed==4){return 127;}if(seed==5){return 255;}if(seed==6){return 0;}if(seed==7){return 127;}return 255;}function main():void{answer=work();}",
  ],
  [
    "shared signed byte returns",
    "module Game;const LOW:sbyte=-128;const MIDDLE:sbyte=-1;const HIGH:sbyte=127;let data:byte[8]=[;0];let seed:byte=1;let answer:sbyte=0;function work():sbyte{for(let i:word=0;i<8;i+=1){data[i]=byte(i);}if(seed==0){return LOW;}if(seed==1){return MIDDLE;}if(seed==2){return HIGH;}if(seed==3){return LOW;}if(seed==4){return MIDDLE;}if(seed==5){return HIGH;}if(seed==6){return LOW;}if(seed==7){return MIDDLE;}return HIGH;}function main():void{answer=work();}",
  ],
  [
    "shared enum returns",
    "module Game;enum Status{ZERO=0,MIDDLE=127,HIGH=255}let data:byte[8]=[;0];let seed:byte=1;let answer:Status=Status.ZERO;function work():Status{for(let i:word=0;i<8;i+=1){data[i]=byte(i);}if(seed==0){return Status.ZERO;}if(seed==1){return Status.MIDDLE;}if(seed==2){return Status.HIGH;}if(seed==3){return Status.ZERO;}if(seed==4){return Status.MIDDLE;}if(seed==5){return Status.HIGH;}if(seed==6){return Status.ZERO;}if(seed==7){return Status.MIDDLE;}return Status.HIGH;}function main():void{answer=work();}",
  ],
  [
    "raw caller with typed conditional return",
    "module Game;let data:byte[8]=[;0];let seed:byte=1;let answer:byte=0;function choose(value:byte):byte{if(value==0){return 7;}return 9;}function main():void{for(let i:word=0;i<8;i+=1){data[i]=peek($C110+i);}answer=choose(seed);}",
  ],
  [
    "raw caller with typed conditional write",
    "module Game;let data:byte[8]=[;0];let seed:byte=1;let answer:byte=0;function mark(value:byte):void{if(value!=0){answer=7;}else{answer=9;}}function main():void{for(let i:word=0;i<8;i+=1){data[i]=peek($C110+i);}mark(seed);}",
  ],
  [
    "layout bridge",
    "module Game;let data:byte[8]=[;0];let seed:byte=1;let other:byte=3;let answer:byte=0;function work():byte{for(let i:word=0;i<8;i+=1){data[i]=byte(i);}if(other==0&&seed>=5){return 0;}if(seed==0){if(other>=5){return 0;}}else if(other!=0){return 2;}if(seed>=5){return 0;}return 2;}function main():void{answer=work();}",
  ],
] as const;

describe("Original induction composition", () => {
  it.each([false, true])("should retain borrowed-index containment with bounds=%s", (bounds) => {
    const input = effectFixture(
      "module Game;let data:byte[8]=[;0];let answer:byte=0;function read(values:const byte[8],at:word):byte{if(at!=0){return values[at];}return values[0];}function main():void{for(let i:word=0;i<8;i+=1){data[i]=peek($C110+i);}answer=read(data,word(peek($C100)));}",
      "size",
      bounds,
      "original",
    );
    const result = validateSizeObservers(input);
    expect(result.kind).toBe("rejected");
    if (result.kind !== "complete")
      expect(result.reason).toBe("Typed access is not proved contained in its source object");
  });

  it.each([
    "missing owner",
    "wrong owner",
    "duplicate owner",
    "source identity",
    "foreign entry",
    "instruction",
    "target",
    "cycle",
    "origin",
    "direction",
    "cost",
  ])("should reject an actual bridge with %s at its responsible boundary", (damage) => {
    const input = effectFixture(SOURCES.at(-1)![1], "size", false, "original");
    expect(validateResidualEffects(input).kind).toBe("complete");
    expect(validateSizeObservers(input).kind).toBe("complete");
    for (const side of ["reference", "candidate"] as const) {
      const shared = side === "reference" ? input.reference.shared : input.candidate.shared;
      const damaged = actual({ ...input, candidate: { ...input.candidate, shared } }, (fn) => {
        if (fn.sourceFunction !== loops(input)[0]!.function.id) return fn;
        const parent = fn.blocks.find((block) => {
          const edge = block.terminator;
          return (
            edge.kind === "branch" &&
            fn.blocks.some(
              (next) =>
                next.label === edge.fallthrough &&
                next.instructions.length === 0 &&
                next.terminator.kind === "jump",
            )
          );
        })!;
        const edge = parent.terminator;
        if (edge.kind !== "branch") throw new Error("Expected the real conditional bridge");
        const bridge = fn.blocks.find((block) => block.label === edge.fallthrough)!;
        const transfer = bridge.terminator;
        if (transfer.kind !== "jump") throw new Error("Expected the real JMP continuation");
        const owner = fn.observerBlocks!.find(([, labels]) => labels.includes(parent.label))![0];
        const foreign = fn.observerBlocks!.find(([source]) => source !== owner)![0];
        expect(fn.observerBlocks!.find(([source]) => source === owner)![1]).toContain(bridge.label);
        return {
          ...fn,
          observerBlocks: fn.observerBlocks!.map(
            ([source, labels]) =>
              [
                damage === "source identity" && source === owner ? { ...source } : source,
                damage === "missing owner"
                  ? labels.filter((label) => label !== bridge.label)
                  : damage === "wrong owner"
                    ? source === owner
                      ? labels.filter((label) => label !== bridge.label)
                      : source === foreign
                        ? [...labels, bridge.label]
                        : labels
                    : damage === "duplicate owner" && source === owner
                      ? [...labels, bridge.label]
                      : labels,
              ] as const,
          ),
          blocks: fn.blocks.map((block) => {
            if (block === parent && damage === "direction")
              return {
                ...block,
                terminator: { ...edge, opcode: edge.opcode === "bcc" ? "bcs" : "bcc" },
              };
            if (block === fn.blocks[0] && damage === "foreign entry")
              return {
                ...block,
                terminator: {
                  kind: "jump",
                  opcode: "jmp",
                  target: bridge.label,
                  cost: { bytes: 3, minCycles: 3, maxCycles: 3 },
                },
              };
            if (block !== bridge) return block;
            return {
              ...block,
              ...(damage === "origin" ? { origin: block.origin! + 1 } : {}),
              instructions:
                damage === "instruction" ? [parent.instructions[0]!] : block.instructions,
              terminator:
                damage === "target"
                  ? { ...transfer, target: fn.blocks[0]!.label }
                  : damage === "cycle"
                    ? { ...transfer, target: bridge.label }
                    : damage === "cost"
                      ? { ...transfer, cost: { ...transfer.cost, bytes: 4 } }
                      : transfer,
            };
          }),
        };
      }).candidate.shared;
      const changed =
        side === "reference"
          ? { ...input, reference: { ...input.reference, shared: damaged } }
          : { ...input, candidate: { ...input.candidate, shared: damaged } };
      if (
        [
          "missing owner",
          "wrong owner",
          "duplicate owner",
          "source identity",
          "foreign entry",
          "target",
          "cycle",
        ].includes(damage)
      )
        expect(validateResidualEffects(changed).kind).not.toBe("complete");
      expect(validateSizeObservers(changed).kind).toBe("error");
    }
  });

  describe.each(SOURCES)("%s", (_name, source) => {
    it.each([false, true])(
      "should discharge the complete retained word group with bounds=%s",
      (bounds) => {
        const input = effectFixture(source, "size", bounds, "original");
        expect(input.candidate.shared).not.toBe(input.reference.shared);
        expect(validateResidualEffects(input).kind).toBe("complete");
        expect(validateSizeObservers(input).kind).toBe("complete");
      },
    );
  });

  it("should retain every sibling maximum and publish only the complete group", () => {
    const input = effectFixture(SOURCES[1][1], "size", true, "original");
    const group = loops(input);
    const result = validateResidualEffects(input);
    expect(result.kind).toBe("complete");
    if (result.kind !== "complete") throw new Error(result.reason);
    expect(group).toHaveLength(2);
    expect(group[1]!.initial).toMatchObject({
      kind: "parent-next",
      domain: { minimum: 1, maximum: 8 },
    });
    expect(group[1]!.tripDomain).toEqual({ minimum: 0, maximum: 7 });
    const expected = new Map<string, bigint>();
    for (const loop of group) {
      expect(result.loops.has(loop)).toBe(true);
      for (const [value, maximum] of loop.valueBounds) {
        const previous = expected.get(value);
        if (previous === undefined || maximum < previous) expected.set(value, maximum);
      }
    }
    expect(result.bounds.get(group[0]!.function.id)).toEqual(expected);
    expect(
      [...expected].filter(([value]) => !group[1]!.valueBounds.has(value)).length,
    ).toBeGreaterThan(0);
    for (const shared of [input.reference.shared, input.candidate.shared]) {
      const words = homes(input, shared);
      expect(words.every(({ home, request }) => home.bytes === 2 && request.bytes === 2)).toBe(
        true,
      );
      expect(
        words[0]!.home.address + 2 <= words[1]!.home.address ||
          words[1]!.home.address + 2 <= words[0]!.home.address,
      ).toBe(true);
    }
  });

  it.each(SOURCES)(
    "should leave both %s constructions and closed resources unchanged",
    (_name, source) => {
      const input = effectFixture(source, "size", false, "original");
      const snapshots = [input.reference.shared, input.candidate.shared].map((shared) => ({
        assembly: serializeAcme({
          layout: shared.layout,
          certificate: shared.certificate.certificate,
          profile: input.checked.profile,
        }),
        inventory: shared.certificate.inventory.requests,
        certificate: shared.certificate.certificate,
        resources: JSON.stringify(
          [shared.certificate.inventory.requests, shared.certificate.certificate],
          (_key, value) => (typeof value === "bigint" ? value.toString() : value),
        ),
      }));
      expect(validateSizeObservers(input).kind).toBe("complete");
      for (const [index, shared] of [input.reference.shared, input.candidate.shared].entries()) {
        expect(snapshots[index]!.assembly.kind).toBe("complete");
        expect(
          serializeAcme({
            layout: shared.layout,
            certificate: shared.certificate.certificate,
            profile: input.checked.profile,
          }),
        ).toEqual(snapshots[index]!.assembly);
        expect(shared.certificate.inventory.requests).toBe(snapshots[index]!.inventory);
        expect(shared.certificate.certificate).toBe(snapshots[index]!.certificate);
        expect(
          JSON.stringify(
            [shared.certificate.inventory.requests, shared.certificate.certificate],
            (_key, value) => (typeof value === "bigint" ? value.toString() : value),
          ),
        ).toBe(snapshots[index]!.resources);
      }
    },
  );

  it.each([0, 1])(
    "should reject a stale loop-%i premise without returning partial bounds",
    (index) => {
      const input = effectFixture(SOURCES[1][1], "size", false, "original");
      const bound = loops(input)[index]!.valueBounds;
      if (!(bound instanceof Map)) throw new Error("Expected the producer-owned map");
      const [value, maximum] = [...bound][0]!;
      try {
        bound.set(value, maximum + 1n);
        expect(validateResidualEffects(input).kind).toBe("error");
        expect(validateSizeObservers(input).kind).toBe("error");
      } finally {
        bound.set(value, maximum);
      }
      expect(validateSizeObservers(input).kind).toBe("complete");
    },
  );

  it.each([
    ["reference", 0],
    ["reference", 1],
    ["candidate", 0],
    ["candidate", 1],
  ] as const)("should reject incomplete %s loop-%i physical homes", (construction, index) => {
    const input = effectFixture(SOURCES[1][1], "size", false, "original");
    const shared = construction === "reference" ? input.reference.shared : input.candidate.shared;
    const id = homes(input, shared)[index]!.home.requestId;
    const replacement = {
      ...shared,
      certificate: {
        ...shared.certificate,
        certificate: {
          ...shared.certificate.certificate,
          homes: shared.certificate.certificate.homes.map((home) =>
            home.requestId === id ? { ...home, bytes: 1 } : home,
          ),
        },
      },
    };
    const changed =
      construction === "reference"
        ? { ...input, reference: { ...input.reference, shared: replacement } }
        : { ...input, candidate: { ...input.candidate, shared: replacement } };
    expect(validateResidualEffects(changed).kind).toBe("rejected");
    expect(validateSizeObservers(changed).kind).toBe("error");
  });

  it.each(["preheader", "update"] as const)("should reject a missing %s counter write", (role) => {
    const input = effectFixture(SOURCES[1][1], "size", false, "original");
    const loop = loops(input)[1]!;
    const changed = actual(input, (fn) =>
      fn.sourceFunction !== loop.function.id
        ? fn
        : {
            ...fn,
            blocks: fn.blocks.map((block) =>
              !fn.observerBlocks
                ?.find(([source]) => source === loop[role])?.[1]
                .includes(block.label)
                ? block
                : {
                    ...block,
                    instructions: block.instructions.filter((item) => item.opcode !== "sta"),
                  },
            ),
          },
    );
    expect(validateResidualEffects(changed).kind).toBe("rejected");
    expect(validateSizeObservers(changed).kind).toBe("error");
  });

  it("should reject entry into the body without the real initializer", () => {
    const input = effectFixture(SOURCES[2][1], "size", false, "original");
    const loop = loops(input)[0]!;
    const changed = actual(input, (fn) =>
      fn.sourceFunction !== loop.function.id
        ? fn
        : {
            ...fn,
            blocks: fn.blocks.map((block) =>
              block !== fn.blocks[0] || block.terminator.kind !== "branch"
                ? block
                : {
                    ...block,
                    terminator: {
                      ...block.terminator,
                      fallthrough: fn.observerBlocks!.find(
                        ([source]) => source === loop.body,
                      )![1][0]!,
                    },
                  },
            ),
          },
    );
    expect(validateResidualEffects(changed).kind).toBe("error");
    expect(validateSizeObservers(changed).kind).toBe("error");
  });

  it.each(["wrong value", "jump", "instruction"] as const)(
    "should not accept a shared constant return with %s",
    (damage) => {
      const input = effectFixture(SOURCES[4][1], "size", false, "original");
      const changed = actual(input, (fn) => {
        if (fn.sourceFunction !== loops(input)[0]!.function.id) return fn;
        const alias = fn.blocks.find((block) => {
          const edge = block.terminator;
          return (
            block.instructions.length === 0 &&
            edge.kind === "fallthrough" &&
            fn.blocks.some(
              (target) =>
                target.label === edge.target &&
                target.terminator.kind === "return" &&
                target.instructions.length === 1,
            )
          );
        });
        if (alias?.terminator.kind !== "fallthrough")
          throw new Error("Expected a real shared return");
        const target = alias.terminator.target;
        return {
          ...fn,
          blocks: fn.blocks.map((block) =>
            damage === "wrong value" && block.label === target
              ? {
                  ...block,
                  instructions: block.instructions.map((item) => ({
                    ...item,
                    operand: { kind: "immediate", value: 1 },
                  })),
                }
              : block !== alias
                ? block
                : damage === "jump"
                  ? {
                      ...block,
                      terminator: {
                        kind: "jump",
                        opcode: "jmp",
                        target,
                        cost: { bytes: 3, minCycles: 3, maxCycles: 3 },
                      },
                    }
                  : damage === "instruction"
                    ? {
                        ...block,
                        instructions: fn.blocks.find((block) => block.label === target)!
                          .instructions,
                      }
                    : block,
          ),
        };
      });
      expect(validateResidualEffects(changed).kind).not.toBe("complete");
      expect(validateSizeObservers(changed).kind).toBe("error");
    },
  );

  it.each([0, 1])(
    "should check raw overlap against loop-%i rather than only the last home",
    (index) => {
      const source = (base: number) =>
        `module Game;let data:byte[8]=[;0];function main():void{for(let i:word=0;i<8;i+=1){for(let j:word=i+1;j<8;j+=1){data[j]=peek($${base.toString(16).padStart(4, "0")}+${index === 0 ? "i" : "j"});}}}`;
      const pilot = effectFixture(source(0xc130), "size", false, "original");
      expect(validateSizeObservers(pilot).kind).toBe("complete");
      const base = homes(pilot, pilot.reference.shared)[index]!.home.address;
      const input = effectFixture(source(base), "size", false, "original");
      expect(homes(input, input.reference.shared).map(({ home }) => home.address)).toEqual(
        homes(pilot, pilot.reference.shared).map(({ home }) => home.address),
      );
      const rejected = validateSizeObservers(input);
      expect(rejected.kind).toBe("rejected");
      if (rejected.kind !== "complete")
        expect(rejected.reason).toContain("overlaps an actual original or selected object");
    },
  );

  it.each([
    [
      "conditional raw callee",
      "module Game;let data:byte[8]=[;0];let seed:byte=1;let answer:byte=0;function read(value:byte):byte{if(value!=0){return peek($C100);}return 0;}function main():void{for(let i:word=0;i<8;i+=1){data[i]=peek($C110+i);}answer=read(seed);}",
    ],
    [
      "conditional status callee",
      "module Game;let data:byte[8]=[;0];let seed:byte=1;function mark(value:byte):void{if(value!=0){asm_php();asm_plp();}}function main():void{for(let i:word=0;i<8;i+=1){data[i]=peek($C110+i);}mark(seed);}",
    ],
    [
      "standalone zero-trip",
      "module Game;let data:byte[8];function main():void{for(let i:word=8;i<8;i+=1){data[0]=1;}}",
    ],
    [
      "two-counter raw sum",
      "module Game;let data:byte[8]=[;0];function main():void{for(let i:word=0;i<8;i+=1){for(let j:word=i+1;j<8;j+=1){data[j]=peek($C110+i+j);}}}",
    ],
    [
      "parameter counter",
      "module Game;let data:byte[8]=[;0];function work(i:word):void{for(i=0;i<8;i+=1){data[i]=byte(i);}}function main():void{work(0);}",
    ],
    [
      "reused counter binding",
      "module Game;let data:byte[8]=[;0];function main():void{let i:word=0;for(i=0;i<8;i+=1){data[i]=byte(i);}for(i=0;i<8;i+=1){data[i]=byte(i);}}",
    ],
  ])("should retain unsupported %s tuple rejection", (_name, source) => {
    expect(validateSizeObservers(effectFixture(source, "size", false, "original")).kind).toBe(
      "rejected",
    );
  });
});

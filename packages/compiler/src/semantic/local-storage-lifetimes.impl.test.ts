import { describe, expect, it } from "vitest";
import type { ArrayType } from "../frontend/semantic-types.js";
import { bindingIdentityKey } from "../frontend/semantic-types.js";
import {
  BYTE,
  VOID,
  semanticBlock,
  semanticFunction,
  sourceBinding,
  sourceParameter,
  sourceSpan,
  wholeProgramFor,
  selectedProfile,
} from "../machine/lowering-test-support.js";
import {
  deriveLocalStorageLifetimes,
  validLocalStorageLifetime,
} from "./local-storage-lifetimes.js";
import { deriveClosedObjectFacts } from "./closed-object-facts.js";
import { lowerMachineProgram } from "../machine/lower.js";
import { machineInstruction } from "../machine/lower-control.js";
import { inventoryStorage } from "../storage/inventory.js";
import { coveredBindingRequests, machineStorageAccesses } from "../storage/interference.js";

/** Use original binding and CFG identities to test content seals without machine allocation. */
function sealedFixture(ambiguous = false) {
  const binding = sourceBinding(100);
  const place = { root: binding, rootType: BYTE, path: [] };
  const fn = semanticFunction(0, "main", [], VOID, [
    semanticBlock(
      "entry",
      [
        {
          kind: "constant",
          result: "seven",
          value: 7n,
          type: BYTE,
          integer: null,
          span: sourceSpan(10),
        },
        { kind: "store", place, value: "seven", type: BYTE, span: sourceSpan(20) },
        {
          kind: "load",
          result: "read",
          place,
          type: BYTE,
          integer: null,
          span: sourceSpan(ambiguous ? 20 : 30),
        },
      ],
      { kind: "return", value: null },
    ),
  ]);
  const program = {
    ...wholeProgramFor([fn]),
    executionDomains: [{ function: fn.id, domains: ["main" as const] }],
  };
  const key = bindingIdentityKey(binding);
  const lifetime = deriveLocalStorageLifetimes(program).get(key)!;
  return { program, fn, key, lifetime };
}

describe("conditional binding lifetime authority", () => {
  it("should accept only the original source, function and binding key", () => {
    const fixture = sealedFixture();
    expect(validLocalStorageLifetime(fixture.program, fixture.key, fixture.lifetime)).toBe(true);
    expect(validLocalStorageLifetime(fixture.program, "another-binding", fixture.lifetime)).toBe(
      false,
    );
    expect(validLocalStorageLifetime({ ...fixture.program }, fixture.key, fixture.lifetime)).toBe(
      false,
    );
  });

  it("should reject altered occupied positions, definition and crossed calls", () => {
    const { program, key, lifetime } = sealedFixture();
    expect(validLocalStorageLifetime(program, key, { ...lifetime, liveAt: [] })).toBe(false);
    expect(
      validLocalStorageLifetime(program, key, {
        ...lifetime,
        definition: { block: "other", operation: 0 },
      }),
    ).toBe(false);
    expect(
      validLocalStorageLifetime(program, key, { ...lifetime, callsCrossed: [sourceSpan(40)] }),
    ).toBe(false);
  });

  it("should reject an unsealed lookalike with identical lifetime fields", () => {
    const { program, key, lifetime } = sealedFixture();
    const { function: owner, value, definition, liveAt, callsCrossed } = lifetime;
    expect(
      validLocalStorageLifetime(program, key, {
        function: owner,
        value,
        definition,
        liveAt,
        callsCrossed,
      }),
    ).toBe(false);
  });
});

describe("selected access coverage fallback", () => {
  it.each([
    "covered",
    "unknown",
    "outside",
    "effect",
    "ambiguous",
    "unknown-context",
    "callable",
    "irq",
    "snapshot",
    "missing-owner",
  ] as const)("should admit only exact occupied source associations for %s", (kind) => {
    const fixture = sealedFixture(kind === "ambiguous");
    const { fn, key } = fixture;
    const { executionDomains: _domains, ...unknownContext } = fixture.program;
    const program =
      kind === "unknown-context"
        ? unknownContext
        : kind === "callable"
          ? {
              ...fixture.program,
              roots: [...fixture.program.roots, { kind: "callable" as const, function: fn.id }],
            }
          : kind === "irq"
            ? {
                ...fixture.program,
                executionDomains: [{ function: fn.id, domains: ["main" as const, "irq" as const] }],
              }
            : fixture.program;
    const lifetime = deriveLocalStorageLifetimes(program).get(key)!;
    const profile = selectedProfile();
    const inventory = inventoryStorage(program);
    const declared = inventory.requests.find(
      (request) => request.domain === "main" || request.domain === undefined,
    )!;
    const original =
      kind === "snapshot"
        ? { ...declared, id: "machine:snapshot", binding: null, storageClass: "temporary" as const }
        : declared;
    const lowered = lowerMachineProgram({ program, profile, logicalStorage: inventory });
    expect(lowered.kind).toBe("complete");
    if (lowered.kind !== "complete") return;
    const facts = {
      program,
      nonLoopBundle: "closed" as const,
      functions: new Map([
        [
          fn,
          {
            function: fn,
            loops: [],
            objects: deriveClosedObjectFacts(program, profile.storage),
            lifetimes: new Map([[key, lifetime]]),
          },
        ],
      ]),
    };
    const owner = lowered.program.functions.find((value) => value.sourceFunction === fn.id)!;
    const first = owner.blocks[0]!;
    const address = { kind: "storage" as const, requestId: original.id };
    const added = !["unknown", "outside", "effect"].includes(kind)
      ? []
      : [
          machineInstruction(
            profile.cpu,
            kind === "effect" ? "nop" : "lda",
            kind === "effect" ? "implied" : "storage",
            kind === "effect" ? null : address,
            kind === "effect"
              ? [{ kind: "read", address, width: 1, volatile: false, order: 0 }]
              : [],
            sourceSpan(kind === "outside" ? 10 : 99),
          ),
        ];
    const { sourceFunction: _source, ...missingOwner } = owner;
    const selected = {
      ...(kind === "missing-owner" ? missingOwner : owner),
      blocks: [
        { ...first, instructions: [...first.instructions, ...added] },
        ...owner.blocks.slice(1),
      ],
    };
    const accesses = machineStorageAccesses([lowered.program.startup, selected]);
    const projected = coveredBindingRequests(facts, [original], accesses);
    expect(projected[0]?.lifetime).toBe(kind === "covered" ? lifetime : original.lifetime);
  });
});

describe("private aggregate backing occupancy", () => {
  // A constructed result still names its destination while later arguments are
  // evaluated. An intervening retained store must not overwrite those bytes.
  it("should retain an aggregate destination through a later argument store and call", () => {
    const type: ArrayType = { kind: "array", element: BYTE, length: 1, size: 1 };
    const buffer = sourceBinding(100);
    const dead = sourceBinding(200);
    const place = { root: buffer, rootType: type, path: [] };
    const storeSpan = sourceSpan(40);
    const callSpan = sourceSpan(50);
    const consume = semanticFunction(
      10,
      "consume",
      [sourceParameter(11, type), sourceParameter(12, BYTE)],
      VOID,
      [semanticBlock("consume", [], { kind: "return", value: null })],
    );
    const main = semanticFunction(0, "main", [], VOID, [
      semanticBlock(
        "main",
        [
          {
            kind: "constant",
            result: "zero",
            value: 0n,
            type: BYTE,
            integer: null,
            span: sourceSpan(20),
          },
          {
            kind: "store",
            place: { root: dead, path: [] },
            value: "zero",
            type: BYTE,
            span: sourceSpan(21),
          },
          {
            kind: "constant",
            result: "seven",
            value: 7n,
            type: BYTE,
            integer: null,
            span: sourceSpan(30),
          },
          {
            kind: "aggregate",
            result: "payload",
            type,
            integer: null,
            span: sourceSpan(31),
            elements: [{ field: null, value: "seven" }],
            fill: null,
            destination: { kind: "place", place },
          },
          { kind: "store", place, value: "payload", type, span: sourceSpan(32) },
          {
            kind: "constant",
            result: "two",
            value: 2n,
            type: BYTE,
            integer: null,
            span: sourceSpan(39),
          },
          {
            kind: "store",
            place: { root: dead, path: [] },
            value: "two",
            type: BYTE,
            span: storeSpan,
          },
          {
            kind: "call",
            result: null,
            callee: consume.id,
            arguments: ["payload", "two"],
            type: VOID,
            span: callSpan,
          },
        ],
        { kind: "return", value: null },
      ),
    ]);
    const lives = deriveLocalStorageLifetimes(wholeProgramFor([main, consume]));
    const backing = lives.get(bindingIdentityKey(buffer));
    const overwritten = lives.get(bindingIdentityKey(dead));
    expect(backing).toBeDefined();
    expect(overwritten).toBeDefined();
    expect(backing?.liveAt).toContainEqual({ block: "main", operation: 6 });
    expect(overwritten?.liveAt).toContainEqual({ block: "main", operation: 6 });
    expect(backing?.callsCrossed).toContainEqual(callSpan);
  });
});

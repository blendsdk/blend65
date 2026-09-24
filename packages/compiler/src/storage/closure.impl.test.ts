import { describe, expect, it } from "vitest";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import type { SemanticBlock, SemanticFunction } from "../semantic/operations.js";
import type { ValueLifetime, WholeProgram } from "../semantic/whole-program.js";
import { closeStorage } from "./closure.js";
import type { StorageInventory, StorageProfile, StorageRequest } from "./storage-types.js";

const BYTE: SemanticType = Object.freeze({ kind: "scalar", name: "byte" });

function binding(start: number): BindingId {
  const span = Object.freeze({ sourceId: "src/closure-impl.blend", start, end: start + 1 });
  return Object.freeze({ sourceId: span.sourceId, span });
}

function fn(id: BindingId): SemanticFunction {
  const block: SemanticBlock = Object.freeze({
    id: `entry:${id.span.start}`,
    operations: Object.freeze([]),
    terminator: Object.freeze({ kind: "return", value: null }),
  });
  return Object.freeze({
    id,
    parameters: Object.freeze([]),
    result: Object.freeze({ kind: "scalar", name: "void" }),
    entry: block.id,
    blocks: Object.freeze([block]),
    source: id.span,
  });
}

function lifetime(owner: BindingId, value: string, operation = 1): ValueLifetime {
  return Object.freeze({
    function: owner,
    value,
    definition: Object.freeze({ block: `entry:${owner.span.start}`, operation: 0 }),
    liveAt: Object.freeze([Object.freeze({ block: `entry:${owner.span.start}`, operation })]),
    callsCrossed: Object.freeze([]),
  });
}

function request(owner: BindingId, id: string, bytes = 1, operation = 1): StorageRequest {
  return Object.freeze({
    id,
    storageClass: "helper-scratch",
    owner,
    binding: null,
    value: id,
    type: BYTE,
    bytes,
    alignment: 1,
    region: "ram",
    lifetime: lifetime(owner, id, operation),
    source: owner.span,
    reason: "Focused closure case",
  });
}

function inventory(
  functions: readonly SemanticFunction[],
  requests: readonly StorageRequest[] = [],
  results: StorageInventory["results"] = [],
): StorageInventory {
  const main = functions[0]!.id;
  const callees = functions.slice(1).map(({ id }) => id);
  const callGraph = functions.map(({ id }, index) =>
    Object.freeze({
      function: id,
      callees: Object.freeze(index + 1 < functions.length ? [functions[index + 1]!.id] : []),
    }),
  );
  return Object.freeze({
    program: Object.freeze({
      semantic: Object.freeze({
        main,
        globals: Object.freeze([]),
        functions: Object.freeze(functions),
        assets: Object.freeze([]),
        initializerOrder: Object.freeze([]),
      }),
      roots: Object.freeze([
        Object.freeze({ kind: "startup" as const }),
        Object.freeze({ kind: "main" as const, function: main }),
      ]),
      callGraph: Object.freeze(callGraph),
      effects: Object.freeze([]),
      lifetimes: Object.freeze([]),
      reachableFunctions: Object.freeze([main, ...callees]),
      reachableAssets: Object.freeze([]),
    }),
    requests: Object.freeze(requests),
    results: Object.freeze(results),
  });
}

function profile(capacity = 16): StorageProfile {
  return Object.freeze({
    profileId: "test-profile",
    zeroPage: Object.freeze([]),
    ram: Object.freeze([Object.freeze({ start: 0x4000, end: 0x4000 })]),
    hardwareStackCapacity: capacity,
    hardwareStackReserve: 2,
    interruptStackBytes: 3,
  });
}

describe("static storage closure implementation", () => {
  it("closes a discovered aggregate snapshot and pointer before final emission", () => {
    const main = fn(binding(110));
    const array: SemanticType = Object.freeze({
      kind: "array",
      element: BYTE,
      length: 300,
      size: 300,
    });
    const snapshot: StorageRequest = Object.freeze({
      ...request(main.id, "aggregate-snapshot", 300),
      storageClass: "temporary",
      type: array,
    });
    const pointer: StorageRequest = Object.freeze({
      ...request(main.id, "aggregate-pointer", 2),
      storageClass: "pointer",
      region: "zero-page-required",
    });
    const storage: StorageProfile = Object.freeze({
      ...profile(),
      zeroPage: Object.freeze([Object.freeze({ start: 0x40, end: 0x41 })]),
      ram: Object.freeze([Object.freeze({ start: 0x4000, end: 0x412b })]),
    });
    const rounds: number[] = [];
    const result = closeStorage(inventory([main]), storage, {
      candidateRequestIds: Object.freeze([snapshot.id, pointer.id]),
      helperCalls: Object.freeze([]),
      discover: (_placement, round) => {
        rounds.push(round);
        return Object.freeze([snapshot, pointer]);
      },
    });
    expect(rounds).toEqual([0, 1]);
    expect(result).toMatchObject({
      kind: "complete",
      certificate: {
        closed: true,
        staticBytes: { ram: 300, zeroPage: 2 },
      },
    });
    if (result.kind !== "complete") throw new Error("Expected aggregate closure");
    expect(result.certificate.homes.map(({ requestId }) => requestId)).toEqual(
      expect.arrayContaining([snapshot.id, pointer.id]),
    );

    const undeclared = closeStorage(inventory([main]), storage, {
      candidateRequestIds: Object.freeze([snapshot.id]),
      helperCalls: Object.freeze([]),
      discover: () => Object.freeze([snapshot, pointer]),
    });
    expect(undeclared).toEqual({ kind: "error", reason: "nonconvergent" });
    expect(undeclared).not.toHaveProperty("certificate");
  });

  it("adds one late request, stabilizes, and emits deterministic provisional evidence", () => {
    const main = fn(binding(1));
    const late = request(main.id, "late");
    const initial = inventory([main]);
    const rounds: number[] = [];
    const discover = (_placement: object, round: number): readonly StorageRequest[] => {
      rounds.push(round);
      return Object.freeze([late]);
    };

    const first = closeStorage(initial, profile(), {
      candidateRequestIds: Object.freeze([late.id]),
      helperCalls: Object.freeze([]),
      discover,
    });
    const second = closeStorage(initial, profile(), {
      candidateRequestIds: Object.freeze([late.id]),
      helperCalls: Object.freeze([]),
      discover: () => Object.freeze([late]),
    });

    expect(rounds).toEqual([0, 1]);
    expect(first).toEqual(second);
    expect(first).toMatchObject({
      kind: "complete",
      certificate: {
        profileId: "test-profile",
        staticBytes: { ram: 1, zeroPage: 0 },
        peakBytes: { ram: 1, zeroPage: 0 },
        hardwareStackPeak: 3,
        closed: true,
      },
    });
  });

  it("includes nested return addresses and interrupt entry in the stack capacity proof", () => {
    const initial = inventory([fn(binding(20)), fn(binding(21)), fn(binding(22))]);

    const exact = closeStorage(initial, profile(9), () => Object.freeze([]));
    expect(exact).toMatchObject({ kind: "complete", certificate: { hardwareStackPeak: 7 } });

    const exceeded = closeStorage(initial, profile(8), () => Object.freeze([]));
    expect(exceeded).toEqual({ kind: "error", reason: "stack" });
    expect(exceeded).not.toHaveProperty("certificate");
  });

  it("takes the deepest initializer call chain into the stack proof", () => {
    const main = fn(binding(30));
    const first = fn(binding(31));
    const second = fn(binding(32));
    const global = binding(33);
    const base = inventory([main, first, second]);
    const initial: StorageInventory = Object.freeze({
      ...base,
      program: Object.freeze({
        ...base.program,
        roots: Object.freeze([
          Object.freeze({ kind: "startup" as const }),
          Object.freeze({ kind: "initializer" as const, binding: global }),
          Object.freeze({ kind: "main" as const, function: main.id }),
        ]),
        callGraph: Object.freeze([
          Object.freeze({ function: main.id, callees: Object.freeze([]) }),
          Object.freeze({ function: first.id, callees: Object.freeze([second.id]) }),
          Object.freeze({ function: second.id, callees: Object.freeze([]) }),
        ]),
        initializers: Object.freeze([
          Object.freeze({
            binding: global,
            callees: Object.freeze([first.id]),
            lifetimes: Object.freeze([]),
          }),
        ]),
      }),
    });

    const result = closeStorage(initial, profile(), () => Object.freeze([]));
    expect(result).toMatchObject({ kind: "complete", certificate: { hardwareStackPeak: 9 } });
  });

  it("takes the larger program route before adding simultaneous interrupt use", () => {
    const initial = inventory([fn(binding(34)), fn(binding(35))]);
    const startupProfile: StorageProfile = Object.freeze({
      ...profile(32),
      startupStackBytes: 10,
    });

    const result = closeStorage(initial, startupProfile, () => Object.freeze([]));
    expect(result).toMatchObject({
      kind: "complete",
      certificate: {
        hardwareStackProgramPeak: 10,
        hardwareStackSystemPeak: 3,
        hardwareStackPeak: 13,
        hardwareStackRoute: ["startup"],
      },
    });
  });

  it("stops a callback which invents a new identity every round", () => {
    const main = fn(binding(40));
    const initial = inventory([main]);
    const roomyProfile: StorageProfile = Object.freeze({
      ...profile(),
      ram: Object.freeze([Object.freeze({ start: 0x4000, end: 0x40ff })]),
    });
    const result = closeStorage(initial, roomyProfile, {
      candidateRequestIds: Object.freeze(["late:0"]),
      helperCalls: Object.freeze([]),
      discover: (_placement, round) => Object.freeze([request(main.id, `late:${round}`)]),
    });

    expect(result).toEqual({ kind: "error", reason: "nonconvergent" });
    expect(result).not.toHaveProperty("certificate");
  });

  it("permits every declared candidate plus one final stability round", () => {
    const main = fn(binding(60));
    const initial = inventory([main]);
    const candidates = Object.freeze(
      Array.from({ length: 65 }, (_, index) => request(main.id, `finite:${index}`)),
    );
    const result = closeStorage(
      initial,
      {
        ...profile(),
        ram: Object.freeze([Object.freeze({ start: 0x4000, end: 0x40ff })]),
      },
      {
        candidateRequestIds: Object.freeze(candidates.map(({ id }) => id)),
        helperCalls: Object.freeze([]),
        discover: (_placement, round) => Object.freeze(candidates.slice(0, round + 1)),
      },
    );

    expect(result).toMatchObject({ kind: "complete" });
    if (result.kind !== "complete") throw new Error("Expected finite closure to stabilize");
    expect(result.inventory.requests).toHaveLength(65);
  });

  it("reports simultaneous demand instead of summing mutually exclusive requests", () => {
    const main = fn(binding(80));
    const initial = inventory(
      [main],
      [request(main.id, "left", 4, 1), request(main.id, "right", 4, 2)],
    );
    const result = closeStorage(
      initial,
      Object.freeze({
        zeroPage: Object.freeze([]),
        ram: Object.freeze([Object.freeze({ start: 0x5000, end: 0x5003 })]),
      }),
      () => Object.freeze([]),
    );

    expect(result).toMatchObject({
      kind: "complete",
      certificate: {
        staticBytes: { ram: 4, zeroPage: 0 },
        peakBytes: { ram: 4, zeroPage: 0 },
      },
    });
  });

  it("includes selected helper storage conflicts and stack bytes", () => {
    const main = fn(binding(90));
    const live = request(main.id, "live", 1, 1);
    const scratch = request(main.id, "scratch", 1, 2);
    const helperProfile: StorageProfile = Object.freeze({
      ...profile(),
      ram: Object.freeze([Object.freeze({ start: 0x4000, end: 0x4001 })]),
    });
    const result = closeStorage(inventory([main], [live, scratch]), helperProfile, {
      candidateRequestIds: Object.freeze([]),
      helperCalls: Object.freeze([
        Object.freeze({
          id: "helper:byte-multiply",
          caller: main.id,
          liveRequestIds: Object.freeze([live.id]),
          helperRequestIds: Object.freeze([scratch.id]),
          stackBytes: 4,
        }),
      ]),
      discover: () => Object.freeze([]),
    });

    expect(result).toMatchObject({
      kind: "complete",
      certificate: {
        hardwareStackPeak: 7,
        helperCalls: [{ id: "helper:byte-multiply" }],
        interference: [{ left: "live", right: "scratch", reason: "call-overlap" }],
      },
    });
    if (result.kind !== "complete") throw new Error("Expected helper-aware closure");
    expect(new Set(result.placement.homes.map(({ address }) => address)).size).toBe(2);
  });

  it("includes ABI result locations in the inventory identity", () => {
    const main = fn(binding(100));
    const a = closeStorage(
      inventory([main], [], [Object.freeze({ function: main.id, location: { kind: "a" } })]),
      profile(),
      () => Object.freeze([]),
    );
    const ax = closeStorage(
      inventory([main], [], [Object.freeze({ function: main.id, location: { kind: "ax" } })]),
      profile(),
      () => Object.freeze([]),
    );

    expect(a.kind).toBe("complete");
    expect(ax.kind).toBe("complete");
    if (a.kind !== "complete" || ax.kind !== "complete") {
      throw new Error("Expected both ABI certificates");
    }
    expect(a.certificate.inventoryHash).not.toBe(ax.certificate.inventoryHash);
  });
});

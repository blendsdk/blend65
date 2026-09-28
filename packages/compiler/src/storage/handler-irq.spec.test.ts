import { describe, expect, it } from "vitest";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import { bindMachineProgram } from "../machine/bind.js";
import type { MachineProgram } from "../machine/machine-types.js";
import { createC64Startup } from "../layout/startup.js";
import type { SourceSpan } from "../project/types.js";
import type {
  PlatformOperation,
  SemanticBlock,
  SemanticFunction,
  SemanticOperation,
  SemanticTerminator,
} from "../semantic/operations.js";
import type { ValueLifetime, WholeProgram } from "../semantic/whole-program.js";
import { closeSharedStorage } from "../services/shared-storage.js";
import { selectTargetProfile } from "../target/profile.js";
import { allocateStorage } from "./allocate.js";
import { closeStorage } from "./closure.js";
import { buildInterference } from "./interference.js";
import { simultaneousIRQStackPeak } from "./irq-stack.js";
import type {
  StorageBinder,
  StorageInventory,
  StorageProfile,
  StorageRequest,
} from "./storage-types.js";

const VOID: SemanticType = Object.freeze({ kind: "scalar", name: "void" });
const BYTE: SemanticType = Object.freeze({ kind: "scalar", name: "byte" });
const WORD: SemanticType = Object.freeze({ kind: "scalar", name: "word" });
const HANDLER: SemanticType = Object.freeze({ kind: "interrupt-handler" });

type IrqOverlapFacts = {
  readonly rootPairs: readonly (readonly [string, string])[];
  readonly linkPairs: readonly (readonly [string, string])[];
  readonly linkRootPairs: readonly (readonly [string, string])[];
};

const withOverlap: (
  inventory: StorageInventory,
  helpers: Parameters<typeof buildInterference>[1],
  overlap?: IrqOverlapFacts,
) => ReturnType<typeof buildInterference> = buildInterference;

const withSelectedRequests: (
  program: WholeProgram,
  helpers: Parameters<typeof simultaneousIRQStackPeak>[1],
  startupBytes: number,
  sites: ReadonlySet<SemanticOperation | SemanticTerminator>,
  requests?: readonly StorageRequest[],
) => ReturnType<typeof simultaneousIRQStackPeak> & { readonly irqOverlap?: IrqOverlapFacts } =
  simultaneousIRQStackPeak;

const closeSelected: (
  ...args: Parameters<typeof closeStorage>
) => ReturnType<typeof closeStorage> & { readonly irqOverlap?: IrqOverlapFacts } = closeStorage;

function span(start: number): SourceSpan {
  return Object.freeze({ sourceId: "src/handler-storage.blend", start, end: start + 1 });
}

function binding(start: number): BindingId {
  return Object.freeze({ sourceId: "src/handler-storage.blend", span: span(start) });
}

function lifetime(owner: BindingId, value: string): ValueLifetime {
  return Object.freeze({
    function: owner,
    value,
    definition: Object.freeze({ block: `entry-${owner.span.start}`, operation: 0 }),
    liveAt: Object.freeze([Object.freeze({ block: `entry-${owner.span.start}`, operation: 1 })]),
    callsCrossed: Object.freeze([]),
  });
}

function storageRequest(
  id: string,
  owner: BindingId,
  bytes = 2,
  activationRoot?: string,
): StorageRequest {
  return Object.freeze({
    id,
    storageClass: "temporary" as const,
    owner,
    activationRoot,
    binding: null,
    value: id,
    type: bytes === 1 ? BYTE : WORD,
    bytes,
    alignment: 1,
    region: "ram" as const,
    pageSafeIndirect: bytes === 2,
    lifetime: lifetime(owner, id),
    source: owner.span,
    reason: "A live private value or saved predecessor",
  });
}

function emptyProgram(owners: readonly BindingId[]): WholeProgram {
  const functions = owners.map((id) => {
    const block: SemanticBlock = Object.freeze({
      id: `entry-${id.span.start}`,
      operations: Object.freeze([]),
      terminator: Object.freeze({ kind: "return" as const, value: null }),
    });
    return Object.freeze({
      id,
      parameters: Object.freeze([]),
      result: VOID,
      entry: block.id,
      blocks: Object.freeze([block]),
      source: id.span,
    });
  });
  return Object.freeze({
    semantic: Object.freeze({
      main: owners[0]!,
      globals: Object.freeze([]),
      functions: Object.freeze(functions),
      assets: Object.freeze([]),
      initializerOrder: Object.freeze([]),
    }),
    roots: Object.freeze([
      Object.freeze({ kind: "startup" as const }),
      Object.freeze({ kind: "main" as const, function: owners[0]! }),
    ]),
    callGraph: Object.freeze(
      owners.map((owner) => Object.freeze({ function: owner, callees: Object.freeze([]) })),
    ),
    effects: Object.freeze([]),
    lifetimes: Object.freeze([]),
    reachableFunctions: Object.freeze(owners),
    reachableAssets: Object.freeze([]),
  });
}

function inventory(program: WholeProgram, requests: readonly StorageRequest[]): StorageInventory {
  return Object.freeze({ program, requests: Object.freeze(requests), results: Object.freeze([]) });
}

function profile(start: number, end: number, usableStack = 236): StorageProfile {
  return Object.freeze({
    profileId: "c64-pal-prg-kernal-6581",
    zeroPage: Object.freeze([]),
    ram: Object.freeze([Object.freeze({ start, end })]),
    hardwareStackCapacity: usableStack,
    hardwareStackReserve: 0,
    startupStackBytes: 0,
  });
}

function home(
  allocation: Extract<ReturnType<typeof allocateStorage>, { kind: "complete" }>,
  id: string,
): number {
  const placed = allocation.placement.homes.find(({ requestId }) => requestId === id);
  expect(placed).toBeDefined();
  if (placed === undefined) throw new Error(`Missing home for ${id}`);
  return placed.address;
}

function completeAllocation(
  storage: StorageInventory,
  overlap: IrqOverlapFacts,
  start: number,
  end: number,
) {
  return allocateStorage(storage, withOverlap(storage, [], overlap), profile(start, end));
}

describe("handler IRQ storage interference", () => {
  // Two saved predecessors that are live together require distinct complete words.
  it("separates simultaneously live predecessor links", () => {
    const firstOwner = binding(1);
    const secondOwner = binding(2);
    const storage = inventory(emptyProgram([firstOwner, secondOwner]), [
      storageRequest("link-a", firstOwner),
      storageRequest("link-b", secondOwner),
    ]);
    const overlap: IrqOverlapFacts = {
      rootPairs: [],
      linkPairs: [["link-a", "link-b"]],
      linkRootPairs: [],
    };
    const allocation = completeAllocation(storage, overlap, 0x20fc, 0x20ff);
    expect(allocation.kind).toBe("complete");
    if (allocation.kind !== "complete") throw new Error("Two link homes should fit");
    expect(
      Math.abs(home(allocation, "link-a") - home(allocation, "link-b")),
    ).toBeGreaterThanOrEqual(2);
  });

  // The last two bytes of a page form a valid indirect word; its final byte cannot be the low byte.
  it("accepts a two-byte link at $20FE and relocates one away from $20FF", () => {
    const owner = binding(2);
    const storage = inventory(emptyProgram([owner]), [storageRequest("link", owner)]);
    const overlap: IrqOverlapFacts = { rootPairs: [], linkPairs: [], linkRootPairs: [] };
    const atPageEnd = completeAllocation(storage, overlap, 0x20fe, 0x20ff);
    expect(atPageEnd.kind).toBe("complete");
    if (atPageEnd.kind !== "complete") throw new Error("The $20FE pair should fit");
    expect(home(atPageEnd, "link")).toBe(0x20fe);

    const relocated = completeAllocation(storage, overlap, 0x20ff, 0x2101);
    expect(relocated.kind).toBe("complete");
    if (relocated.kind !== "complete") throw new Error("A legal next-page pair should fit");
    expect(home(relocated, "link")).toBe(0x2100);
    expect(completeAllocation(storage, overlap, 0x20ff, 0x2100)).toMatchObject({
      kind: "error",
      reason: "resource",
    });
  });

  // Disjoint handler activations may reuse RAM while proved concurrent roots and links may not.
  it("overlays disjoint private roots and separates proved root and link conflicts", () => {
    const main = binding(3);
    const a = binding(4);
    const b = binding(5);
    const storage = inventory(emptyProgram([main, a, b]), [
      storageRequest("private-a", a, 2, "root-a"),
      storageRequest("private-b", b, 2, "root-b"),
      storageRequest("saved-link", main),
    ]);
    const disjoint: IrqOverlapFacts = { rootPairs: [], linkPairs: [], linkRootPairs: [] };
    const overlay = completeAllocation(storage, disjoint, 0x3000, 0x3001);
    expect(overlay.kind).toBe("complete");
    if (overlay.kind !== "complete") throw new Error("Disjoint roots should overlay");
    expect(home(overlay, "private-a")).toBe(home(overlay, "private-b"));

    const coLive: IrqOverlapFacts = {
      rootPairs: [["root-a", "root-b"]],
      linkPairs: [],
      linkRootPairs: [["saved-link", "root-a"]],
    };
    const separated = completeAllocation(storage, coLive, 0x3000, 0x3003);
    expect(separated.kind).toBe("complete");
    if (separated.kind !== "complete") throw new Error("Two homes should fit the proved conflicts");
    expect(
      Math.abs(home(separated, "private-a") - home(separated, "private-b")),
    ).toBeGreaterThanOrEqual(2);
    expect(
      Math.abs(home(separated, "saved-link") - home(separated, "private-a")),
    ).toBeGreaterThanOrEqual(2);
  });
});

function cpu(control: "asm_sei" | "asm_cli" | "asm_php" | "asm_plp" | "asm_nop", at: number) {
  return Object.freeze({ kind: "cpu-control" as const, control, span: span(at) });
}

function platform(
  capability: string,
  at: number,
  arguments_: readonly string[],
): PlatformOperation {
  return Object.freeze({
    kind: "platform",
    result: null,
    capability,
    arguments: Object.freeze(arguments_),
    type: VOID,
    effect: "volatile-write",
    span: span(at),
  });
}

function selectedFixture() {
  const selected = selectTargetProfile("c64-pal-prg-kernal-6581");
  expect(selected.kind).toBe("complete");
  if (selected.kind !== "complete") throw new Error("Selected C64 profile is required");
  const target = selected.profile;
  const chainSink = target.interrupts.sinks.find(
    ({ capability }) => capability === "c64.system.setIRQ",
  );
  const exclusiveSink = target.interrupts.sinks.find(
    ({ capability }) => capability === "c64.system.setIRQExclusive",
  );
  expect(chainSink).toBeDefined();
  expect(exclusiveSink).toBeDefined();
  if (chainSink === undefined || exclusiveSink === undefined) throw new Error("Missing IRQ sinks");
  const chainVariant = target.interrupts.variants.find(({ id }) => id === chainSink.variant);
  const exclusiveVariant = target.interrupts.variants.find(
    ({ id }) => id === exclusiveSink.variant,
  );
  expect(chainVariant).toBeDefined();
  expect(exclusiveVariant).toBeDefined();
  if (chainVariant === undefined || exclusiveVariant === undefined) {
    throw new Error("Missing selected IRQ variants");
  }

  const mainId = binding(100);
  const aId = binding(200);
  const bId = binding(300);
  const aAddress = Object.freeze({
    kind: "function-address" as const,
    result: "handler-a",
    function: aId,
    type: HANDLER,
    integer: null,
    span: span(110),
  });
  const bAddress = Object.freeze({
    kind: "function-address" as const,
    result: "handler-b",
    function: bId,
    type: HANDLER,
    integer: null,
    span: span(210),
  });
  const installA = platform("c64.system.setIRQ", 111, [aAddress.result]);
  const installB = platform("c64.system.setIRQExclusive", 211, [bAddress.result]);
  const restoreA = platform("c64.system.restoreIRQ", 112, []);
  const restoreB = platform("c64.system.restoreIRQ", 212, []);
  const mainOperations: readonly SemanticOperation[] = Object.freeze([
    ...Array.from({ length: 10 }, (_, index) => cpu("asm_php", 120 + index)),
    aAddress,
    installA,
    cpu("asm_cli", 130),
    cpu("asm_nop", 131),
    cpu("asm_sei", 132),
    restoreA,
    ...Array.from({ length: 10 }, (_, index) => cpu("asm_plp", 140 + index)),
  ]);
  const aOperations: readonly SemanticOperation[] = Object.freeze([
    ...Array.from({ length: 3 }, (_, index) => cpu("asm_php", 220 + index)),
    bAddress,
    installB,
    cpu("asm_cli", 230),
    cpu("asm_nop", 231),
    cpu("asm_sei", 232),
    restoreB,
    ...Array.from({ length: 3 }, (_, index) => cpu("asm_plp", 240 + index)),
  ]);
  const bOperations: readonly SemanticOperation[] = Object.freeze([
    ...Array.from({ length: 5 }, (_, index) => cpu("asm_php", 320 + index)),
    ...Array.from({ length: 5 }, (_, index) => cpu("asm_plp", 330 + index)),
  ]);
  const fn = (
    id: BindingId,
    name: string,
    operations: readonly SemanticOperation[],
    entryKind: "ordinary" | "interrupt",
  ): SemanticFunction => {
    const block: SemanticBlock = Object.freeze({
      id: `entry-${id.span.start}`,
      operations,
      terminator: Object.freeze({ kind: "return" as const, value: null }),
    });
    return Object.freeze({
      id,
      name,
      entryKind,
      parameters: Object.freeze([]),
      result: VOID,
      entry: block.id,
      blocks: Object.freeze([block]),
      source: id.span,
    });
  };
  const functions = Object.freeze([
    fn(mainId, "main", mainOperations, "ordinary"),
    fn(aId, "handlerA", aOperations, "interrupt"),
    fn(bId, "handlerB", bOperations, "interrupt"),
  ]);
  const program: WholeProgram = Object.freeze({
    semantic: Object.freeze({
      main: mainId,
      globals: Object.freeze([]),
      functions,
      assets: Object.freeze([]),
      initializerOrder: Object.freeze([]),
    }),
    roots: Object.freeze([
      Object.freeze({ kind: "startup" as const }),
      Object.freeze({ kind: "main" as const, function: mainId }),
    ]),
    callGraph: Object.freeze(
      [mainId, aId, bId].map((id) => Object.freeze({ function: id, callees: Object.freeze([]) })),
    ),
    effects: Object.freeze([]),
    lifetimes: Object.freeze([]),
    reachableFunctions: Object.freeze([mainId, aId, bId]),
    reachableAssets: Object.freeze([]),
    interruptRoutes: Object.freeze([
      Object.freeze({
        handler: aId,
        sink: chainSink,
        variant: chainVariant,
        installation: installA,
      }),
      Object.freeze({
        handler: bId,
        sink: exclusiveSink,
        variant: exclusiveVariant,
        installation: installB,
      }),
    ]),
  });
  const sites = new Set<SemanticOperation | SemanticTerminator>([
    ...mainOperations,
    ...aOperations,
    ...bOperations,
  ]);
  return { program, sites, target };
}

describe("selected handler IRQ stack", () => {
  // Chaining adds no new hardware frame; a nested exclusive entry adds its own declared frame.
  it("measures the exact 31-byte peak from retained source pushes and nested entries", () => {
    const { program, sites } = selectedFixture();
    const result = withSelectedRequests(program, [], 0, sites, []);
    expect(result.program).toBe(10);
    expect(result.program + result.system).toBe(31);
    expect(result.irqOverlap).toBeDefined();
  });

  // A one-byte reduction in usable capacity must report the measured finite demand.
  it("closes at 31 bytes and reports measured 31 against available 30", () => {
    const { program, sites } = selectedFixture();
    const binder: StorageBinder = Object.freeze({
      candidateRequestIds: Object.freeze([]),
      helperCalls: Object.freeze([]),
      instructionSites: sites,
      discover: () => Object.freeze([]),
    });
    const initial = inventory(program, []);
    const fits = closeSelected(initial, profile(0x3000, 0x30ff, 31), binder);
    expect(fits.kind).toBe("complete");
    if (fits.kind !== "complete") throw new Error("A 31-byte stack should fit");
    expect(fits.certificate.hardwareStackPeak).toBe(31);

    const short = closeSelected(initial, profile(0x3000, 0x30ff, 30), binder);
    expect(short).toMatchObject({ kind: "error", reason: "stack", measured: 31, available: 30 });
    expect(short).not.toHaveProperty("certificate");
    expect(fits.irqOverlap).toBeDefined();
  });
});

function symbolicProgram(
  link: StorageRequest,
  scratch: StorageRequest,
  target: ReturnType<typeof selectedFixture>["target"],
): MachineProgram {
  const startup = createC64Startup({ initializerLabels: [], mainLabel: "main", profile: target });
  expect(startup.kind).toBe("complete");
  if (startup.kind !== "complete") throw new Error("Machine startup must be selected");
  const state = Object.freeze({ registers: Object.freeze([]), flags: Object.freeze([]) });
  const cost = (bytes: number, cycles: number) =>
    Object.freeze({ bytes, minCycles: cycles, maxCycles: cycles });
  const instruction = (
    opcode: string,
    mode: "absolute" | "indirect" | "storage",
    operand:
      | { readonly kind: "label"; readonly label: string }
      | { readonly kind: "storage"; readonly requestId: string },
    at: number,
  ) => {
    const uses =
      opcode === "jsr"
        ? Object.freeze({ registers: Object.freeze(["s" as const]), flags: Object.freeze([]) })
        : state;
    const defines =
      opcode === "jsr"
        ? Object.freeze({ registers: Object.freeze(["s" as const]), flags: Object.freeze([]) })
        : opcode === "lda"
          ? Object.freeze({
              registers: Object.freeze(["a" as const]),
              flags: Object.freeze(["n" as const, "z" as const]),
            })
          : state;
    return Object.freeze({
      opcode,
      mode,
      operand,
      uses,
      defines,
      memory: Object.freeze([]),
      cost: cost(opcode === "lda" ? 2 : 3, opcode === "jsr" ? 6 : opcode === "lda" ? 3 : 5),
      source: span(at),
    });
  };
  const helper = (id: string) =>
    Object.freeze({
      id,
      blocks: Object.freeze([
        Object.freeze({
          label: `${id}.entry`,
          instructions: Object.freeze([
            instruction("lda", "storage", { kind: "storage", requestId: scratch.id }, 410),
          ]),
          terminator: Object.freeze({ kind: "return" as const, opcode: "rts", cost: cost(1, 6) }),
        }),
      ]),
    });
  return Object.freeze({
    functions: Object.freeze([
      Object.freeze({
        id: "main",
        blocks: Object.freeze([
          Object.freeze({
            label: "main.entry",
            instructions: Object.freeze([]),
            terminator: Object.freeze({ kind: "return" as const, opcode: "rts", cost: cost(1, 6) }),
          }),
        ]),
      }),
      Object.freeze({
        id: "handler-a",
        blocks: Object.freeze([
          Object.freeze({
            label: "handler-a.entry",
            instructions: Object.freeze([
              instruction("jsr", "absolute", { kind: "label", label: "helper-a.entry" }, 420),
              instruction("lda", "storage", { kind: "storage", requestId: scratch.id }, 421),
            ]),
            terminator: Object.freeze({
              kind: "long-branch" as const,
              opcode: "beq",
              fallthrough: "handler-a.exit",
              jump: Object.freeze({ opcode: "jmp", target: "handler-a.entry", cost: cost(3, 3) }),
              uses: Object.freeze({
                registers: Object.freeze([]),
                flags: Object.freeze(["z" as const]),
              }),
              cost: Object.freeze({ bytes: 5, minCycles: 3, maxCycles: 5 }),
            }),
          }),
          Object.freeze({
            label: "handler-a.exit",
            instructions: Object.freeze([
              instruction("jmp", "indirect", { kind: "storage", requestId: link.id }, 422),
            ]),
            terminator: Object.freeze({ kind: "unreachable" as const }),
          }),
        ]),
      }),
      helper("helper-a"),
      helper("helper-b"),
    ]),
    data: Object.freeze([]),
    startup: startup.startup,
    requiredStorage: Object.freeze([link, scratch]),
    storageProfile: target.storage,
  });
}

describe("final handler IRQ storage binding", () => {
  // Rebinding the same selected shape must use each final certificate's homes.
  it("rebinds symbolic links and scratch into both certified RAM windows", () => {
    const { program, sites, target } = selectedFixture();
    const owner = binding(200);
    const link = storageRequest("saved-link", owner);
    const scratch = storageRequest("helper-scratch", owner, 1, "root-a");
    const initial = inventory(program, [link, scratch]);
    const binder: StorageBinder = Object.freeze({
      candidateRequestIds: Object.freeze([link.id, scratch.id]),
      helperCalls: Object.freeze([]),
      instructionSites: sites,
      discover: () => Object.freeze([]),
    });
    const symbolic = symbolicProgram(link, scratch, target);
    const certificates = [
      closeSelected(initial, profile(0x3000, 0x30ff), binder),
      closeSelected(initial, profile(0x3100, 0x31ff), binder),
    ];
    let firstHomes: ReadonlyMap<string, number> | null = null;
    for (const closure of certificates) {
      expect(closure.kind).toBe("complete");
      if (closure.kind !== "complete") throw new Error("Both final homes must close");
      const bound = bindMachineProgram(symbolic, closure.certificate);
      expect(bound.kind, JSON.stringify(bound)).toBe("complete");
      if (bound.kind !== "complete") throw new Error("Symbolic program must bind");
      const addresses = new Map(
        closure.certificate.homes.map(({ requestId, address }) => [requestId, address]),
      );
      if (firstHomes !== null) {
        expect(addresses.get(link.id)).not.toBe(firstHomes.get(link.id));
        expect(addresses.get(scratch.id)).not.toBe(firstHomes.get(scratch.id));
      }
      firstHomes = addresses;
      const selected = symbolic.functions[1]!.blocks[0]!;
      const final = bound.program.functions[1]!.blocks[0]!;
      expect(final.terminator).toEqual(selected.terminator);
      expect(
        final.instructions.map(({ opcode, uses, defines, memory, source }) => ({
          opcode,
          uses,
          defines,
          memory,
          source,
        })),
      ).toEqual(
        selected.instructions.map(({ opcode, uses, defines, memory, source }) => ({
          opcode,
          uses,
          defines,
          memory,
          source,
        })),
      );
      expect(final.instructions[0]?.operand).toEqual(selected.instructions[0]?.operand);
      expect(bound.program.functions[1]!.blocks[1]!.instructions[0]!.operand).toEqual({
        kind: "absolute",
        value: addresses.get(link.id),
      });
      const helpers = bound.program.functions.filter(({ id }) => id.startsWith("helper-"));
      expect(helpers.length).toBeGreaterThan(0);
      for (const helper of helpers) {
        expect(helper.blocks[0]!.instructions[0]!.operand).toEqual({
          kind: "absolute",
          value: addresses.get(scratch.id),
        });
      }
    }
  });

  // Shared RAM closure must bind the unchanged symbolic sites against the renewed certificate.
  it("preserves selected call, chain and branch effects through shared RAM reclosure", () => {
    const { program, sites, target } = selectedFixture();
    const owner = binding(200);
    const link = storageRequest("saved-link", owner);
    const scratch = storageRequest("helper-scratch", owner, 1, "root-a");
    const binder: StorageBinder = Object.freeze({
      candidateRequestIds: Object.freeze([link.id, scratch.id]),
      helperCalls: Object.freeze([]),
      instructionSites: sites,
      discover: () => Object.freeze([]),
    });
    const provisional = closeSelected(inventory(program, [link, scratch]), target.storage, binder);
    expect(provisional.kind).toBe("complete");
    if (provisional.kind !== "complete") throw new Error("Provisional storage must close");
    const symbolic = symbolicProgram(link, scratch, target);
    const shared = closeSharedStorage(symbolic, binder, provisional, target);
    expect(shared.kind, JSON.stringify(shared)).toBe("complete");
    if (shared.kind !== "complete") throw new Error("Shared RAM should close");
    expect(shared.machine.kind).toBe("complete");
    if (shared.machine.kind !== "complete") throw new Error("Final machine binding is required");
    const finalHomes = shared.certificate.certificate.homes;
    const address = (id: string) => {
      const placed = finalHomes.find(({ requestId }) => requestId === id);
      expect(placed).toBeDefined();
      if (placed === undefined) throw new Error(`Missing final home for ${id}`);
      return placed.address;
    };
    expect(shared.machine.program.functions[1]!.blocks[1]!.instructions[0]!.operand).toEqual({
      kind: "absolute",
      value: address(link.id),
    });
    const helpers = shared.machine.program.functions.filter(({ id }) => id.startsWith("helper-"));
    expect(helpers.length).toBeGreaterThan(0);
    for (const helper of helpers) {
      expect(helper.blocks[0]!.instructions[0]!.operand).toEqual({
        kind: "absolute",
        value: address(scratch.id),
      });
    }
    const before = symbolic.functions[1]!.blocks[0]!;
    const after = shared.machine.program.functions[1]!.blocks[0]!;
    expect(after.instructions.map(({ opcode, source }) => ({ opcode, source }))).toEqual(
      before.instructions.map(({ opcode, source }) => ({ opcode, source })),
    );
    expect(after.terminator).toEqual(before.terminator);
    expect(provisional.irqOverlap).toBeDefined();
    expect(shared.certificate).toMatchObject({ irqOverlap: provisional.irqOverlap });
  });
});

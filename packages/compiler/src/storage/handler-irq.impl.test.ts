import { describe, expect, it } from "vitest";
import type { BindingId, SemanticType } from "../frontend/semantic-types.js";
import type { WholeProgram } from "../semantic/whole-program.js";
import { allocateStorage } from "./allocate.js";
import { closeStorage, storageInventoryHash } from "./closure.js";
import { buildInterference } from "./interference.js";
import type {
  IrqOverlapFacts,
  StorageClass,
  StorageInventory,
  StorageProfile,
  StorageRequest,
} from "./storage-types.js";

const BYTE: SemanticType = Object.freeze({ kind: "scalar", name: "byte" });
const PRIVATE_CLASSES: readonly StorageClass[] = [
  "parameter",
  "return-stage",
  "local",
  "argument-stage",
  "temporary",
  "pointer",
  "spill",
  "helper-scratch",
];
const NO_OVERLAP: IrqOverlapFacts = { rootPairs: [], linkPairs: [], linkRootPairs: [] };
const PROFILE: StorageProfile = {
  profileId: "handler-storage-probe",
  zeroPage: [],
  ram: [{ start: 0x3000, end: 0x3003 }],
  hardwareStackCapacity: 64,
};

/** Give each synthetic execution a distinct, stable source identity. */
function owner(start: number): BindingId {
  return {
    sourceId: "src/handler-storage.blend",
    span: { sourceId: "src/handler-storage.blend", start, end: start + 1 },
  };
}

/** The storage graph needs only empty bodies and a reachable main root. */
function program(owners: readonly BindingId[]): WholeProgram {
  return {
    semantic: {
      main: owners[0]!,
      globals: [],
      functions: owners.map((id) => ({
        id,
        parameters: [],
        result: { kind: "scalar", name: "void" },
        entry: `entry-${id.span.start}`,
        blocks: [
          {
            id: `entry-${id.span.start}`,
            operations: [],
            terminator: { kind: "return", value: null },
          },
        ],
        source: id.span,
      })),
      assets: [],
      initializerOrder: [],
    },
    roots: [{ kind: "main", function: owners[0]! }],
    callGraph: owners.map((id) => ({ function: id, callees: [] })),
    effects: [],
    lifetimes: [],
    reachableFunctions: owners,
    reachableAssets: [],
  };
}

/** Build one private home or handler-local saved link with an otherwise quiet lifetime. */
function request(
  id: string,
  binding: BindingId,
  storageClass: StorageClass,
  activationRoot: string,
  bytes = 1,
): StorageRequest {
  return {
    id,
    storageClass,
    owner: binding,
    domain: "irq",
    activationRoot,
    binding: null,
    value: id,
    type: BYTE,
    bytes,
    alignment: 1,
    region: "ram",
    lifetime: {
      function: binding,
      value: id,
      definition: { block: "entry", operation: 0 },
      liveAt: [{ block: "entry", operation: 1 }],
      callsCrossed: [],
    },
    source: binding.span,
    reason: "Synthetic IRQ private storage",
  };
}

function inventory(
  owners: readonly BindingId[],
  requests: readonly StorageRequest[],
): StorageInventory {
  return { program: program(owners), requests, results: [] };
}

describe("handler IRQ storage internals", () => {
  it.each(PRIVATE_CLASSES)("separates overlapping %s homes and saved links", (storageClass) => {
    const owners = [owner(1), owner(2), owner(3)];
    const storage = inventory(owners, [
      request("private-a", owners[0]!, storageClass, "root-a"),
      request("private-b", owners[1]!, storageClass, "root-b"),
      request("interrupt-link:irq:root-b:0", owners[2]!, "pointer", "root-b", 2),
    ]);
    const overlap: IrqOverlapFacts = {
      rootPairs: [["root-a", "root-b"]],
      linkPairs: [],
      linkRootPairs: [["interrupt-link:irq:root-b:0", "root-a"]],
    };
    const edges = buildInterference(storage, [], overlap);
    expect(edges).toEqual(
      expect.arrayContaining([
        { left: "private-a", right: "private-b", reason: "call-overlap" },
        {
          left: "interrupt-link:irq:root-b:0",
          right: "private-a",
          reason: "call-overlap",
        },
      ]),
    );
    expect(buildInterference(storage, [], NO_OVERLAP)).toEqual([]);
  });

  it("keeps handler-local predecessor slots live only for proved overlapping installs", () => {
    const owners = [owner(4), owner(5)];
    const first = "interrupt-link:irq:root-a:0";
    const second = "interrupt-link:irq:root-b:0";
    const storage = inventory(owners, [
      request(first, owners[0]!, "pointer", "root-a", 2),
      request(second, owners[1]!, "pointer", "root-b", 2),
    ]);
    const narrowProfile: StorageProfile = { ...PROFILE, ram: [{ start: 0x3000, end: 0x3001 }] };
    const disjoint = allocateStorage(
      storage,
      buildInterference(storage, [], NO_OVERLAP),
      narrowProfile,
    );
    expect(disjoint.kind).toBe("complete");
    if (disjoint.kind !== "complete") throw new Error("Disjoint links should share two bytes");
    expect(disjoint.placement.homes[0]?.address).toBe(disjoint.placement.homes[1]?.address);

    const overlap: IrqOverlapFacts = {
      rootPairs: [],
      linkPairs: [[first, second]],
      linkRootPairs: [],
    };
    expect(
      allocateStorage(storage, buildInterference(storage, [], overlap), narrowProfile),
    ).toMatchObject({
      kind: "error",
      reason: "resource",
    });
  });

  it("closes the same ordered certificate and tracks activation roots in both hashes", () => {
    const binding = owner(6);
    const first = request("first", binding, "local", "root-a");
    const second = request("second", binding, "temporary", "root-a");
    const storage = inventory([binding], [second, first]);
    const repeat = inventory([binding], [first, second]);
    const closed = closeStorage(storage, PROFILE, () => []);
    const repeated = closeStorage(repeat, PROFILE, () => []);
    expect(closed.kind).toBe("complete");
    expect(repeated.kind).toBe("complete");
    if (closed.kind !== "complete" || repeated.kind !== "complete") {
      throw new Error("Two private bytes should close");
    }
    expect(closed.certificate).toEqual(repeated.certificate);
    expect(closed.certificate.interference).toHaveLength(1);

    const otherRoot = inventory([binding], [first, { ...second, activationRoot: "root-b" }]);
    const changed = closeStorage(otherRoot, PROFILE, () => []);
    expect(changed.kind).toBe("complete");
    if (changed.kind !== "complete") throw new Error("Disjoint roots should close");
    expect(changed.certificate.inventoryHash).not.toBe(closed.certificate.inventoryHash);
    expect(changed.certificate.graphHash).not.toBe(closed.certificate.graphHash);
    expect(storageInventoryHash(otherRoot)).not.toBe(storageInventoryHash(repeat));
  });
});

import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildProject, checkProject } from "@blend65/compiler";
import type { BuildResult, OptimizationGoal, SourceSpan } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  profileRecord,
  profileRecords,
  profileSpan,
  readProfileArtifacts,
  withProfileProject,
} from "../rd05/profile-fixture.js";

/**
 * Where the observed callable actually lives. Frame homes are chosen during
 * layout, are invisible in source, and may move between optimization modes, so
 * every case reads the home from the build under judgment instead of naming an
 * address.
 */
interface CallableRoot {
  /** Complete declaration text used to identify the binding in public evidence. */
  declaration: string;
  /** Storage class published for the binding: a frame slot or module storage. */
  storage: "local" | "parameter" | "global";
  /** Complete root size, including fields or elements surrounding the callable. */
  size: number;
  /** Callable offset within the enclosing root, not within an intermediate field. */
  leafOffset: number;
  /** Source spelling of the callable target expression. */
  target: string;
  /** Exact function type used by the canonical diagnostic. */
  signature: string;
}

/** Source and the exact call that would consume a stale target proof. */
interface CallableFixture {
  /** Legal source containing one replaceable four-digit raw-write address. */
  source: string;
  /** Storage containing the observed callable. */
  root: CallableRoot;
  /** Smallest complete call expression requiring the finite target proof. */
  call: string;
}

/** Detached evidence from the exact immutable generation returned by a real build. */
type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

/** Half-open byte interval owned by one published storage root. */
interface Range {
  readonly start: number;
  readonly end: number;
}

/** What the re-aimed write must do to the published representation. */
type Outcome = "refused" | "published-covered" | "published-disjoint";

/** One complete reference-then-candidate experiment against a chosen home. */
interface Attempt {
  /** Fixture whose single placeholder write is re-aimed at the chosen home. */
  test: CallableFixture;
  /** Signed byte offset from the callable leaf to the first written byte. */
  offset: number;
  /** Required publication result, and where the write must land when published. */
  outcome: Outcome;
  /** Optimization mode; frame homes differ between modes. */
  optimization?: OptimizationGoal;
  /** A second binding that must occupy this root's exact bytes for the case to mean anything. */
  coincident?: CallableRoot;
  /** Build the reference twice and require byte-identical evidence. */
  repeatControl?: boolean;
}

const target = "c64-pal-prg-kernal-6581";

/** Optional optimization must not turn an invalid representation into a published result. */
const modes: readonly OptimizationGoal[] = ["none", "balanced", "speed", "size"];

/**
 * Overlaid homes publish one interval whose identity joins every binding that
 * shares the bytes, so a shared home is found by matching any single member.
 */
const overlayPrefix = "sfa.overlay:";

/** Shared declarations; every fixture keeps its own body and helpers explicit. */
const preamble = `module Game;
struct Slot { lead: byte; callback: fn(): byte; tail: byte; }
struct Holder { callback: fn(): byte; }
function chosen(): byte { return 37; }
function other(): byte { return 11; }
function chosenOne(value: byte): byte { return 37; }
`;

/** Assemble one legal program from a main body and any supporting functions. */
function program(body: string, helpers = ""): string {
  return `${preamble}${helpers}function main(): void {
${body}
}
`;
}

/** Build one fixture whose main body and helpers carry the observed callable. */
function fixture(
  root: CallableRoot,
  body: string,
  helpers = "",
  call = `${root.target}()`,
): CallableFixture {
  return { root, call, source: program(body, helpers) };
}

/** The scalar frame control: one two-byte callable owned by main's frame. */
const scalarLocal: CallableRoot = {
  declaration: "let hook: fn(): byte = &chosen;",
  storage: "local",
  size: 2,
  leafOffset: 0,
  target: "hook",
  signature: "fn(): byte",
};

/** Require a real assembled control; setup failures are not evidence of safe rejection. */
function successful(result: BuildResult) {
  expect(result.kind, `Control/setup failure: ${JSON.stringify(result.diagnostics)}`).toBe(
    "success",
  );
  if (result.kind !== "success") throw new Error("Control did not reach publication");
  return result;
}

/** Half-open byte ranges meet at a legal endpoint without overlapping. */
function overlaps(range: Range, otherStart: number, otherEnd: number) {
  return range.start < otherEnd && otherStart < range.end;
}

/** Causal notes may select a subexpression, but must identify the actual source site. */
function touches(actual: SourceSpan, expected: SourceSpan) {
  return (
    actual.sourceId === expected.sourceId &&
    actual.start < expected.end &&
    expected.start < actual.end
  );
}

/** Published byte ranges name the inclusive first and last address of the storage. */
function byteRange(start: number, size: number) {
  const address = (value: number) => `$${value.toString(16).padStart(4, "0")}`;
  return `${address(start)}–${address(start + size - 1)}`;
}

/** Every binding sharing one overlaid home appears as a separate identity member. */
function sharingMembers(identity: string): readonly string[] {
  const body = identity.startsWith(overlayPrefix) ? identity.slice(overlayPrefix.length) : identity;
  return body.split("+");
}

/**
 * Resolve the root's own published storage. An absent interval is not evidence
 * that a callable was eliminated, and must never make unsafe acceptance pass.
 */
function storageRange(artifacts: Artifacts, source: string, root: CallableRoot): Range {
  const declaration = profileSpan(source, root.declaration);
  const location = `${declaration.sourceId}:${declaration.start}:${declaration.end}`;
  const intervals = profileRecords(artifacts.memory.intervals).filter((interval) => {
    if (interval.addressSpaceId !== "cpu16") return false;
    if (root.storage === "global") {
      const owner = profileRecord(interval.owner);
      return owner.kind === "symbol" && owner.id === `global::${location}`;
    }
    if (interval.kind !== "sfa") return false;
    const suffix = `:${root.storage}:${location}`;
    return sharingMembers(String(interval.id)).some((member) => member.endsWith(suffix));
  });
  expect(
    intervals,
    "Public-evidence limitation: require the binding's own materialized interval; missing storage does not prove elimination",
  ).toHaveLength(1);
  const interval = intervals[0]!;
  const { start, end } = interval;
  if (typeof start !== "number" || typeof end !== "number")
    throw new TypeError("A materialized root needs numeric half-open endpoints");
  expect(Number.isInteger(start) && Number.isInteger(end)).toBe(true);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeLessThanOrEqual(0x10000);
  expect(end - start).toBe(root.size);
  expect(interval.size).toBe(root.size);
  return { start, end };
}

/** A lost proof is a source error at the call, naming the storage, the write and the bytes. */
function expectLostProof(
  result: BuildResult,
  source: string,
  test: CallableFixture,
  write: string,
  callable: number,
) {
  expect(result.kind, "Unsafe acceptance must not replace a finite-target error").toBe("failure");
  if (result.kind !== "failure") throw new Error("Expected a finite-target failure");
  expect(result.category).toBe("source");
  const errors = result.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
  expect(errors.map((diagnostic) => diagnostic.code)).toEqual(["E10277"]);
  const diagnostic = errors[0]!;
  expect(diagnostic.message).toBe(
    `Cannot prove a finite source-function target set for call through '${test.root.target}' of type '${test.root.signature}' — keep the value within closed-program typed storage`,
  );
  expect(diagnostic.primarySpan).toEqual(profileSpan(source, test.call));
  const storage = profileSpan(source, test.root.declaration);
  const corruption = profileSpan(source, write);
  expect(diagnostic.related.some((note) => touches(note.span, storage))).toBe(true);
  expect(
    diagnostic.related.some(
      (note) => touches(note.span, corruption) && note.message.includes(byteRange(callable, 2)),
    ),
    `A causal note must name the covering write and the callable bytes ${byteRange(callable, 2)}`,
  ).toBe(true);
  for (const note of diagnostic.related) expect(note.message.trim().length).toBeGreaterThan(0);
}

/**
 * Build once to learn where layout actually placed the callable, re-aim the
 * fixture's single raw write at those bytes, then judge the second build. Only
 * one same-width address literal changes, so every source proof keeps its
 * offsets and the two builds remain comparable.
 */
async function exercise(attempt: Attempt) {
  const { test, offset, outcome } = attempt;
  const optimization = attempt.optimization ?? "none";
  await withProfileProject(test.source, target, async (project, root) => {
    const checked = await checkProject({ project });
    expect(checked.kind, `Illegal control source: ${JSON.stringify(checked.diagnostics)}`).toBe(
      "success",
    );
    let prior = successful(await buildProject({ project, optimization }));
    const reference = await readProfileArtifacts(prior);
    const referenceRange = storageRange(reference, test.source, test.root);
    const writes = test.source.match(/\bpokew?\(\$C100, 0\)/gu);
    expect(writes, "Fixture must have exactly one replaceable raw write").toHaveLength(1);
    const originalWrite = writes![0]!;
    const width = originalWrite.startsWith("pokew") ? 2 : 1;
    expect(overlaps(referenceRange, 0xc100, 0xc100 + width)).toBe(false);
    expect(overlaps(referenceRange, 0xc000, 0xc005)).toBe(false);
    expect(overlaps(referenceRange, 0xc200, 0xc203)).toBe(false);
    if (attempt.coincident !== undefined)
      expect(
        storageRange(reference, test.source, attempt.coincident),
        "The two bindings no longer occupy the same bytes, so this case stopped exercising a shared home",
      ).toEqual(referenceRange);

    if (attempt.repeatControl === true) {
      prior = successful(await buildProject({ project, optimization }));
      const repeated = await readProfileArtifacts(prior);
      // The primary bytes are a PRG or a disk image, depending on the profile.
      expect(repeated.prg).toEqual(reference.prg);
      expect(repeated.costs.totals).toEqual(reference.costs.totals);
      expect(repeated.memory.intervals).toEqual(reference.memory.intervals);
      expect(repeated.memory.stackDomains).toEqual(reference.memory.stackDomains);
    }

    const address = referenceRange.start + test.root.leafOffset + offset;
    expect(address).toBeGreaterThanOrEqual(0);
    expect(address + width).toBeLessThanOrEqual(0x10000);
    const literal = `$${address.toString(16).toUpperCase().padStart(4, "0")}`;
    expect(literal).toHaveLength(5);
    expect(test.source.split("$C100")).toHaveLength(2);
    const candidateSource = test.source.replace("$C100", literal);
    expect(Buffer.byteLength(candidateSource)).toBe(Buffer.byteLength(test.source));
    const candidateWrite = originalWrite.replace("$C100", literal);
    const output = join(root, "out");
    const current = await readFile(join(output, "current.json"));
    const inventory = (await readdir(output)).sort();
    const surviving = await readProfileArtifacts(prior);
    await writeFile(join(root, "src/game.blend"), candidateSource);

    const candidate = await buildProject({ project, optimization });
    const verdict = candidate.kind === "success" ? "published" : "refused";
    if (candidate.kind === "success") {
      const artifacts = await readProfileArtifacts(candidate);
      const final = storageRange(artifacts, candidateSource, test.root);
      if (attempt.coincident !== undefined)
        expect(
          storageRange(artifacts, candidateSource, attempt.coincident),
          "The two bindings no longer occupy the same bytes, so this case stopped exercising a shared home",
        ).toEqual(final);
      const leaf = final.start + test.root.leafOffset;
      const covered = overlaps({ start: leaf, end: leaf + 2 }, address, address + width);
      if (outcome === "published-disjoint") {
        expect(
          covered,
          "This published representation places the callable under the write, so the case no longer proves that a disjoint write is kept",
        ).toBe(false);
        return;
      }
      expect(
        covered,
        "The re-aimed write no longer reaches this build's own callable bytes, so the case stopped covering the behaviour it pins",
      ).toBe(true);
      if (outcome === "published-covered") return;
      expect(
        verdict,
        "Unsafe acceptance: a raw write covering the frame-stored callable bytes must cost the call its finite target proof",
      ).toBe("refused");
      return;
    }

    expect(
      outcome,
      `Unexpected refusal of a sound program: ${JSON.stringify(candidate.diagnostics)}`,
    ).toBe("refused");
    expectLostProof(
      candidate,
      candidateSource,
      test,
      candidateWrite,
      referenceRange.start + test.root.leafOffset,
    );
    expect(await readFile(join(output, "current.json"))).toEqual(current);
    expect((await readdir(output)).sort()).toEqual(inventory);
    expect(await readProfileArtifacts(prior)).toEqual(surviving);
  });
}

/** Declare the scalar local, corrupt memory, then call through it. */
function scalarBody(write: string) {
  return `${scalarLocal.declaration}\n${write}\npoke($C000, hook());`;
}

describe.each(modes)("frame-stored scalar callable under optimization %s", (mode) => {
  it("should lose the target proof when a raw word replaces the local's own bytes", async () => {
    await exercise({
      test: fixture(scalarLocal, scalarBody("pokew($C100, 0);")),
      offset: 0,
      outcome: "refused",
      optimization: mode,
      repeatControl: true,
    });
  }, 60_000);
});

describe("frame-stored scalar callable bytes", () => {
  it.each([
    ["low byte", "poke($C100, 0);", 0, "refused"],
    ["high byte", "poke($C100, 0);", 1, "refused"],
    ["word beginning one byte earlier", "pokew($C100, 0);", -1, "refused"],
    ["word ending exactly at the callable", "pokew($C100, 0);", -2, "published-disjoint"],
  ] as const)(
    "should judge the call when a write covers the %s",
    async (_name, write, offset, outcome) => {
      await exercise({ test: fixture(scalarLocal, scalarBody(write)), offset, outcome });
    },
    60_000,
  );
});

/** A function-typed parameter owns a frame home exactly like a local does. */
const parameterRoot: CallableRoot = {
  declaration: "hook: fn(): byte",
  storage: "parameter",
  size: 2,
  leafOffset: 0,
  target: "hook",
  signature: "fn(): byte",
};

describe("function-typed parameter home", () => {
  it("should lose the target proof when the callee overwrites its own parameter bytes", async () => {
    await exercise({
      test: fixture(
        parameterRoot,
        "poke($C000, viaHook(&chosen));",
        "function viaHook(hook: fn(): byte): byte {\npokew($C100, 0);\nreturn hook();\n}\n",
      ),
      offset: 0,
      outcome: "refused",
    });
  }, 60_000);

  it("should keep the proof when the caller writes the home before marshalling the argument", async () => {
    await exercise({
      test: fixture(
        parameterRoot,
        "pokew($C100, 0);\npoke($C000, viaHook(&chosen));",
        "function viaHook(hook: fn(): byte): byte { return hook(); }\n",
      ),
      offset: 0,
      outcome: "published-covered",
    });
  }, 60_000);
});

/** Nested packing and array indexing both retain the complete root-relative offset. */
const aggregateRoots: readonly CallableRoot[] = [
  {
    declaration: "let nest: Slot = { lead: 0, callback: &chosen, tail: 0 };",
    storage: "local",
    size: 4,
    leafOffset: 1,
    target: "nest.callback",
    signature: "fn(): byte",
  },
  {
    declaration: "let hooks: (fn(): byte)[3] = [&chosen, &chosen, &chosen];",
    storage: "local",
    size: 6,
    leafOffset: 2,
    target: "hooks[1]",
    signature: "fn(): byte",
  },
];

describe.each(aggregateRoots)("packed frame callable leaf $target", (root) => {
  it.each([
    ["a preceding word overlaps the low byte", "pokew($C100, 0);", -1, "refused"],
    ["a byte overlaps the high byte", "poke($C100, 0);", 1, "refused"],
    ["a preceding sibling byte stays clear", "poke($C100, 0);", -1, "published-disjoint"],
    ["a word ends exactly at the callable", "pokew($C100, 0);", -2, "published-disjoint"],
    ["a following sibling begins at the endpoint", "pokew($C100, 0);", 2, "published-disjoint"],
  ] as const)(
    "should respect the enclosing root offset when %s",
    async (_name, write, offset, outcome) => {
      const body = `${root.declaration}\n${write}\npoke($C000, ${root.target}());`;
      await exercise({ test: fixture(root, body), offset, outcome });
    },
    60_000,
  );
});

describe("borrowed aggregate parameter home", () => {
  /**
   * A struct argument is passed by reference, so the callee's parameter home
   * holds the caller object's address rather than the object's own bytes. This
   * case therefore pins the published behaviour of overwriting that borrowed
   * address; it deliberately computes no field offset into those two bytes.
   */
  it("should keep publishing the call when the borrowed address bytes are overwritten", async () => {
    const borrowed: CallableRoot = {
      declaration: "slot: Slot",
      storage: "parameter",
      size: 2,
      leafOffset: 0,
      target: "slot.callback",
      signature: "fn(): byte",
    };
    await exercise({
      test: fixture(
        borrowed,
        "let nest: Slot = { lead: 0, callback: &chosen, tail: 0 };\npoke($C000, viaSlot(nest));",
        "function viaSlot(slot: Slot): byte {\npokew($C100, 0);\nreturn slot.callback();\n}\n",
      ),
      offset: 0,
      outcome: "published-covered",
    });
  }, 60_000);
});

describe("reaching writes and definite typed restoration", () => {
  it.each([
    [
      "the raw write precedes the assignment",
      "let hook: fn(): byte;",
      "pokew($C100, 0);\nhook = &chosen;\npoke($C000, hook());",
    ],
    [
      "the raw write follows the last call",
      scalarLocal.declaration,
      "poke($C000, hook());\npokew($C100, 0);",
    ],
    [
      "a complete typed assignment restores the target",
      scalarLocal.declaration,
      "pokew($C100, 0);\nhook = &chosen;\npoke($C000, hook());",
    ],
  ] as const)(
    "should retain a valid proof when %s",
    async (_name, declaration, rest) => {
      await exercise({
        test: fixture({ ...scalarLocal, declaration }, `${declaration}\n${rest}`),
        offset: 0,
        outcome: "published-covered",
      });
    },
    60_000,
  );

  it("should reject a reaching corruption when only one possible branch writes", async () => {
    await exercise({
      test: fixture(scalarLocal, scalarBody("if (peek($C200) != 0) { pokew($C100, 0); }")),
      offset: 0,
      outcome: "refused",
    });
  }, 60_000);

  it.each([
    ["a direct helper", "taint();", ""],
    ["a transitive helper", "relay();", "function relay(): void { taint(); }\n"],
  ] as const)(
    "should reject a reaching corruption when %s writes while the local is live",
    async (_name, invoke, relay) => {
      await exercise({
        test: fixture(
          scalarLocal,
          scalarBody(invoke),
          `function taint(): void { pokew($C100, 0); }\n${relay}`,
        ),
        offset: 0,
        outcome: "refused",
      });
    },
    60_000,
  );

  /** A scheduled module initializer runs ordinary statements over its own frame. */
  it("should treat a write inside an initializer body as an ordinary reaching write", async () => {
    await exercise({
      test: {
        root: scalarLocal,
        call: "hook()",
        source: `${preamble}let primed: byte = prime();
function prime(): byte {
${scalarLocal.declaration}
pokew($C100, 0);
return hook();
}
function main(): void {
poke($C000, primed);
}
`,
      },
      offset: 0,
      outcome: "refused",
    });
  }, 60_000);
});

describe("loop back edges", () => {
  /** Wrap one loop body around a call through the scalar local. */
  const loop = (body: string) => `${scalarLocal.declaration}
let index: byte = 0;
while (index < 3) {
poke($C000, hook());
${body}index = index + 1;
}`;

  it("should reject a call that a back edge reaches again after a raw write", async () => {
    await exercise({
      test: fixture(scalarLocal, loop("pokew($C100, 0);\n")),
      offset: 0,
      outcome: "refused",
    });
  }, 60_000);

  it("should keep the proof when a complete store precedes the back edge", async () => {
    await exercise({
      test: fixture(scalarLocal, loop("pokew($C100, 0);\nhook = &chosen;\n")),
      offset: 0,
      outcome: "published-covered",
    });
  }, 60_000);
});

/** A one-argument callable exposes capture-before-argument proof ordering. */
const argumentRoot: CallableRoot = {
  declaration: "let hook: fn(byte): byte = &chosenOne;",
  storage: "local",
  size: 2,
  leafOffset: 0,
  target: "hook",
  signature: "fn(byte): byte",
};

describe("call target capture and argument order", () => {
  const taint = "function taint(): byte { pokew($C100, 0); return 1; }\n";

  it("should accept the captured target when its own argument corrupts the home afterwards", async () => {
    await exercise({
      test: fixture(
        argumentRoot,
        `${argumentRoot.declaration}\npoke($C000, hook(taint()));`,
        taint,
        "hook(taint())",
      ),
      offset: 0,
      outcome: "published-covered",
    });
  }, 60_000);

  it("should reject the later call when an argument already corrupted the home", async () => {
    await exercise({
      test: fixture(
        argumentRoot,
        `${argumentRoot.declaration}\npoke($C000, hook(taint()));\npoke($C001, hook(2));`,
        taint,
        "hook(2)",
      ),
      offset: 0,
      outcome: "refused",
    });
  }, 60_000);
});

describe("homes that carry more than one value", () => {
  /**
   * One frame home carries two different callables in sequence. The raw write
   * lands after the first value's last call and before the second value's
   * complete typed store, so no call ever reads replaced bytes.
   */
  it("should keep the proof when the write falls between one value's last call and the next store", async () => {
    await exercise({
      test: fixture(
        scalarLocal,
        `${scalarLocal.declaration}
poke($C000, hook());
pokew($C100, 0);
hook = &other;
poke($C001, hook());`,
      ),
      offset: 0,
      outcome: "published-covered",
    });
  }, 60_000);

  /**
   * Two functions that can never be active at the same time may share one
   * frame home. A write performed by the other function cannot reach the
   * callable's live range, so the proof survives in every mode.
   */
  it.each(modes)(
    "should keep the proof when a non-overlapping function writes the shared home in mode %s",
    async (mode) => {
      const spare = "let spare: fn(): byte = &chosen;";
      await exercise({
        test: {
          root: scalarLocal,
          call: "hook()",
          source: `${preamble}function alpha(): byte {
${scalarLocal.declaration}
return hook();
}
function beta(): byte {
${spare}
let kept: byte = spare();
pokew($C100, 0);
return kept;
}
function main(): void {
poke($C000, alpha());
poke($C001, beta());
}
`,
        },
        offset: 0,
        outcome: "published-covered",
        optimization: mode,
        coincident: { ...scalarLocal, declaration: spare },
      });
    },
    60_000,
  );
});

describe("restoration performed by a callee", () => {
  it("should keep the proof when a called function returns the complete value", async () => {
    await exercise({
      test: fixture(
        { ...scalarLocal, declaration: "let hook: fn(): byte;" },
        "let hook: fn(): byte;\npokew($C100, 0);\nhook = supply();\npoke($C000, hook());",
        "function supply(): fn(): byte { return &chosen; }\n",
      ),
      offset: 0,
      outcome: "published-covered",
    });
  }, 60_000);

  it("should keep the proof when a called function fills the destination by reference", async () => {
    await exercise({
      test: fixture(
        {
          declaration: "let held: Holder = { callback: &chosen };",
          storage: "local",
          size: 2,
          leafOffset: 0,
          target: "held.callback",
          signature: "fn(): byte",
        },
        `let held: Holder = { callback: &chosen };
pokew($C100, 0);
fill(held);
poke($C000, held.callback());`,
        "function fill(holder: Holder): void { holder.callback = &chosen; }\n",
      ),
      offset: 0,
      outcome: "published-covered",
    });
  }, 60_000);
});

describe("address-taken frame storage written through a runtime address", () => {
  /**
   * The written address is not a compile-time constant, so no byte range can be
   * compared. Whatever the compiler decides here, a refusal still has to name
   * the storage it is protecting instead of rejecting without a cause.
   */
  it("should refuse the call and still name the storage behind the refusal", async () => {
    const declaration = "let held: Holder = { callback: &chosen };";
    const source = program(
      `${declaration}\nsink(&held.callback);\npoke($C000, held.callback());`,
      "function sink(value: word): void { pokew(value, 0); }\n",
    );
    await withProfileProject(source, target, async (project) => {
      const built = await buildProject({ project, optimization: "none" });
      expect(built.kind).toBe("failure");
      if (built.kind !== "failure") throw new Error("Expected a finite-target failure");
      const errors = built.diagnostics.filter((diagnostic) => diagnostic.severity === "error");
      expect(errors.map((diagnostic) => diagnostic.code)).toEqual(["E10277"]);
      const diagnostic = errors[0]!;
      expect(diagnostic.primarySpan).toEqual(profileSpan(source, "held.callback()"));
      expect(
        diagnostic.related.length,
        "A refusal must explain itself even when the covering write has no constant address",
      ).toBeGreaterThan(0);
      expect(
        diagnostic.related.some((note) => touches(note.span, profileSpan(source, declaration))),
      ).toBe(true);
      for (const note of diagnostic.related) expect(note.message.trim().length).toBeGreaterThan(0);
    });
  }, 60_000);
});

describe("module-level control", () => {
  /** Module storage is already protected; its behaviour and bytes must not drift. */
  it("should still refuse a call through an overwritten module variable", async () => {
    const declaration = "let callback: fn(): byte;";
    await exercise({
      test: {
        root: {
          declaration,
          storage: "global",
          size: 2,
          leafOffset: 0,
          target: "callback",
          signature: "fn(): byte",
        },
        call: "callback()",
        source: `module Game;
${declaration}
function chosen(): byte { return 37; }
function main(): void {
callback = &chosen;
pokew($C100, 0);
poke($C000, callback());
}
`,
      },
      offset: 0,
      outcome: "refused",
      repeatControl: true,
    });
  }, 60_000);
});

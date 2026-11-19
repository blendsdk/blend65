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

/** A stored root and the packed callable leaf whose proof is under observation. */
interface CallableRoot {
  /** Complete declaration used to identify the root in public memory evidence. */
  declaration: string;
  /** Complete root size, including fields or elements surrounding the callable. */
  size: number;
  /** Callable offset within the enclosing root, not within an intermediate field. */
  leafOffset: number;
  /** Source spelling of the callable target expression. */
  target: string;
  /** Exact function type used by the canonical diagnostic. */
  signature: string;
  /** Struct definitions needed before the root declaration. */
  definitions: string;
  /** Parameters of the compatible source function used by the fixture. */
  parameters: string;
}

/** Source and the exact call that would consume a stale target proof. */
interface CallableFixture {
  /** Legal source containing one replaceable four-digit raw-write address. */
  source: string;
  /** Stored root containing the observed callable. */
  root: CallableRoot;
  /** Smallest complete call expression requiring the finite target proof. */
  call: string;
}

/** Detached evidence from the exact immutable generation returned by a real build. */
type Artifacts = Awaited<ReturnType<typeof readProfileArtifacts>>;

/** The scalar control deliberately leaves placement automatic. */
const scalarRoot: CallableRoot = {
  declaration: "let callback: fn(): byte;",
  size: 2,
  leafOffset: 0,
  target: "callback",
  signature: "fn(): byte",
  definitions: "",
  parameters: "",
};

/** All qualified manifest profiles, including the disk image profile. */
const profiles = [
  "c64-pal-prg-kernal-6581",
  "c64-pal-prg-kernal-8580",
  "c64-pal-prg-takeover-6581",
  "c64-pal-prg-takeover-8580",
  "c64-ntsc-prg-kernal-6581",
  "c64-ntsc-prg-kernal-8580",
  "c64-ntsc-prg-takeover-6581",
  "c64-ntsc-prg-takeover-8580",
  "c64-pal-d64-kernal-6581",
] as const;

/** Optional optimization must not turn an invalid representation into a published result. */
const modes: readonly OptimizationGoal[] = ["none", "balanced", "speed", "size"];

/** Keep fixture construction explicit while sharing only ordinary source boilerplate. */
function fixture(
  body: string,
  helpers = "",
  root = scalarRoot,
  call = `${root.target}()`,
): CallableFixture {
  return {
    root,
    call,
    source: `module Game;
${root.definitions}
${root.declaration}
function chosen(${root.parameters}): byte { return 37; }
${helpers}
function main(): void {
${body}
}
`,
  };
}

/** Require a real assembled control; setup failures are not evidence of safe rejection. */
function successful(result: BuildResult) {
  expect(result.kind, `Control/setup failure: ${JSON.stringify(result.diagnostics)}`).toBe(
    "success",
  );
  if (result.kind !== "success") throw new Error("Control did not reach publication");
  return result;
}

/**
 * Resolve only the root's own CPU storage. An absent interval is not evidence
 * that a callable was eliminated, and must never make unsafe acceptance pass.
 */
function rootRange(artifacts: Artifacts, source: string, root: CallableRoot) {
  const declaration = profileSpan(source, root.declaration);
  const identity = `global::${declaration.sourceId}:${declaration.start}:${declaration.end}`;
  const intervals = profileRecords(artifacts.memory.intervals).filter((interval) => {
    if (interval.addressSpaceId !== "cpu16") return false;
    const owner = profileRecord(interval.owner);
    return owner.kind === "symbol" && owner.id === identity;
  });
  expect(
    intervals,
    "Public-evidence limitation: require the root's own materialized CPU interval; missing storage does not prove elimination",
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

/** Half-open byte ranges meet at a legal endpoint without overlapping. */
function overlaps(start: number, end: number, otherStart: number, otherEnd: number) {
  return start < otherEnd && otherStart < end;
}

/** Causal notes may select a subexpression, but must identify the actual source site. */
function touches(actual: SourceSpan, expected: SourceSpan) {
  return (
    actual.sourceId === expected.sourceId &&
    overlaps(actual.start, actual.end, expected.start, expected.end)
  );
}

/** A lost proof is a source error at the call, with both storage and write evidence. */
function expectLostProof(
  result: BuildResult,
  source: string,
  test: CallableFixture,
  write: string,
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
  expect(diagnostic.related.some((note) => touches(note.span, corruption))).toBe(true);
  for (const note of diagnostic.related) expect(note.message.trim().length).toBeGreaterThan(0);
}

/**
 * Change only one same-width literal after a successful reference build.
 * The reference selects a probe address; only the candidate's final interval
 * decides whether its published callable actually remains disjoint.
 */
async function exercise(
  test: CallableFixture,
  writeOffset: number,
  corruptsBeforeTarget: boolean,
  target: string = profiles[0],
  optimization: OptimizationGoal = "none",
  repeatControl = false,
) {
  await withProfileProject(test.source, target, async (project, root) => {
    const checked = await checkProject({ project });
    expect(checked.kind, `Illegal control source: ${JSON.stringify(checked.diagnostics)}`).toBe(
      "success",
    );
    let prior = successful(await buildProject({ project, optimization }));
    const reference = await readProfileArtifacts(prior);
    const referenceRange = rootRange(reference, test.source, test.root);
    const writes = test.source.match(/\bpokew?\(\$C100, 0\)/gu);
    expect(writes, "Fixture must have exactly one replaceable raw write").toHaveLength(1);
    const originalWrite = writes![0]!;
    const width = originalWrite.startsWith("pokew") ? 2 : 1;
    expect(overlaps(referenceRange.start, referenceRange.end, 0xc100, 0xc100 + width)).toBe(false);
    expect(overlaps(referenceRange.start, referenceRange.end, 0xc000, 0xc004)).toBe(false);

    if (repeatControl) {
      prior = successful(await buildProject({ project, optimization }));
      const repeated = await readProfileArtifacts(prior);
      // The primary bytes are a PRG or a disk image, depending on the profile.
      expect(repeated.prg).toEqual(reference.prg);
      expect(repeated.costs.totals).toEqual(reference.costs.totals);
      expect(repeated.memory.intervals).toEqual(reference.memory.intervals);
      expect(repeated.memory.stackDomains).toEqual(reference.memory.stackDomains);
    }

    const address = referenceRange.start + test.root.leafOffset + writeOffset;
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

    const prelayout = await checkProject({ project });
    expect(
      prelayout.kind,
      `Prelayout/source setup failure: ${JSON.stringify(prelayout.diagnostics)}`,
    ).toBe("success");
    const candidate = await buildProject({ project, optimization });
    if (!corruptsBeforeTarget) {
      successful(candidate);
      return;
    }
    if (candidate.kind === "success") {
      const artifacts = await readProfileArtifacts(candidate);
      const final = rootRange(artifacts, candidateSource, test.root);
      const callable = final.start + test.root.leafOffset;
      expect(
        overlaps(callable, callable + 2, address, address + width),
        "Unsafe acceptance: the raw write still overlaps this published representation's own callable bytes",
      ).toBe(false);
      return;
    }

    expectLostProof(candidate, candidateSource, test, candidateWrite);
    expect(await readFile(join(output, "current.json"))).toEqual(current);
    expect((await readdir(output)).sort()).toEqual(inventory);
    expect(await readProfileArtifacts(prior)).toEqual(surviving);
  });
}

describe.each(profiles)("automatic callable placement on %s", (target) => {
  it.each(modes)(
    "should preserve the disjoint control and reject or prove the matching representation when mode is %s",
    async (mode) => {
      await exercise(
        fixture("callback = &chosen;\npokew($C100, 0);\npoke($C000, callback());"),
        0,
        true,
        target,
        mode,
        true,
      );
    },
    60_000,
  );
});

describe("automatically placed scalar callable bytes", () => {
  it.each([
    ["low byte", "poke($C100, 0);", 0],
    ["high byte", "poke($C100, 0);", 1],
    ["word beginning one byte earlier", "pokew($C100, 0);", -1],
  ] as const)(
    "should lose the target proof when a write corrupts the %s",
    async (_name, write, offset) => {
      await exercise(
        fixture(`callback = &chosen;\n${write}\npoke($C000, callback());`),
        offset,
        true,
      );
    },
    60_000,
  );
});

/** Nested packing and array indexing both retain the complete root-relative offset. */
const aggregateRoots: readonly CallableRoot[] = [
  {
    ...scalarRoot,
    declaration: "let state: Root;",
    size: 6,
    leafOffset: 2,
    target: "state.slot.callback",
    definitions: `struct Slot { lead: byte; callback: fn(): byte; tail: byte; }
struct Root { prefix: byte; slot: Slot; suffix: byte; }`,
  },
  {
    ...scalarRoot,
    declaration: "let callbacks: (fn(): byte)[3];",
    size: 6,
    leafOffset: 2,
    target: "callbacks[1]",
  },
];

describe.each(aggregateRoots)("packed callable leaf $target", (root) => {
  it.each([
    ["preceding word overlaps the low byte", "pokew($C100, 0);", -1, true],
    ["byte overlaps the high byte", "poke($C100, 0);", 1, true],
    ["preceding sibling byte is disjoint", "poke($C100, 0);", -1, false],
    ["word ends exactly at the callable", "pokew($C100, 0);", -2, false],
    ["following sibling begins at the endpoint", "pokew($C100, 0);", 2, false],
  ] as const)(
    "should respect the enclosing root offset when %s",
    async (_name, write, offset, unsafe) => {
      await exercise(
        fixture(`${root.target} = &chosen;\n${write}\npoke($C000, ${root.target}());`, "", root),
        offset,
        unsafe,
      );
    },
    60_000,
  );
});

describe("reaching writes and definite typed restoration", () => {
  it.each([
    [
      "the raw write precedes assignment",
      "pokew($C100, 0);\ncallback = &chosen;\npoke($C000, callback());",
    ],
    [
      "the raw write follows the last call",
      "callback = &chosen;\npoke($C000, callback());\npokew($C100, 0);",
    ],
    [
      "a complete typed assignment restores the target",
      "callback = &chosen;\npokew($C100, 0);\ncallback = &chosen;\npoke($C000, callback());",
    ],
  ] as const)(
    "should retain a valid proof when %s",
    async (_name, body) => {
      await exercise(fixture(body), 0, false);
    },
    60_000,
  );

  it("should reject a reaching corruption when only one possible branch writes", async () => {
    await exercise(
      fixture(`callback = &chosen;
if (peek($C200) != 0) { pokew($C100, 0); }
poke($C000, callback());`),
      0,
      true,
    );
  }, 60_000);

  it.each([
    ["direct helper", "corrupt();", ""],
    ["transitive helper", "relay();", "function relay(): void { corrupt(); }"],
  ] as const)(
    "should reject a reaching corruption when a %s writes",
    async (_name, invoke, relay) => {
      await exercise(
        fixture(
          `callback = &chosen;\n${invoke}\npoke($C000, callback());`,
          `function corrupt(): void { pokew($C100, 0); }\n${relay}`,
        ),
        0,
        true,
      );
    },
    60_000,
  );

  it("should reject a reaching corruption when a later scheduled initializer writes", async () => {
    const root = {
      ...scalarRoot,
      declaration: "let callback: fn(): byte = &chosen;",
    };
    await exercise(
      fixture(
        "poke($C000, callback());\npoke($C001, initialized);",
        `let initialized: byte = initialize();
function initialize(): byte { pokew($C100, 0); return 1; }`,
        root,
      ),
      0,
      true,
    );
  }, 60_000);
});

/** A one-argument callable exposes capture-before-argument proof ordering. */
const argumentRoot: CallableRoot = {
  ...scalarRoot,
  declaration: "let callback: fn(byte): byte;",
  signature: "fn(byte): byte",
  parameters: "value: byte",
};

describe("call target capture and argument order", () => {
  it("should accept the captured target when its argument corrupts the global afterwards", async () => {
    await exercise(
      fixture(
        "callback = &chosen;\npoke($C000, callback(corrupt()));",
        "function corrupt(): byte { pokew($C100, 0); return 1; }",
        argumentRoot,
      ),
      0,
      false,
    );
  }, 60_000);

  it("should reject the later call when an argument corrupted the previously captured global", async () => {
    await exercise(
      fixture(
        `poke($C000, (callback = &chosen)(corrupt()));
poke($C001, callback(2));`,
        "function corrupt(): byte { pokew($C100, 0); return 1; }",
        argumentRoot,
        "callback(2)",
      ),
      0,
      true,
    );
  }, 60_000);

  it.each([
    [
      "the second argument restores the complete value",
      "corrupt(), word(callback = &chosen)",
      false,
    ],
    [
      "the second argument corrupts the restored value",
      "word(callback = &chosen), corrupt()",
      true,
    ],
  ] as const)(
    "should use left-to-right argument effects when %s",
    async (_name, argumentsSource, unsafe) => {
      const root = {
        ...scalarRoot,
        declaration: "let callback: fn(word, word): byte;",
        signature: "fn(word, word): byte",
        parameters: "first: word, second: word",
      };
      await exercise(
        fixture(
          `callback = &chosen;
poke($C000, callback(${argumentsSource}));
poke($C001, callback(0, 0));`,
          "function corrupt(): word { pokew($C100, 0); return 1; }",
          root,
          "callback(0, 0)",
        ),
        0,
        unsafe,
      );
    },
    60_000,
  );
});

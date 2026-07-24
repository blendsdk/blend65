import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import {
  createSourceRepository,
  INVENTORY_V1_LIMITS,
  parseInventoryJson,
  validateInventorySchema,
  validateInventorySources,
} from "./index.js";
import type {
  AuthorityClassification,
  ClauseLedgerEntry,
  InventoryLimits,
  InventoryRule,
  InventoryV1,
  NormativeSource,
  SourceCitation,
} from "./index.js";

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const SPEC_ROOT = join(REPOSITORY_ROOT, "spec");
const INVENTORY_PATH = join(REPOSITORY_ROOT, "readiness/inventory/compiler-readiness-v1.json");
const PROFILE = {
  profileId: "markdown-ebnf-v1",
  version: 1,
  contentHashAlgorithm: "sha256",
  newlinePolicy: "lf",
} as const;
const REVISION = "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const temporaryRoots: string[] = [];

interface LiteralFragment {
  readonly fragmentId: string;
  readonly contentHash: string;
}

const VECTOR_SOURCE = "# Root\nParagraph café.\n\n> raw\n";
const VECTOR_HEADING: LiteralFragment = {
  fragmentId: "frag.v1.ccun2ermgcqdsr2lr55w27am55hbit2r",
  contentHash: "sha256:d40d5b2cdb1457ed51bbff5279304fc5c7585993b831050e493fa65699cd77c1",
};
const VECTOR_PARAGRAPH: LiteralFragment = {
  fragmentId: "frag.v1.y2lxjs64bkk4qcs3oamwbyecbm4rigtw",
  contentHash: "sha256:dc85a5a9c56622fe5dfe08d53b4150e7bf066836bb3c3822da32797333d342e0",
};
const VECTOR_RESIDUAL: LiteralFragment = {
  fragmentId: "frag.v1.jid2swupvsx6aiw7fqjnu3rjh5gbhzms",
  contentHash: "sha256:f5fe7bb2f99654985c80613c893c17496af1f6fcc8f5d1dbf7209c51aa710f04",
};

async function temporaryRepository(copySpecification = false): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "blend65-readiness-"));
  temporaryRoots.push(root);
  if (copySpecification) {
    await cp(SPEC_ROOT, join(root, "spec"), { recursive: true });
  } else {
    await mkdir(join(root, "spec"));
  }
  return root;
}

async function repositoryWith(files: Readonly<Record<string, string>>) {
  const root = await temporaryRepository();
  await Promise.all(
    Object.entries(files).map(async ([path, content]) => {
      const destination = join(root, path);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, content);
    }),
  );
  return { root, repository: await repositoryFor(root) };
}

async function loadInventory(): Promise<InventoryV1> {
  const parsed = parseInventoryJson(await readFile(INVENTORY_PATH), INVENTORY_V1_LIMITS);
  expect(parsed.ok).toBe(true);
  const validated = validateInventorySchema(parsed.inventory);
  expect(validated.ok).toBe(true);
  if (validated.inventory === undefined) {
    throw new TypeError("The authoritative manifest skeleton did not validate.");
  }
  return validated.inventory;
}

async function repositoryFor(root: string, limits: InventoryLimits = INVENTORY_V1_LIMITS) {
  return createSourceRepository({
    repositoryRoot: root,
    specRoot: join(root, "spec"),
    limits,
  });
}

function source(
  path: string,
  classification: AuthorityClassification,
  heading: string,
  contentHash: string,
  order: number,
): NormativeSource {
  return {
    path,
    order,
    classification,
    sections: [{ headingAncestry: [heading], classification, contentHash }],
  };
}

function citation(path: string, heading: string, quote: string, hash: string): SourceCitation {
  return { path, headingAncestry: [heading], quote, contentHash: hash, displayLine: 999 };
}

function rule(ruleId: string, sourceCitation: SourceCitation): InventoryRule {
  return {
    ruleId,
    source: sourceCitation,
    requirement: sourceCitation.quote,
    category: "source",
    polarity: "positive",
    applicability: "mandatory-c64",
    validDomains: [],
    invalidNeighbors: [],
    boundaryFamilies: [],
    generatorIds: [],
    oracleIds: [],
    transformIds: [],
    handlerAbsenceReason: "Source ownership is validated without executable handlers.",
    evidenceObligations: [],
    prerequisiteRuleIds: [],
    relatedRuleIds: [],
  };
}

function inventory(
  sources: readonly NormativeSource[],
  ledger: readonly ClauseLedgerEntry[],
  rules: readonly InventoryRule[],
): InventoryV1 {
  return {
    schemaVersion: 1,
    inventoryVersion: "1.0.0",
    specRevision: REVISION,
    identityLedgerHead: REVISION,
    fragmentationProfile: PROFILE,
    normativeSources: sources,
    handlerDeclarations: [],
    evidenceCapabilityDeclarations: [],
    clauseLedger: ledger,
    conflicts: [],
    rules,
    evolutionGate: null,
  };
}

function vectorInventory(
  ruleHash = VECTOR_PARAGRAPH.contentHash,
  ledger: readonly ClauseLedgerEntry[] = [
    {
      fragmentId: VECTOR_HEADING.fragmentId,
      disposition: "non-normative",
      reasonCode: "heading",
    },
    {
      fragmentId: VECTOR_PARAGRAPH.fragmentId,
      disposition: "mapped",
      ruleIds: ["rule.paragraph"],
    },
    {
      fragmentId: VECTOR_RESIDUAL.fragmentId,
      disposition: "non-normative",
      reasonCode: "context",
    },
  ],
): InventoryV1 {
  return inventory(
    [source("spec/vector.md", "normative-chapter", "Root", VECTOR_HEADING.contentHash, 0)],
    ledger,
    [rule("rule.paragraph", citation("spec/vector.md", "Root", "Paragraph café.", ruleHash))],
  );
}

function expectDiagnostic(result: { readonly diagnostics: readonly unknown[] }, pattern: RegExp) {
  expect(result.diagnostics.some((diagnostic) => pattern.test(JSON.stringify(diagnostic)))).toBe(
    true,
  );
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("closed normative source manifest", () => {
  // The committed manifest explicitly classifies every file in the frozen specification tree.
  it("should classify the real specification tree completely", async () => {
    const inventory = await loadInventory();
    const repository = await repositoryFor(REPOSITORY_ROOT);

    expect(inventory.normativeSources.map((entry) => entry.path)).toEqual(
      await repository.listSpecFiles(),
    );
  });

  it("should accept the authoritative manifest when every source fragment has a disposition", async () => {
    const result = await validateInventorySources(
      await repositoryFor(REPOSITORY_ROOT),
      await loadInventory(),
    );

    expect(result.diagnostics).toEqual([]);
    expect(result.ok).toBe(true);
  });

  // A newly added specification file cannot inherit authority through a wildcard.
  it("should reject a specification file that has no explicit classification", async () => {
    const root = await temporaryRepository(true);
    await writeFile(join(root, "spec/unclassified.md"), "# Unclassified\n");
    const result = await validateInventorySources(await repositoryFor(root), await loadInventory());

    expect(result.ok).toBe(false);
    expectDiagnostic(result, /unclassified|manifest/i);
  });

  // Every declared normative grammar section remains mandatory in the closed manifest.
  it("should reject removal of a required grammar section", async () => {
    const manifest = await loadInventory();
    const grammar = manifest.normativeSources.find(
      (entry) => entry.path === "spec/grammar.ebnf.md",
    );
    if (grammar === undefined || grammar.sections.length === 0) {
      throw new TypeError("The grammar manifest entry must declare normative sections.");
    }
    const changed = inventory(
      manifest.normativeSources.map((entry) =>
        entry.path === grammar.path ? { ...entry, sections: entry.sections.slice(1) } : entry,
      ),
      manifest.clauseLedger,
      manifest.rules,
    );
    const result = await validateInventorySources(await repositoryFor(REPOSITORY_ROOT), changed);

    expect(result.ok).toBe(false);
    expectDiagnostic(result, /section|manifest|required/i);
  });

  it("should reject reordered, duplicate, or misclassified authoritative sources", async () => {
    const manifest = await loadInventory();
    const reordered = [...manifest.normativeSources];
    [reordered[0], reordered[1]] = [reordered[1]!, reordered[0]!];
    const duplicate = [...manifest.normativeSources];
    duplicate[1] = { ...duplicate[1]!, path: duplicate[0]!.path };
    const misclassified = manifest.normativeSources.map((entry, index) =>
      index === 1 ? { ...entry, classification: "contextual" as const } : entry,
    );
    const repository = await repositoryFor(REPOSITORY_ROOT);

    for (const sources of [reordered, duplicate, misclassified]) {
      const result = await validateInventorySources(
        repository,
        inventory(sources, manifest.clauseLedger, manifest.rules),
      );
      expect(result.ok).toBe(false);
      expectDiagnostic(result, /order|duplicate|classification|canonical/i);
    }
  });
});

describe("authority and citation semantics", () => {
  // A canonical chapter owns its rule while a contextual copy only points at that rule.
  it("should retain chapter ownership without creating a duplicate rule", async () => {
    const { repository } = await repositoryWith({
      "spec/rule.md": "# Values\nValue must fit.\n",
      "spec/context.md": "# Values\nValue must fit.\n",
    });
    const valuesHash = "sha256:8acf9d5ba3cb2ccaa45aa05756a78cb09d6033fe593a8f7c015ef849da1ebc47";
    const valueHash = "sha256:bb0686fe06c0bb572c98a43e4c046cb50bd1c3b66339343981c500b4ee935a01";
    const ledger: ClauseLedgerEntry[] = [
      {
        fragmentId: "frag.v1.gpxmdwzwxpvfa7gppjvv7ha4ul2fo6ny",
        disposition: "non-normative",
        reasonCode: "heading",
      },
      {
        fragmentId: "frag.v1.cxolmipbqkjmhjbnwe5x2e2xt7faplf7",
        disposition: "mapped",
        ruleIds: ["rule.value"],
      },
      {
        fragmentId: "frag.v1.36pddts2ntf2pbxannge74jwau3va53g",
        disposition: "non-normative",
        reasonCode: "heading",
      },
      {
        fragmentId: "frag.v1.vn6sbqvtn222cucw5ir2hhndamaqpk42",
        disposition: "canonical-restatement",
        canonicalRuleId: "rule.value",
        conflictId: "conflict.value-restatement",
      },
    ];
    const fixture = inventory(
      [
        source("spec/rule.md", "normative-chapter", "Values", valuesHash, 0),
        source("spec/context.md", "contextual", "Values", valuesHash, 1),
      ],
      ledger,
      [rule("rule.value", citation("spec/rule.md", "Values", "Value must fit.", valueHash))],
    );

    const result = await validateInventorySources(repository, fixture);

    expect(result.ok).toBe(true);
    expect(fixture.rules).toHaveLength(1);
  });

  // The C64 appendix owns a target value restated by a contextual platform chapter.
  it("should retain C64 appendix ownership without creating a duplicate rule", async () => {
    const { repository } = await repositoryWith({
      "spec/appendix-c64.md": "# Screen\nScreen base is 1024.\n",
      "spec/15-platform-profile.md": "# Screen\nScreen base is 1024.\n",
    });
    const headingHash = "sha256:49cf115f89d9f6592261950d92bf4b4da363b7e14ad000ba9e38681cd01c67b0";
    const valueHash = "sha256:488d577b5dda8298c0c4287adc3027b9694e0b6ae22c4b82b8012b5d9b21f79d";
    const fixture = inventory(
      [
        source("spec/appendix-c64.md", "normative-target", "Screen", headingHash, 0),
        source("spec/15-platform-profile.md", "contextual", "Screen", headingHash, 1),
      ],
      [
        {
          fragmentId: "frag.v1.fpxro3qhnr63kn2idl6kxwvtwd7eat7v",
          disposition: "non-normative",
          reasonCode: "heading",
        },
        {
          fragmentId: "frag.v1.6e6g7n7ot4qxxrsln6snekjkv5liviqt",
          disposition: "mapped",
          ruleIds: ["rule.screen"],
        },
        {
          fragmentId: "frag.v1.isjkje5hv6rijraglpgaanvb7fqteyfc",
          disposition: "non-normative",
          reasonCode: "heading",
        },
        {
          fragmentId: "frag.v1.k35b2h7vx2sajdrxb5pnnzqiwmr3oh7b",
          disposition: "canonical-restatement",
          canonicalRuleId: "rule.screen",
          conflictId: "conflict.screen-restatement",
        },
      ],
      [
        rule(
          "rule.screen",
          citation("spec/appendix-c64.md", "Screen", "Screen base is 1024.", valueHash),
        ),
      ],
    );

    const result = await validateInventorySources(repository, fixture);

    expect(result.ok).toBe(true);
    expect(fixture.rules).toHaveLength(1);
  });

  // A repeated ancestry and content anchor cannot select an arbitrary occurrence.
  it("should reject a repeated heading selector", async () => {
    const { repository } = await repositoryWith({
      "spec/repeated.md": "# Values\nValue.\n# Values\nValue.\n",
    });
    const headingHash = "sha256:8acf9d5ba3cb2ccaa45aa05756a78cb09d6033fe593a8f7c015ef849da1ebc47";
    const valueHash = "sha256:2cddcd5539cb2cb4e235aefd2b15c1c9c1cac3e3fd63bd564ee9620971247fff";
    const fixture = inventory(
      [source("spec/repeated.md", "normative-chapter", "Values", headingHash, 0)],
      [
        {
          fragmentId: "frag.v1.vrhqmgk52y53xquuzycnes6gq5up5bm3",
          disposition: "non-normative",
          reasonCode: "heading",
        },
        {
          fragmentId: "frag.v1.aog5c5uzaab65tlnah3w6kzbrwndsint",
          disposition: "mapped",
          ruleIds: ["rule.value"],
        },
        {
          fragmentId: "frag.v1.pvpbn2txmexalea7sqhia6zjph2ll6uf",
          disposition: "non-normative",
          reasonCode: "heading",
        },
        {
          fragmentId: "frag.v1.h4creqzrhli5ubqphhxg5trcbyjnpj4e",
          disposition: "canonical-restatement",
          canonicalRuleId: "rule.value",
          conflictId: "conflict.value-restatement",
        },
      ],
      [rule("rule.value", citation("spec/repeated.md", "Values", "Value.", valueHash))],
    );

    const result = await validateInventorySources(repository, fixture);

    expect(result.ok).toBe(false);
    expectDiagnostic(result, /ambiguous|multiple|unique/i);
  });

  // A stale quote hash is rejected even when its path and ancestry still exist.
  it("should reject a stale citation hash", async () => {
    const { repository } = await repositoryWith({ "spec/vector.md": VECTOR_SOURCE });
    const result = await validateInventorySources(
      repository,
      vectorInventory("sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"),
    );

    expect(result.ok).toBe(false);
    expectDiagnostic(result, /hash|stale/i);
  });

  // Display lines are recomputed metadata and cannot make a unique citation stale.
  it("should accept a stale display line and return the recomputed line", async () => {
    const { repository } = await repositoryWith({ "spec/vector.md": VECTOR_SOURCE });
    const result = await validateInventorySources(repository, vectorInventory());

    expect(result.ok).toBe(true);
    expect(result.inventory?.rules[0]?.source.displayLine).toBe(2);
  });
});

describe("vector-backed ledger failures", () => {
  // Changing one authoritative byte produces a deterministic citation hash mismatch.
  it("should report a hash mismatch after one source byte changes", async () => {
    const { repository } = await repositoryWith({
      "spec/vector.md": VECTOR_SOURCE.replace("café", "cafe"),
    });
    const result = await validateInventorySources(repository, vectorInventory());

    expect(result.ok).toBe(false);
    expectDiagnostic(result, /hash|stale/i);
  });

  // Removing one complete derived span's ledger entry reports that fragment as undisposed.
  it("should report an undisposed fragment when its ledger entry is deleted", async () => {
    const { repository } = await repositoryWith({ "spec/vector.md": VECTOR_SOURCE });
    const result = await validateInventorySources(
      repository,
      vectorInventory(
        VECTOR_PARAGRAPH.contentHash,
        vectorInventory().clauseLedger.filter(
          (entry) => entry.fragmentId !== VECTOR_RESIDUAL.fragmentId,
        ),
      ),
    );

    expect(result.ok).toBe(false);
    expectDiagnostic(result, /undisposed|missing.fragment/i);
  });
});

describe("bounded source repository", () => {
  // Source reads accept only existing canonical paths beneath the allowed specification root.
  it.each([
    ["missing path", "spec/not-present.md"],
    ["absolute path", "/etc/passwd"],
    ["parent traversal", "spec/../package.json"],
    ["empty segment", "spec//file.md"],
  ])("should reject a %s", async (_name, path) => {
    const { repository } = await repositoryWith({ "spec/file.md": "# File\n" });
    await expect(repository.read(path)).rejects.toThrow();
  });

  // Resolving a symlink cannot turn an allowed lexical path into an escaped real path.
  it("should reject a symlink that escapes the allowed root", async () => {
    const root = await temporaryRepository();
    await writeFile(join(root, "outside.md"), "outside\n");
    await symlink(join(root, "outside.md"), join(root, "spec/escape.md"));
    await expect((await repositoryFor(root)).read("spec/escape.md")).rejects.toThrow();
  });

  it("should reject a symlink alias even when it remains inside the allowed root", async () => {
    const root = await temporaryRepository();
    await writeFile(join(root, "spec/source.md"), "# Source\n");
    await symlink(join(root, "spec/source.md"), join(root, "spec/alias.md"));

    await expect((await repositoryFor(root)).listSpecFiles()).rejects.toThrow(/symbolic/i);
  });

  // File bytes are rejected at the configured boundary instead of being read without a bound.
  it("should enforce the configured per-file byte limit", async () => {
    const { root } = await repositoryWith({ "spec/large.md": "12345" });
    const repository = await repositoryFor(root, {
      ...INVENTORY_V1_LIMITS,
      maxInputBytes: 4,
    });
    await expect(repository.read("spec/large.md")).rejects.toThrow();
  });
});

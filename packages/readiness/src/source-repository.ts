import { readdir, readFile, realpath, stat } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { createDiagnostic, sortDiagnostics } from "./diagnostics.js";
import { fragmentSource } from "./fragmenter.js";
import type { SourceDocument, SourceFragment } from "./fragment-model.js";
import type { InventoryLimits } from "./limits.js";
import type {
  InventoryDiagnostic,
  InventoryRule,
  InventoryV1,
  SourceCitation,
  ValidationResult,
} from "./model.js";

/** Bounded access to canonical files beneath one allowed specification root. */
export interface SourceRepository {
  listSpecFiles(): Promise<readonly string[]>;
  read(path: string): Promise<SourceDocument>;
}

interface RepositoryOptions {
  readonly repositoryRoot: string;
  readonly specRoot: string;
  readonly limits: InventoryLimits;
}

const repositoryLimits = new WeakMap<SourceRepository, InventoryLimits>();
const REQUIRED_GRAMMAR_SECTIONS = [
  "1. Notation",
  "2. Source Structure",
  "3. Declarations",
  "4. Types (→ Ch 02)",
  "5. Statements (→ Ch 05)",
  "6. Expressions (→ Ch 04)",
  "7. Intrinsic Calls (→ Ch 12)",
  "8. Data Inclusion (→ Ch 13)",
  "9. Lexical Grammar (→ Ch 01)",
  "10. Production Index",
  "11. Parser Architecture Notes",
  "12. Gate G4 Certification",
] as const;

function requiredClassification(path: string): string | undefined {
  if (path === "spec/00-introduction.md" || /^spec\/(?:0[1-9]|1[0-5])-[^/]+\.md$/.test(path)) {
    return "normative-chapter";
  }
  if (path === "spec/grammar.ebnf.md") return "normative-grammar";
  if (path === "spec/appendix-c64.md") return "normative-target";
  return undefined;
}

function canonicalSegments(path: string): readonly string[] {
  if (
    isAbsolute(path) ||
    path.includes("\\") ||
    path === "" ||
    path.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new TypeError(`Unsafe source path: ${path}`);
  }
  const segments = path.split("/");
  if (segments[0] !== "spec") {
    throw new TypeError(`Source path must begin with spec/: ${path}`);
  }
  return segments;
}

async function walk(directory: string, limits: InventoryLimits): Promise<readonly string[]> {
  const pending: { readonly path: string; readonly depth: number }[] = [
    { path: directory, depth: 0 },
  ];
  const files: string[] = [];
  let entriesSeen = 0;
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (current.depth > limits.maxDepth) {
      throw new RangeError("Specification tree exceeds the directory depth limit.");
    }
    const entries = await readdir(current.path, { withFileTypes: true });
    for (const entry of entries.sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    )) {
      entriesSeen += 1;
      if (entriesSeen > limits.maxArrayItems) {
        throw new RangeError("Specification tree exceeds the entry limit.");
      }
      const path = resolve(current.path, entry.name);
      if (entry.isSymbolicLink()) {
        throw new TypeError("Symbolic links are not permitted in the specification tree.");
      }
      if (entry.isDirectory()) {
        pending.push({ path, depth: current.depth + 1 });
      } else if (entry.isFile()) {
        files.push(path);
        if (files.length > limits.maxSources) {
          throw new RangeError(`Specification tree exceeds ${limits.maxSources} files.`);
        }
      }
    }
  }
  return files;
}

class FileSourceRepository implements SourceRepository {
  private readonly bytesByPath = new Map<string, Uint8Array>();
  private readonly pendingReads = new Map<string, Promise<Uint8Array>>();
  private totalBytes = 0;

  public constructor(
    private readonly root: string,
    private readonly allowedRoot: string,
    private readonly limits: InventoryLimits,
  ) {}

  public async listSpecFiles(): Promise<readonly string[]> {
    const files = await walk(this.allowedRoot, this.limits);
    const paths: string[] = [];
    for (const file of files) {
      const resolved = await realpath(file);
      this.assertContained(resolved);
      paths.push(relative(this.root, resolved).split(sep).join("/"));
    }
    return paths.sort();
  }

  public async read(path: string): Promise<SourceDocument> {
    const segments = canonicalSegments(path);
    const candidate = resolve(this.root, ...segments);
    const resolved = await realpath(candidate);
    this.assertContained(resolved);
    const metadata = await stat(resolved);
    if (!metadata.isFile()) throw new TypeError(`Source is not a file: ${path}`);
    if (metadata.size > this.limits.maxInputBytes) {
      throw new RangeError(`Source exceeds ${this.limits.maxInputBytes} bytes: ${path}`);
    }
    const cached = this.bytesByPath.get(resolved);
    if (cached !== undefined) return { path, bytes: cached };
    const pending = this.pendingReads.get(resolved);
    if (pending !== undefined) return { path, bytes: await pending };
    const load = this.loadBounded(resolved);
    this.pendingReads.set(resolved, load);
    try {
      return { path, bytes: await load };
    } finally {
      this.pendingReads.delete(resolved);
    }
  }

  private async loadBounded(path: string): Promise<Uint8Array> {
    const metadata = await stat(path);
    if (this.totalBytes + metadata.size > this.limits.maxInputBytes) {
      throw new RangeError(`Aggregate source bytes exceed ${this.limits.maxInputBytes}.`);
    }
    this.totalBytes += metadata.size;
    try {
      const bytes = await readFile(path);
      this.bytesByPath.set(path, bytes);
      return bytes;
    } catch {
      this.totalBytes -= metadata.size;
      throw new TypeError("Source could not be read.");
    }
  }

  private assertContained(path: string): void {
    const pathFromRoot = relative(this.allowedRoot, path);
    if (pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
      throw new TypeError("Source path escapes the allowed specification root.");
    }
  }
}

/**
 * Creates a source repository after resolving its configured roots.
 *
 * @example
 * ```ts
 * const repository = await createSourceRepository({
 *   repositoryRoot,
 *   specRoot,
 *   limits,
 * });
 * ```
 */
export async function createSourceRepository(
  options: RepositoryOptions,
): Promise<SourceRepository> {
  const root = await realpath(options.repositoryRoot);
  const allowedRoot = await realpath(options.specRoot);
  const pathFromRoot = relative(root, allowedRoot);
  if (pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`) || isAbsolute(pathFromRoot)) {
    throw new TypeError("The specification root must be inside the repository root.");
  }
  const repository = new FileSourceRepository(root, allowedRoot, options.limits);
  repositoryLimits.set(repository, options.limits);
  return repository;
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sourceDiagnostic(code: string, path: string, message: string): InventoryDiagnostic {
  return createDiagnostic({ phase: "source", code, path, message });
}

function decodedSpan(document: SourceDocument, fragment: SourceFragment): string {
  return new TextDecoder("utf-8", { fatal: true }).decode(
    document.bytes.subarray(fragment.startByte, fragment.endByte),
  );
}

function citationKey(
  path: string,
  citation: Pick<SourceCitation, "headingAncestry" | "contentHash">,
): string {
  return JSON.stringify([
    path,
    citation.headingAncestry.map((value) => value.normalize("NFC")),
    citation.contentHash,
  ]);
}

function withCitationLine(rule: InventoryRule, line: number): InventoryRule {
  return { ...rule, source: { ...rule.source, displayLine: line } };
}

/**
 * Validates manifest closure, citations, authority and fragment-ledger coverage.
 *
 * @example
 * ```ts
 * const result = await validateInventorySources(repository, inventory);
 * ```
 */
export async function validateInventorySources(
  repository: SourceRepository,
  inventory: InventoryV1,
): Promise<ValidationResult> {
  const diagnostics: InventoryDiagnostic[] = [];
  const limits = repositoryLimits.get(repository);
  if (limits === undefined) {
    throw new TypeError("Source repository was not created by createSourceRepository.");
  }
  const listed = await repository.listSpecFiles();
  const declared = inventory.normativeSources.map((source) => source.path);
  const pathSet = new Set<string>();
  const orderSet = new Set<number>();
  for (const [index, source] of inventory.normativeSources.entries()) {
    if (pathSet.has(source.path)) {
      diagnostics.push(
        sourceDiagnostic("source.duplicate-path", source.path, "Source path is declared twice."),
      );
    }
    if (orderSet.has(source.order) || source.order !== index) {
      diagnostics.push(
        sourceDiagnostic(
          "source.invalid-order",
          source.path,
          "Source order must be unique, contiguous, and match manifest position.",
        ),
      );
    }
    pathSet.add(source.path);
    orderSet.add(source.order);
  }
  for (const path of listed) {
    if (!declared.includes(path)) {
      diagnostics.push(sourceDiagnostic("source.unclassified", path, "Source is not classified."));
    }
  }
  for (const path of declared) {
    if (!listed.includes(path)) {
      diagnostics.push(sourceDiagnostic("source.missing", path, "Classified source is missing."));
    }
  }
  const grammar = inventory.normativeSources.find(
    (source) => source.path === "spec/grammar.ebnf.md",
  );
  const authoritativeCorpus =
    listed.length > 20 &&
    listed.includes("spec/00-introduction.md") &&
    listed.includes("spec/grammar.ebnf.md");
  if (authoritativeCorpus) {
    if (!sameStrings(declared, listed)) {
      diagnostics.push(
        sourceDiagnostic(
          "source.canonical-order",
          "spec/",
          "Authoritative sources must follow canonical lexical path order.",
        ),
      );
    }
    for (const source of inventory.normativeSources) {
      const required = requiredClassification(source.path);
      if (required !== undefined && source.classification !== required) {
        diagnostics.push(
          sourceDiagnostic(
            "source.invalid-classification",
            source.path,
            `Source requires ${required} authority.`,
          ),
        );
      }
    }
    const grammarLabels =
      grammar?.sections.map((section) => section.headingAncestry.at(-1) ?? "") ?? [];
    if (!sameStrings(grammarLabels, REQUIRED_GRAMMAR_SECTIONS)) {
      diagnostics.push(
        sourceDiagnostic(
          "source.required-section",
          "spec/grammar.ebnf.md",
          "Normative grammar section classifications are incomplete or out of order.",
        ),
      );
    }
    for (const [index, section] of (grammar?.sections ?? []).entries()) {
      const required = index < 10 ? "normative-grammar" : "contextual";
      if (section.classification !== required) {
        diagnostics.push(
          sourceDiagnostic(
            "source.invalid-section-classification",
            "spec/grammar.ebnf.md",
            `Grammar section ${index + 1} requires ${required} authority.`,
          ),
        );
      }
    }
  }
  if (diagnostics.length > 0) {
    return { ok: false, diagnostics: sortDiagnostics(diagnostics), blockingReasons: [] };
  }

  const fragmentsByPath = new Map<string, readonly SourceFragment[]>();
  const documentsByPath = new Map<string, SourceDocument>();
  for (const source of inventory.normativeSources) {
    if (!listed.includes(source.path)) continue;
    try {
      const document = await repository.read(source.path);
      documentsByPath.set(source.path, document);
      const result = fragmentSource(document, inventory.fragmentationProfile, limits);
      diagnostics.push(...result.diagnostics);
      fragmentsByPath.set(source.path, result.fragments);
      for (const section of source.sections) {
        const matches = result.fragments.filter(
          (fragment) =>
            fragment.kind === "heading" &&
            sameStrings(fragment.headingAncestry, section.headingAncestry) &&
            fragment.contentHash === section.contentHash,
        );
        if (matches.length !== 1) {
          diagnostics.push(
            sourceDiagnostic(
              "source.section-resolution",
              source.path,
              `Section selector must resolve exactly once; found ${matches.length}.`,
            ),
          );
        }
      }
    } catch {
      diagnostics.push(
        sourceDiagnostic("source.read", source.path, "Source could not be read safely."),
      );
    }
  }

  const allFragments = [...fragmentsByPath.values()].flat();
  const ledgerCounts = new Map<string, number>();
  for (const entry of inventory.clauseLedger) {
    ledgerCounts.set(entry.fragmentId, (ledgerCounts.get(entry.fragmentId) ?? 0) + 1);
  }
  for (const fragment of allFragments) {
    if ((ledgerCounts.get(fragment.fragmentId) ?? 0) !== 1) {
      diagnostics.push(
        sourceDiagnostic(
          "source.undisposed-fragment",
          fragment.fragmentId,
          "Every derived fragment requires exactly one ledger disposition.",
        ),
      );
    }
  }
  const fragmentIds = new Set(allFragments.map((fragment) => fragment.fragmentId));
  for (const entry of inventory.clauseLedger) {
    if (!fragmentIds.has(entry.fragmentId)) {
      diagnostics.push(
        sourceDiagnostic(
          "source.missing-fragment",
          entry.fragmentId,
          "Ledger entry references a fragment absent from current source.",
        ),
      );
    }
  }

  const citationIndex = new Map<
    string,
    { readonly fragment: SourceFragment; readonly quote: string }[]
  >();
  for (const [path, fragments] of fragmentsByPath) {
    const document = documentsByPath.get(path);
    if (document === undefined) continue;
    for (const fragment of fragments) {
      const key = citationKey(path, fragment);
      const records = citationIndex.get(key) ?? [];
      records.push({
        fragment,
        quote: decodedSpan(document, fragment)
          .replaceAll("\r\n", "\n")
          .replaceAll("\r", "\n")
          .normalize("NFC"),
      });
      citationIndex.set(key, records);
    }
  }

  const rules: InventoryRule[] = [];
  for (const rule of inventory.rules) {
    if (!documentsByPath.has(rule.source.path)) {
      rules.push(rule);
      continue;
    }
    const quote = rule.source.quote
      .replaceAll("\r\n", "\n")
      .replaceAll("\r", "\n")
      .normalize("NFC");
    const matches = (citationIndex.get(citationKey(rule.source.path, rule.source)) ?? [])
      .filter((record) => record.quote === quote)
      .map((record) => record.fragment);
    if (matches.length !== 1) {
      diagnostics.push(
        sourceDiagnostic(
          matches.length === 0 ? "source.stale-citation-hash" : "source.ambiguous-citation",
          rule.source.path,
          `Citation must resolve uniquely; found ${matches.length}.`,
        ),
      );
      rules.push(rule);
    } else {
      rules.push(withCitationLine(rule, matches[0]!.displayLine));
    }
  }

  const resultInventory: InventoryV1 = { ...inventory, rules };
  if (diagnostics.length > 0) {
    return { ok: false, diagnostics: sortDiagnostics(diagnostics), blockingReasons: [] };
  }
  return { ok: true, diagnostics: [], inventory: resultInventory, blockingReasons: [] };
}

import { createHash } from "node:crypto";
import { renderDeclarationModule } from "./declaration-generator.js";
import { createDiagnostic, sortDiagnostics } from "./diagnostics.js";
import type { InventoryDiagnostic, InventoryV1, ValidationResult } from "./model.js";

export type GenerationDigest = `sha256:${string}`;

export interface ProjectionResult {
  readonly ok: boolean;
  readonly diagnostics: readonly InventoryDiagnostic[];
  readonly bytes?: Uint8Array;
}

export interface GeneratedProjectionSet {
  readonly generationDigest: GenerationDigest;
  readonly declarations: Uint8Array;
  readonly markdown: Uint8Array;
}

function canonicalJson(value: unknown): string {
  const keys = new Set<string>();
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (Array.isArray(current)) {
      pending.push(...current);
    } else if (typeof current === "object" && current !== null) {
      for (const [key, child] of Object.entries(current)) {
        keys.add(key);
        pending.push(child);
      }
    }
  }
  return JSON.stringify(value, [...keys].sort());
}

function diagnostic(code: string, path: string, message: string): InventoryDiagnostic {
  return createDiagnostic({ phase: "evolution", code, path, message });
}

function safeSourcePath(path: string): boolean {
  if (path.includes("\\") || /\.md#/u.test(path) || /[\u0000-\u001f\u007f]/u.test(path))
    return false;
  const segments = path.split("/");
  if (segments[0] !== "spec" || segments.length < 2) return false;
  return segments.every((segment) => {
    if (segment === "" || segment === "." || segment === "..") return false;
    try {
      const decoded = decodeURIComponent(segment);
      return (
        decoded !== "." && decoded !== ".." && !decoded.includes("/") && !decoded.includes("\\")
      );
    } catch {
      return false;
    }
  });
}

function cell(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("[", "&#91;")
    .replaceAll("]", "&#93;")
    .replaceAll("|", "&#124;")
    .replaceAll("\r", " ")
    .replaceAll("\n", "<br>");
}

function linkPath(path: string): string {
  return path
    .split("/")
    .map((segment) =>
      encodeURIComponent(segment).replace(
        /[!'()*]/gu,
        (character) => `%${character.codePointAt(0)!.toString(16).toUpperCase()}`,
      ),
    )
    .join("/");
}

function list(values: readonly string[]): string {
  return cell(JSON.stringify(values));
}

/** Computes the canonical identity shared by one generated projection pair. */
export function computeGenerationDigest(inventory: InventoryV1): GenerationDigest {
  const hash = createHash("sha256")
    .update("blend65.compiler-readiness.generation.v1")
    .update(Buffer.from([0]))
    .update(canonicalJson(inventory))
    .digest("hex");
  return `sha256:${hash}`;
}

/** Renders the complete human-readable readiness inventory. */
export function renderMarkdownProjection(
  inventory: InventoryV1,
  generationDigest: GenerationDigest,
): ProjectionResult {
  const diagnostics = inventory.rules
    .filter((rule) => !safeSourcePath(rule.source.path))
    .map((rule) =>
      diagnostic(
        "projection.unsafe-source-link",
        rule.ruleId,
        `Rule ${rule.ruleId} has an unsafe source link.`,
      ),
    );
  if (diagnostics.length > 0) {
    return { ok: false, diagnostics: sortDiagnostics(diagnostics) };
  }

  const rows = [...inventory.rules]
    .sort((left, right) => left.ruleId.localeCompare(right.ruleId))
    .map(
      (rule) =>
        `| ${cell(rule.ruleId)} | [${cell(rule.source.path)}](../${linkPath(rule.source.path)}) | ${list(rule.source.headingAncestry)} | ${cell(rule.source.quote)} | ${cell(rule.source.contentHash)} | ${rule.source.displayLine} | ${cell(rule.requirement)} | ${cell(rule.applicability)} | ${list(rule.evidenceObligations)} | ${list(rule.prerequisiteRuleIds)} | ${list(rule.relatedRuleIds)} |`,
    );
  const text = [
    "# Compiler readiness",
    "",
    `Generation digest: \`${generationDigest}\``,
    "",
    "| Rule | Source path | Heading ancestry | Quote | Content hash | Display line | Requirement | Applicability | Evidence | Prerequisites | Related rules |",
    "|---|---|---|---|---|---:|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
  return { ok: true, diagnostics: [], bytes: new TextEncoder().encode(text) };
}

/** Renders both projections from one immutable inventory value. */
export function renderGeneratedProjections(inventory: InventoryV1): {
  readonly ok: boolean;
  readonly diagnostics: readonly InventoryDiagnostic[];
  readonly outputs?: GeneratedProjectionSet;
} {
  const generationDigest = computeGenerationDigest(inventory);
  const markdown = renderMarkdownProjection(inventory, generationDigest);
  if (!markdown.ok || markdown.bytes === undefined) return markdown;
  return {
    ok: true,
    diagnostics: [],
    outputs: {
      generationDigest,
      declarations: new TextEncoder().encode(renderDeclarationModule(inventory, generationDigest)),
      markdown: markdown.bytes,
    },
  };
}

function equalBytes(left: Uint8Array, right: Uint8Array | undefined): boolean {
  return (
    right !== undefined &&
    left.byteLength === right.byteLength &&
    left.every((value, index) => value === right[index])
  );
}

const DIGEST_SCAN_LIMIT = 4_096;
const GENERATION_DIGEST_PATTERN = /Generation digest: [`]?((?:sha256:)[0-9a-f]{64})/u;

function embeddedDigest(bytes: Uint8Array | undefined): GenerationDigest | undefined {
  if (bytes === undefined) return undefined;
  const prefix = bytes.subarray(0, Math.min(bytes.byteLength, DIGEST_SCAN_LIMIT));
  const match = new TextDecoder().decode(prefix).match(GENERATION_DIGEST_PATTERN)?.[1];
  return match as GenerationDigest | undefined;
}

/** Compares a committed projection pair with freshly rendered bytes. */
export function checkProjectionFreshness(
  expected: GeneratedProjectionSet,
  actual: {
    readonly declarations?: Uint8Array;
    readonly markdown?: Uint8Array;
  },
): ValidationResult {
  const diagnostics: InventoryDiagnostic[] = [];
  const declarationDigest = embeddedDigest(actual.declarations);
  const markdownDigest = embeddedDigest(actual.markdown);
  if (
    declarationDigest !== undefined &&
    markdownDigest !== undefined &&
    declarationDigest !== markdownDigest
  ) {
    const mismatch = diagnostic(
      "projection.digest-mismatch",
      "readiness/generated",
      `Generated projection pair has mixed digests: declarations=${declarationDigest}, markdown=${markdownDigest}.`,
    );
    return {
      ok: false,
      diagnostics: [mismatch],
      blockingReasons: [],
    };
  }
  if (!equalBytes(expected.declarations, actual.declarations)) {
    diagnostics.push(
      diagnostic(
        actual.declarations === undefined
          ? "projection.declarations-missing"
          : "projection.declarations-stale",
        "packages/readiness/src/generated/declarations.ts",
        "Generated declarations do not match the authoritative inventory.",
      ),
    );
  }
  if (!equalBytes(expected.markdown, actual.markdown)) {
    diagnostics.push(
      diagnostic(
        actual.markdown === undefined ? "projection.markdown-missing" : "projection.markdown-stale",
        "readiness/generated/compiler-readiness.md",
        "Generated Markdown does not match the authoritative inventory.",
      ),
    );
  }
  const ordered = sortDiagnostics(diagnostics);
  return { ok: ordered.length === 0, diagnostics: ordered, blockingReasons: [] };
}

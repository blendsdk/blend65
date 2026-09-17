import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { expect } from "vitest";
import * as compiler from "../src/index.js";

/** The readonly result contract used by independent filesystem tests. */
export interface Diagnostic {
  /** Stable host-result or normative language identifier. */
  readonly code: string;
  /** Failures are errors; successful host observations may be warnings. */
  readonly severity: "error" | "warning";
  /** Concise sanitized explanation, without absolute host paths. */
  readonly message: string;
  /** Raw UTF-8 byte extent when a trustworthy location is available. */
  readonly primarySpan: {
    /** Exact project-relative host spelling. */
    readonly sourceId: string;
    /** Inclusive starting byte offset. */
    readonly start: number;
    /** Exclusive ending byte offset. */
    readonly end: number;
  } | null;
  /** Other input locations involved in a conflict. */
  readonly related: readonly {
    /** Raw byte location of the related input. */
    readonly span: {
      /** Exact project-relative host spelling. */
      readonly sourceId: string;
      /** Inclusive starting byte offset. */
      readonly start: number;
      /** Exclusive ending byte offset. */
      readonly end: number;
    };
    /** Why the related location matters. */
    readonly message: string;
  }[];
  /** Actionable correction when one is available. */
  readonly help: string | null;
  /** Responsible JSON pointer, when applicable. */
  readonly pointer: string | null;
}
/** Source bytes are represented publicly only as immutable decoded text. */
export interface RecordValue {
  /** Exact project-relative host spelling. */
  readonly sourceId: string;
  /** Fatal UTF-8 decoding of the raw bytes, including a leading BOM. */
  readonly text: string;
  /** Lowercase SHA-256 of the raw bytes. */
  readonly sha256: string;
  /** Raw byte count, not UTF-16 string length. */
  readonly byteLength: number;
  /** Host-only canonical path, excluded from input hashes. */
  readonly resolvedPath: string;
}
/** Snapshot fields specified by the loading service. */
export interface Snapshot {
  /** Validated values with exact names and selected defaults. */
  readonly manifest: Readonly<{
    /** Supported project schema. */
    schemaVersion: number;
    /** Literal artifact basename. */
    name: string;
    /** Manifest-relative source directory spelling. */
    sourceRoot: string;
    /** Qualified module identity. */
    entry: string;
    /** Exact qualified target profile identifier. */
    target: string;
    /** Ordered manifest-relative asset directories. */
    assetPaths: readonly string[];
    /** Manifest-relative compiler-owned output directory. */
    outDir: string;
    /** Requested optimization goal. */
    optimization: string;
    /** Whether runtime bounds safety was requested. */
    boundsCheck: boolean;
    /** Whether division-by-zero safety was requested. */
    divisionZeroCheck: boolean;
  }>;
  /** Manifest raw bytes and exact selected filename. */
  readonly manifestSource: RecordValue;
  /** Accepted sources in bytewise UTF-8 source-ID order. */
  readonly sources: readonly RecordValue[];
  /** Hash of the fixed versioned input tuple. */
  readonly inputSha256: string;
  /** Host-only canonical manifest directory. */
  readonly projectRoot: string;
  /** Host-only canonical source directory. */
  readonly sourceRoot: string;
  /** Host-only resolved asset directories in declared order. */
  readonly assetPaths: readonly string[];
  /** Host-only validated output location, not created by loading. */
  readonly outDir: string;
  /** Invocation-only selections retained separately from the manifest. */
  readonly overrides: Readonly<{
    /** Explicit target selection, or null if omitted. */
    target: string | null;
    /** Explicit entry selection, or null if omitted. */
    entry: string | null;
  }>;
  /** Invocation target after applying a valid override. */
  readonly effectiveTarget: string;
  /** Invocation entry after applying a valid override. */
  readonly effectiveEntry: string;
}
/** Loading failures must have no snapshot property. */
export type Result =
  | {
      /** Complete immutable result discriminator. */
      readonly kind: "success";
      /** Revalidated coherent input set. */
      readonly snapshot: Snapshot;
      /** Non-error host observations, never part of identity. */
      readonly observations: readonly Diagnostic[];
    }
  | {
      /** Failure without a usable snapshot. */
      readonly kind: "failure";
      /** Deterministically ordered root-cause explanations. */
      readonly diagnostics: readonly Diagnostic[];
    };
/** Invocation parameters do not modify the manifest. */
export interface Options {
  /** Directory from which discovery or a relative selector begins. */
  readonly cwd?: string;
  /** Authoritative manifest selector, relative or absolute. */
  readonly project?: string;
  /** Invocation-only exact profile identifier. */
  readonly target?: string;
  /** Invocation-only qualified module identifier. */
  readonly entry?: string;
}
/** Awaited mutation boundaries let tests exercise real deterministic races. */
export interface Checkpoint {
  /** Exact awaited boundary named by the loader. */
  readonly phase:
    | "after-manifest"
    | "after-paths"
    | "after-inventory"
    | "before-open"
    | "after-open"
    | "after-read"
    | "before-revalidation"
    | "after-revalidation-inventory"
    | "after-revalidation-read";
  /** One-based complete attempt count. */
  readonly attempt: number;
  /** Opened/read input identity, or null at aggregate boundaries. */
  readonly sourceId: string | null;
}
/** Trusted private arguments only lower existing host safeguards. */
export interface Controls {
  /** Trusted reductions of fixed production limits. */
  readonly limits?: Partial<{
    /** Maximum raw manifest bytes. */
    manifestBytes: number;
    /** Maximum raw bytes in each source. */
    sourceBytes: number;
    /** Maximum unique admitted manifest/source bytes per attempt. */
    totalBytes: number;
    /** Maximum regular sources per attempt. */
    sourceFiles: number;
    /** Maximum source directory entries visited per attempt. */
    visitedEntries: number;
    /** Maximum directory depth, with source root at zero. */
    depth: number;
    /** Maximum complete attempts, including the first. */
    attempts: number;
  }>;
  /** Awaited fixture mutation; receives no host, handle, or reader. */
  readonly onCheckpoint?: (point: Checkpoint) => void | Promise<void>;
}

/**
 * Deny native read/list access and return an awaited restoration operation.
 * Windows uses its actual current-user ACL; POSIX preserves the original mode.
 * Command failures propagate so an ineffective fixture cannot masquerade as proof.
 */
export async function denyRead(path: string): Promise<() => Promise<void>> {
  if (process.platform === "win32") {
    const run = promisify(execFile);
    const { stdout } = await run("whoami", []);
    const user = stdout.trim();
    await run("icacls", [path, "/deny", `${user}:(R)`]);
    return async () => {
      await run("icacls", [path, "/remove:d", user]);
    };
  }
  const originalMode = (await stat(path)).mode;
  await chmod(path, 0);
  return async () => {
    await chmod(path, originalMode);
  };
}

/** A fresh real tree is owned solely by its test and removed afterwards. */
export async function freshTree(): Promise<string> {
  return mkdtemp(join(tmpdir(), "blend65-project-spec-"));
}
/** Delete only an exact temporary directory created by freshTree. */
export async function removeTree(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}
/** Write a known fixture, creating its parent directories. */
export async function put(root: string, name: string, bytes: string | Uint8Array): Promise<void> {
  const path = join(root, name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}
/** Default manifest values keep host tests independent of language parsing. */
export function manifest(fields: Readonly<Record<string, unknown>> = {}): string {
  return JSON.stringify({
    schemaVersion: 1,
    name: "Foundation",
    sourceRoot: "src",
    entry: "Foundation",
    target: "c64-pal-prg-kernal-6581",
    outDir: "out",
    ...fields,
  });
}
/** Build a minimal contained project with raw, intentionally unparsed source text. */
export async function project(
  root: string,
  fields: Readonly<Record<string, unknown>> = {},
  filename = "blend65.json",
): Promise<void> {
  await put(root, filename, manifest(fields));
  await put(root, "src/main.blend", "not a module header\n");
}
/** An absent public function is a behavioral failure, not a collection failure. */
export async function load(options: Options = {}): Promise<Result> {
  const candidate: unknown = Reflect.get(compiler, "loadProject");
  expect(candidate, "public loadProject must exist").toBeTypeOf("function");
  if (typeof candidate !== "function") throw new Error("public loadProject is missing");
  return candidate(options) as Promise<Result>;
}
/** Assert the success discriminator before using any public snapshot field. */
export function success(result: Result): Snapshot {
  expect(result.kind).toBe("success");
  if (result.kind !== "success") throw new Error(JSON.stringify(result.diagnostics));
  return result.snapshot;
}
/** All expected host failures are typed and never expose absolute paths or stacks. */
export function failure(
  result: Result,
  code: string,
  roots: readonly string[] = [],
): readonly Diagnostic[] {
  expect(result.kind).toBe("failure");
  expect(result).not.toHaveProperty("snapshot");
  if (result.kind !== "failure") throw new Error("unexpected snapshot");
  expect(result.diagnostics.map((d) => d.code)).toContain(code);
  for (const d of result.diagnostics) {
    expect(d.severity).toBe("error");
    const rendered = JSON.stringify(d);
    for (const root of roots) expect(rendered).not.toContain(root);
    expect(d.message).not.toMatch(/\n\s+at |Error:|\u001b/);
  }
  return result.diagnostics;
}
/** Compute the oracle directly from raw bytes rather than service internals. */
export function hash(bytes: string | Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
/** Fixed versioned tuple encoding is the entire input identity contract. */
export function inputHash(snapshot: Snapshot): string {
  return hash(
    JSON.stringify([
      "blend65-project-input-v1",
      [snapshot.manifestSource.sourceId, snapshot.manifestSource.sha256],
      snapshot.sources.map((source) => [source.sourceId, source.sha256]),
      snapshot.overrides.target,
      snapshot.overrides.entry,
    ]),
  );
}
/** Record every path and raw content to detect any unexpected write. */
export async function treeBytes(root: string): Promise<readonly (readonly [string, string])[]> {
  const records: [string, string][] = [];
  async function visit(relative: string): Promise<void> {
    const entries = await readdir(join(root, relative), { withFileTypes: true });
    entries.sort((a, b) => Buffer.compare(Buffer.from(a.name), Buffer.from(b.name)));
    for (const entry of entries) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        records.push([`${name}/`, ""]);
        await visit(name);
      } else if (entry.isFile())
        records.push([name, (await readFile(join(root, name))).toString("hex")]);
    }
  }
  await visit("");
  return records;
}

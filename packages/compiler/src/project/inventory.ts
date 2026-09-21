import { opendir, realpath } from "node:fs/promises";
import { join } from "node:path";
import {
  checkLimit,
  escapeDiagnosticText,
  projectDiagnostic,
  PROJECT_CODES,
  ProjectChanged,
  ProjectFailure,
  throwReadFailure,
} from "./diagnostics.js";
import { isContained, resolveInput, sameIdentity, sourceId, throwPathFailure } from "./paths.js";
import type { ProjectPaths, ResolvedInput } from "./paths.js";
import type { ProjectLimits } from "./types.js";

/** Collect a bounded, exact-name source inventory without reading output or asset contents. */
export async function inventorySources(
  paths: ProjectPaths,
  manifest: ResolvedInput,
  limits: ProjectLimits,
  observed = false,
  signal?: AbortSignal,
): Promise<readonly ResolvedInput[]> {
  const sources: ResolvedInput[] = [];
  let visited = 0;
  /** Active ancestors detect cycles; repeated regular identities are checked after stable sorting. */
  async function visit(
    directory: ResolvedInput,
    depth: number,
    ancestors: readonly ResolvedInput[],
  ): Promise<void> {
    signal?.throwIfAborted();
    checkLimit("depth", limits.depth, depth);
    const current = await resolveInput(
      directory.logicalPath,
      paths.logicalRoot,
      paths.root,
      directory.sourceId || "/sourceRoot",
      true,
    );
    signal?.throwIfAborted();
    if (isContained(paths.output, current.resolvedPath)) return;
    if (!sameIdentity(current.metadata, directory.metadata)) throw new ProjectChanged();
    if (!current.metadata.isDirectory()) throwPathFailure(current.sourceId, "expected a directory");
    const cycle = ancestors.find((parent) => parent.resolvedPath === current.resolvedPath);
    if (cycle !== undefined)
      throw new ProjectFailure([
        projectDiagnostic(
          PROJECT_CODES.cycle,
          "Project path cycle: " +
            [...ancestors.map((parent) => parent.sourceId), current.sourceId]
              .map(escapeDiagnosticText)
              .join(" -> "),
          { sourceId: current.sourceId, start: 0, end: 0 },
          null,
          [
            {
              span: { sourceId: cycle.sourceId, start: 0, end: 0 },
              message: "Active directory ancestor",
            },
          ],
        ),
      ]);
    // Stream and enforce the global entry budget before retaining each name. Sorting this
    // bounded single-directory list makes first failures independent of creation order.
    const names: string[] = [];
    try {
      const handle = await opendir(current.resolvedPath);
      try {
        for (;;) {
          signal?.throwIfAborted();
          const entry = await handle.read();
          signal?.throwIfAborted();
          if (entry === null) break;
          checkLimit("visitedEntries", limits.visitedEntries, ++visited);
          names.push(entry.name);
        }
      } finally {
        await handle.close();
      }
    } catch (error) {
      signal?.throwIfAborted();
      if (error instanceof ProjectFailure) throw error;
      throwReadFailure(error, current.sourceId || "/sourceRoot", observed);
    }
    names.sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)));
    for (const name of names) {
      signal?.throwIfAborted();
      const logical = join(current.logicalPath, name);
      if (isContained(paths.logicalOutput, logical)) continue;
      const id = sourceId(paths.logicalRoot, logical);
      let canonical: string;
      try {
        canonical = await realpath(logical);
        signal?.throwIfAborted();
      } catch (error) {
        signal?.throwIfAborted();
        // resolveInput supplies the typed cycle diagnostic for native ELOOP too.
        await resolveInput(logical, paths.logicalRoot, paths.root, id, observed);
        throwReadFailure(error, id, observed);
      }
      if (isContained(paths.output, canonical)) continue;
      const input = await resolveInput(logical, paths.logicalRoot, paths.root, id, observed);
      signal?.throwIfAborted();
      // Resolution can race the earlier canonical check; recheck the identity actually retained.
      if (isContained(paths.output, input.resolvedPath)) continue;
      if (input.metadata.isDirectory()) await visit(input, depth + 1, [...ancestors, current]);
      else if (name.endsWith(".blend")) {
        if (!input.metadata.isFile()) throwPathFailure(id, "expected a regular file");
        checkLimit("sourceFiles", limits.sourceFiles, sources.length + 1);
        sources.push(input);
      }
    }
    const after = await resolveInput(
      current.logicalPath,
      paths.logicalRoot,
      paths.root,
      current.sourceId || "/sourceRoot",
      true,
    );
    signal?.throwIfAborted();
    if (!sameIdentity(current.metadata, after.metadata)) throw new ProjectChanged();
  }
  await visit(paths.source, 0, []);
  sources.sort((left, right) =>
    Buffer.compare(Buffer.from(left.sourceId), Buffer.from(right.sourceId)),
  );
  const identities = new Map<string, ResolvedInput>();
  identities.set(manifest.metadata.dev + ":" + manifest.metadata.ino, manifest);
  for (const input of sources) {
    signal?.throwIfAborted();
    const identity = input.metadata.dev + ":" + input.metadata.ino;
    const prior = identities.get(identity);
    if (prior !== undefined)
      throw new ProjectFailure([
        projectDiagnostic(
          PROJECT_CODES.alias,
          "Source '" +
            escapeDiagnosticText(input.sourceId) +
            "' resolves to an already inventoried input",
          { sourceId: input.sourceId, start: 0, end: 0 },
          null,
          [
            {
              span: { sourceId: prior.sourceId, start: 0, end: 0 },
              message: "First input with this identity",
            },
          ],
        ),
      ]);
    identities.set(identity, input);
  }
  if (sources.length === 0)
    throw new ProjectFailure([
      projectDiagnostic(
        PROJECT_CODES.empty,
        "No .blend source files under '" + escapeDiagnosticText(paths.source.sourceId || ".") + "'",
      ),
    ]);
  return Object.freeze(sources);
}

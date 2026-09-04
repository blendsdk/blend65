import type { ExecutionPublicationBindingV1 } from "./execution-publication-model.js";
import type {
  PublishedExecutionParentFreshnessFileV1,
  PublishedExecutionRelease,
  PublishedExecutionReleaseDescriptorV1,
} from "./execution-publication-resolver.js";

/** Authenticated child-release facts retained behind an opaque executable capability. */
export interface PublishedExecutionReleaseStateV1 extends PublishedExecutionReleaseDescriptorV1 {
  readonly semanticReviewDigest: string;
  readonly memberBytes: ReadonlyMap<string, Uint8Array>;
}

const RELEASES = new WeakMap<object, PublishedExecutionReleaseStateV1>();

/** Retains one fully authenticated child release behind its opaque capability. */
export function retainPublishedExecutionReleaseStateV1(
  release: PublishedExecutionRelease,
  state: PublishedExecutionReleaseStateV1,
): void {
  RELEASES.set(release, state);
}

/** Returns private child-release facts only for a genuine retained capability. */
export function getPublishedExecutionReleaseStateV1(
  release: PublishedExecutionRelease,
): PublishedExecutionReleaseStateV1 | undefined {
  return typeof release === "object" && release !== null ? RELEASES.get(release) : undefined;
}

function copyBindings(
  bindings: readonly ExecutionPublicationBindingV1[],
): readonly ExecutionPublicationBindingV1[] {
  return Object.freeze(bindings.map((row) => Object.freeze({ ...row })));
}

function copyFreshnessFiles(
  files: readonly PublishedExecutionParentFreshnessFileV1[],
): readonly PublishedExecutionParentFreshnessFileV1[] {
  return Object.freeze(files.map((file) => Object.freeze({ ...file })));
}

/** Returns defensive executable-compatible facts for the dependency-safe live package handoff. */
export function getPublishedExecutionReleaseDescriptorV1(
  release: PublishedExecutionRelease,
): PublishedExecutionReleaseDescriptorV1 | undefined {
  const state = getPublishedExecutionReleaseStateV1(release);
  if (state === undefined) return undefined;
  return Object.freeze({
    repositoryRoot: state.repositoryRoot,
    executionPublicationRoot: state.executionPublicationRoot,
    executionReleaseRoot: state.executionReleaseRoot,
    executionReleaseDevice: state.executionReleaseDevice,
    executionReleaseInode: state.executionReleaseInode,
    executionPointerPath: state.executionPointerPath,
    parentPointerPath: state.parentPointerPath,
    digest: state.digest,
    parentDigest: state.parentDigest,
    bindingDigest: state.bindingDigest,
    bindings: copyBindings(state.bindings),
    childReleaseFiles: Object.freeze(
      state.childReleaseFiles.map((file) => Object.freeze({ ...file })),
    ),
    parentFreshnessFiles: copyFreshnessFiles(state.parentFreshnessFiles),
  });
}

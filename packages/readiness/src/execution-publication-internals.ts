/**
 * Read-only passive handoff used by the live execution package.
 *
 * The accessor accepts only a genuine opaque release and returns defensive serialized facts. It
 * exposes no commit operation, selection authority, freshness callback, encoder, or pointer editor.
 */
export {
  createExecutionReviewCandidateProjectionV1,
  getExecutionReviewCandidateProjectionDescriptorV1,
  getPublishedExecutionReleaseDescriptorV1,
} from "./execution-publication-resolver.js";
export type {
  ExecutionReviewCandidateProjectionDescriptorV1,
  ExecutionReviewCandidateProjectionV1,
  PublishedExecutionReleaseDescriptorV1,
} from "./execution-publication-resolver.js";

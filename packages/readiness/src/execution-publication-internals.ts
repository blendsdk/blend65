/**
 * Read-only passive handoff used by the live execution package.
 *
 * The accessor accepts only a genuine opaque release and returns defensive serialized facts. It
 * exposes no commit operation, selection authority, freshness callback, encoder, or pointer editor.
 */
export { getPublishedExecutionReleaseDescriptorV1 } from "./execution-publication-resolver.js";
export type { PublishedExecutionReleaseDescriptorV1 } from "./execution-publication-resolver.js";

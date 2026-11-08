import { createHash } from "node:crypto";
import type { AssetProvenance } from "./asset-handler.js";

/**
 * Build the canonical native asset identity from every input that can change the
 * selected output.
 *
 * Two files with equal output bytes still receive distinct identities because
 * the input path and digest are part of the hash. Two selectors of one file are
 * distinct for the same reason.
 */
export function nativeAssetId(provenance: AssetProvenance, sourcePath: string): string {
  return createHash("sha256")
    .update(
      [
        "blend65-asset-v1",
        provenance.handlerKey,
        provenance.handlerVersion,
        sourcePath,
        provenance.inputSha256,
        provenance.selector,
        provenance.representation,
        provenance.outputSha256,
      ].join("\0"),
      "utf8",
    )
    .digest("hex");
}

/**
 * Keep the established raw identity stable for unregistered bytes.
 *
 * Raw files have one implicit selector and one representation, so only the
 * source path and output digest can distinguish them.
 */
export function rawAssetId(sourcePath: string, outputSha256: string): string {
  return createHash("sha256")
    .update(`blend65-raw-v1\0${sourcePath}\0${outputSha256}`, "utf8")
    .digest("hex");
}
